#!/usr/bin/env python3
"""
MASID procurement tier — the money-side signal, joined to the contract records.

This is the fusion step from FUSION.md: a second, independent suspicion signal
drawn from the procurement record, to sit alongside the delivery signal. It is
independent in the way that matters — PhilGEPS sees the award and never the
structure, satellites see the structure and never the award.

SOURCE
  bettergovph/philgeps-data (HuggingFace), CC0-1.0
  https://huggingface.co/datasets/bettergovph/philgeps-data
  5,481,161 award rows, 2000-2025. philgeps.parquet is 492 MB.

WHAT THE JOIN ACTUALLY LOOKS LIKE

  FUSION.md proposed contractId <-> PhilGEPS contract reference as the primary
  key. That key does not exist in practice: `contract_no` is null on 99.9% of
  rows, and where present it is free text in no consistent format ("CB2024-047",
  "I30", "24112023"). The primary strategy is dead on arrival.

  The fallback works. Normalised contractor name plus exact contract amount
  matches 32.1% of Bulacan 1st DEO contracts outright, 35.3% within 0.5%.

WHAT IS AND IS NOT DERIVABLE

  PhilGEPS carries no bidder counts and no approved-budget column. So the
  single-bidder indicator, the number-of-bidders indicator and the true
  bid-to-ABC ratio in FUSION.md's Signal A are NOT derivable from this source,
  however much one would want them. They are not implemented rather than
  approximated.

  A tempting substitute is the ratio of the PhilGEPS award to the DPWH budget:
  43% of comparable contracts sit at exactly 1.0000, which reads like winning at
  precisely the approved budget. It is not used as a bid-discount signal, because
  DPWH's `budget` column has mixed semantics — on some records it is plainly the
  awarded amount, in which case a ratio of 1.0 is an artefact of the same number
  appearing twice, not an absence of competition. The ratio is reported only as
  what it can honestly support: two public records disagreeing about the value of
  the same contract.

  What IS derivable, and is implemented:
    - award concentration: a contractor's share of the district office's total
      awarded value, across all categories, not just flood control
    - repeat-award intensity: how much of the office's award count one contractor
      takes
    - records disagreement: DPWH budget vs PhilGEPS award beyond tolerance
    - absent from PhilGEPS: a DPWH contract with no matching award record

USAGE
  python3 pipeline/procurement.py [--deo "Bulacan 1st DEO"]
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data"
OUT = ROOT / "src" / "app" / "data"

PHILGEPS_URL = (
    "https://huggingface.co/datasets/bettergovph/philgeps-data/"
    "resolve/main/philgeps.parquet"
)

AMOUNT_TOLERANCE = 0.005      # 0.5% — covers rounding between the two portals
PLAUSIBLE_YEARS = (2000, 2026)

# Concentration is measured in multiples of an equal split, not as an absolute
# share. With 537 contractors on this office's books an equal split is 0.19%, so
# a flat "8% is high" threshold — which an earlier pass used — flags nobody and
# says nothing. Expressing it as "this firm holds 30x what an even division would
# give" is both interpretable and self-calibrating to the size of the office.
CONCENTRATION_HIGH_X = 20.0
CONCENTRATION_MED_X = 10.0


def fetch(url: str, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  cached  {dest.name} ({dest.stat().st_size/1e6:.0f} MB)")
        return dest
    print(f"  fetch   {url}  (492 MB, one time)")
    subprocess.run(["curl", "-fsSL", "-A", "masid-pipeline", "-o", str(dest), url],
                   check=True)
    return dest


def norm_contractor(s: str) -> str:
    """Entity resolution for contractor names, which FUSION.md correctly called
    the main time sink.

    DPWH and PhilGEPS spell the same firm differently, and DPWH additionally
    appends registration markers and former names: "ST. TIMOTHY CONSTRUCTION
    CORPORATION ([REVOKED] 39196)", "M3 KONSTRACT CORPORATION
    (FORMERLY:MARGARITA CONSTRUCTION)". Parenthetical content is dropped and the
    generic corporate vocabulary is stripped, because it carries no identifying
    information and is exactly where the two sources disagree.

    This is deliberately lossy. Two genuinely different firms whose names differ
    only by such words will collide. The alternative — matching on raw strings —
    fails far more often, and every match is additionally required to agree on
    the contract amount before it is used.
    """
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c)).upper()
    s = re.sub(r"\(.*?\)", " ", s)
    s = re.sub(
        r"\b(INC|INCORPORATED|CORP|CORPORATION|CO|LTD|ENT|ENTERPRISES|CONST|"
        r"CONSTRUCTION|BUILDERS|GEN|GENERAL|CONTRACTOR|CONTRACTORS|DEVELOPMENT|"
        r"TRADING|SUPPLY|SUPPLIES|SERVICES|AND|&)\b", " ", s)
    s = re.sub(r"[^A-Z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def load_awards(deo: str) -> pd.DataFrame:
    """All PhilGEPS awards for the district office, deduplicated.

    PhilGEPS bulk data repeats award rows verbatim — one contract appearing two
    or four times. Left in, every concentration figure would be wrong by whatever
    the duplication rate happens to be for that contractor."""
    path = fetch(PHILGEPS_URL, CACHE / "philgeps.parquet")
    f = pq.ParquetFile(path)
    # Every token must be present. Matching on "1ST DEO" alone would sweep in
    # every province's first district office nationwide — which it did, turning
    # a PHP 12 B office into a PHP 635 B one and making every share meaningless.
    tokens = [t for t in deo.upper().split() if t]        # e.g. BULACAN 1ST DEO

    cols = ["awardee_name", "organization_name", "contract_amount", "award_date",
            "award_title", "notice_title", "reference_id", "business_category",
            "area_of_delivery"]
    keep = []
    for i in range(f.metadata.num_row_groups):
        df = f.read_row_group(i, columns=cols).to_pandas()
        org = df.organization_name.astype(str).str.upper()
        m = org.str.contains("PUBLIC WORKS", na=False)
        for t in tokens:
            m &= org.str.contains(t, na=False, regex=False)
        sub = df[m]
        if len(sub):
            keep.append(sub)
    g = pd.concat(keep) if keep else pd.DataFrame(columns=cols)
    before = len(g)
    g = g.drop_duplicates(
        subset=["awardee_name", "organization_name", "contract_amount",
                "award_date", "award_title"])
    print(f"  {before:,} award rows -> {len(g):,} after removing verbatim duplicates")

    g = g.copy()
    g["key"] = g.awardee_name.map(norm_contractor)
    yr = pd.to_datetime(g.award_date, errors="coerce").dt.year
    g["year"] = yr.where(yr.between(*PLAUSIBLE_YEARS))
    return g


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--deo", default="Bulacan 1st DEO")
    args = ap.parse_args()

    print("PhilGEPS awards")
    awards = load_awards(args.deo)
    if awards.empty:
        print("  no awards found for that district office")
        return 1

    total_value = float(awards.contract_amount.sum())
    total_count = len(awards)
    print(f"  {total_count:,} awards, PHP {total_value/1e9:.2f} B total, "
          f"{awards.key.nunique():,} distinct contractors")

    # ── contractor-level signals ─────────────────────────────────────────────
    # Denominator is the office's ENTIRE award book, not just flood control:
    # concentration means share of what this office hands out, full stop.
    by_key = awards.groupby("key").agg(
        awards=("contract_amount", "size"),
        value=("contract_amount", "sum"),
        firstYear=("year", "min"),
        lastYear=("year", "max"),
    )
    by_key["valueShare"] = by_key.value / total_value
    by_key["countShare"] = by_key.awards / total_count

    n_contractors = int(awards.key.nunique())
    amounts = defaultdict(list)
    for _, r in awards.iterrows():
        amounts[r.key].append(float(r.contract_amount))

    # ── join to the DPWH contracts ───────────────────────────────────────────
    projects = json.loads((OUT / "projects.json").read_text())
    results = []
    tally = defaultdict(int)

    for p in projects:
        key = norm_contractor(p["contractor"])
        budget = float(p["budget"])
        arr = np.array(amounts.get(key, []))

        match, conf, ratio = None, "none", None
        if arr.size:
            exact = arr[np.isclose(arr, budget, atol=0.01)]
            if exact.size:
                match, conf, ratio = float(exact[0]), "exact", 1.0
            else:
                near = arr[np.abs(arr - budget) <= budget * AMOUNT_TOLERANCE]
                if near.size:
                    best = float(near[np.argmin(np.abs(near - budget))])
                    match, conf, ratio = best, "tolerance", best / budget
                else:
                    best = float(arr[np.argmin(np.abs(arr - budget))])
                    ratio = best / budget if budget else None
                    conf = "contractor-only"
        tally[conf] += 1

        c = by_key.loc[key] if key in by_key.index else None
        flags = []

        if c is None:
            flags.append({
                "code": "NO_PHILGEPS_AWARD",
                "severity": "low",
                "detail": "No PhilGEPS award to this contractor from this district "
                          "office. PhilGEPS coverage of DPWH is incomplete, so this "
                          "is a gap in the record rather than a finding about the "
                          "contract.",
            })
        else:
            share = float(c.valueShare)
            multiple = share * n_contractors          # x an equal split
            sev = ("medium" if multiple >= CONCENTRATION_HIGH_X else
                   "low" if multiple >= CONCENTRATION_MED_X else None)
            if sev:
                flags.append({
                    "code": "AWARD_CONCENTRATION",
                    "severity": sev,
                    "detail": f"This contractor holds {share:.2%} of everything "
                              f"{args.deo} has awarded via PhilGEPS "
                              f"(PHP {float(c.value)/1e6:,.0f} M across "
                              f"{int(c.awards)} awards) — {multiple:.0f}x what an "
                              f"equal split among its {n_contractors} contractors "
                              f"would give. Concentration is a documented "
                              f"procurement red flag; it is not evidence about "
                              f"this contract.",
                    "concentrationMultiple": round(multiple, 1),
                })

        if conf == "contractor-only" and ratio is not None and abs(ratio - 1) > 0.05:
            flags.append({
                "code": "VALUE_DISAGREEMENT",
                "severity": "low",
                "detail": f"No PhilGEPS award from this contractor comes within "
                          f"0.5% of the DPWH contract value; the closest is "
                          f"{ratio:.2f}x it. The two public records do not agree "
                          f"on what this work cost, or the award is not published.",
            })

        results.append({
            "id": p["id"],
            "matchConfidence": conf,
            "philgepsAmount": match,
            "amountRatio": None if ratio is None else round(ratio, 4),
            "contractorKey": key,
            "contractorAwards": None if c is None else int(c.awards),
            "contractorValue": None if c is None else float(c.value),
            "valueShare": None if c is None else round(float(c.valueShare), 5),
            "procurementFlags": flags,
            "procurementScore": sum({"high": 3, "medium": 2, "low": 1}[f["severity"]]
                                    for f in flags),
        })

    matched = tally["exact"] + tally["tolerance"]
    print(f"\nJoin over {len(projects):,} DPWH contracts:")
    for k in ("exact", "tolerance", "contractor-only", "none"):
        print(f"  {k:<16} {tally[k]:5,} ({tally[k]/len(projects):5.1%})")
    print(f"  -> usable amount-level join: {matched:,} ({matched/len(projects):.1%})")

    top = by_key.sort_values("value", ascending=False).head(10)
    print("\nTop contractors by share of this office's award book:")
    for k, r in top.iterrows():
        print(f"  {r.valueShare:6.2%}  PHP {r.value/1e6:9,.0f} M  {int(r.awards):4d} awards  {k[:46]}")

    payload = {
        "generated": pd.Timestamp.now("UTC").strftime("%Y-%m-%dT%H:%M:%SZ"),
        "districtOffice": args.deo,
        "source": {
            "name": "PhilGEPS award records",
            "dataset": "bettergovph/philgeps-data",
            "url": "https://huggingface.co/datasets/bettergovph/philgeps-data",
            "license": "CC0-1.0",
            "rowsUpstream": 5481161,
        },
        "office": {
            "awards": total_count,
            "equalSplitShare": round(1 / n_contractors, 6),
            "concentrationThresholds": {"medium": CONCENTRATION_MED_X,
                                        "high": CONCENTRATION_HIGH_X},
            "totalValue": total_value,
            "contractors": int(awards.key.nunique()),
        },
        "join": {
            "strategy": "normalised contractor name + contract amount",
            "primaryKeyUnavailable": (
                "contract_no is null on 99.9% of PhilGEPS rows and is free text "
                "where present, so the contractId join proposed in FUSION.md is "
                "not implementable"
            ),
            "counts": dict(tally),
            "usableRate": round(matched / len(projects), 4),
        },
        "notDerivable": [
            "bidder counts and single-bidder awards — PhilGEPS publishes no bidder data",
            "true bid-to-ABC ratio — no approved-budget column; DPWH `budget` has "
            "mixed semantics and cannot stand in for one",
            "bid-window timing — no notice-to-award dates in this export",
        ],
        "results": results,
    }
    (OUT / "procurement.json").write_text(json.dumps(payload, indent=1))
    print(f"\n-> {OUT/'procurement.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
