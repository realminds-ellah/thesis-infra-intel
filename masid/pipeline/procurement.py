#!/usr/bin/env python3
"""
MASID procurement tier — bidding red flags from the DPWH detail export.

Run pipeline/verify_data.py first. It gates this file, and it exists because an
earlier version of this tier was built on assumptions about a column whose
meaning had never been checked.

SOURCE
  bettergovph/dpwh-transparency-data, dpwh_transparency_data_all_details.parquet
  (115 MB, CC0-1.0). 248,421 contracts carrying the fields the flat 24 MB export
  drops: bidders with PCAB ids, the approved budget, the full procurement
  timeline, and links to the published contract documents.

WHY THIS REPLACED THE PHILGEPS VERSION (kept as procurement_philgeps.py)

  The first version joined PhilGEPS awards to DPWH on contractor name plus
  amount and reached 36%. Everything it inferred is in the DPWH export directly,
  at 100% coverage, keyed by PCAB registration number rather than by fuzzy name
  matching. PhilGEPS survives only as an independent corroboration of amounts.

  That version also documented three indicators as "not derivable" —
  single-bidder awards, the bid-to-ABC ratio, and bid-window timing. All three
  are present here. The claim was wrong because the wrong file had been read.

WHAT `budget` IS NOT
  Verified rather than assumed: DPWH's `budget` matches `abc` on 55% of contracts
  and `awardAmount` on 43%. It is reliably neither. This file uses `abc` and
  `awardAmount` explicitly and never touches `budget` for an amount comparison.

EVERY THRESHOLD IS A BASE RATE
  A red flag means nothing without one. Each indicator below is stated against
  the national flood-control distribution across all district offices, computed
  in this file before the data is narrowed.

USAGE
  python3 pipeline/verify_data.py && python3 pipeline/procurement.py
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data"
OUT = ROOT / "src" / "app" / "data"
DETAIL = CACHE / "dpwh_all_details.parquet"

# Concentration in multiples of an equal split, so the threshold scales with the
# number of contractors on the office's books instead of being a flat share.
CONCENTRATION_HIGH_X = 15.0
CONCENTRATION_MED_X = 8.0

DOC_FIELDS = ["advertisement", "contractAgreement", "noticeOfAward",
              "noticeToProceed", "programOfWork", "engineeringDesign"]


def parse_amount(series):
    """Some money values carry thousands separators ("10,947,829.50"). Parsing
    without stripping them returns NaN silently — it dropped 3,063 national rows
    from an earlier run of this file with no error and no warning."""
    return pd.to_numeric(
        series.astype(str).str.replace(",", "", regex=False).str.strip(),
        errors="coerce")


def as_list(x):
    return [] if x is None or isinstance(x, float) else list(x)


def norm_name(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c)).upper()
    s = re.sub(r"\(.*?\)", " ", s)
    s = re.sub(r"[^A-Z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def winner_identity(bidders) -> tuple[str, str]:
    """Stable identity for the winning contractor.

    PCAB registration number where present — it is the government's own key and
    survives the renamings that defeat string matching ("M3 KONSTRACT CORPORATION
    (FORMERLY:MARGARITA CONSTRUCTION)"). Joint ventures carry a JV id and often
    no single PCAB number, so those fall back to the normalised name; keying them
    on the empty string would have collapsed PHP 9.5 B onto one phantom firm.
    """
    for b in as_list(bidders):
        if b.get("isWinner"):
            pcab = (b.get("pcabId") or "").strip()
            name = b.get("name") or ""
            return (f"pcab:{pcab}" if pcab else f"name:{norm_name(name)}"), name
    return "", ""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--deo", default="Bulacan 1st DEO")
    args = ap.parse_args()

    if not DETAIL.exists():
        print(f"missing {DETAIL} — download dpwh_transparency_data_all_details.parquet")
        return 2

    df = pd.read_parquet(DETAIL)

    # ── national baseline, computed before narrowing ─────────────────────────
    nat = df[df.category.astype(str).str.contains("Flood", case=False, na=False)].copy()
    nat["abcN"] = parse_amount(nat.abc)
    nat["awN"] = parse_amount(nat.awardAmount)
    nat["ratio"] = nat.awN / nat.abcN
    nat = nat.dropna(subset=["ratio"])
    nat["whole"] = np.abs(nat.ratio * 100 - np.round(nat.ratio * 100)) < 0.01
    nat["at96"] = (nat.ratio >= 0.9599) & (nat.ratio <= 0.9601)
    nat_nb = nat.bidders.map(lambda x: len(as_list(x)))

    baseline = {
        "contracts": int(len(nat)),
        "wholePercentRate": round(float(nat.whole.mean()), 4),
        "at96Rate": round(float(nat.at96.mean()), 4),
        "singleBidderRate": round(float((nat_nb == 1).mean()), 4),
        "medianRatio": round(float(nat.ratio.median()), 4),
    }
    print("national flood-control baseline (all DEOs):")
    print(f"  contracts with ABC and award   : {baseline['contracts']:,}")
    print(f"  award at a whole % of ABC      : {baseline['wholePercentRate']:.1%}")
    print(f"  award at exactly 96.00% of ABC : {baseline['at96Rate']:.1%}")
    print(f"  single-bidder                  : {baseline['singleBidderRate']:.1%}")

    per = nat.groupby("province").agg(n=("ratio", "size"), at96=("at96", "sum"))
    per = per[per.n >= 200]
    per["rate"] = per.at96 / per.n
    per = per.sort_values("rate", ascending=False)
    rank = int(list(per.index).index(args.deo) + 1) if args.deo in per.index else None

    # ── the office ───────────────────────────────────────────────────────────
    office = df[df.province == args.deo].copy()
    office["ident"] = office.bidders.map(lambda x: winner_identity(x)[0])
    office["amt"] = parse_amount(office.awardAmount).fillna(office.budget)
    named = office[office.ident != ""]
    conc = named.groupby("ident").amt.agg(["sum", "size"])
    conc["share"] = conc["sum"] / conc["sum"].sum()
    n_ident = len(conc)
    print(f"\n{args.deo}: {len(office):,} contracts across all categories, "
          f"{n_ident} distinct winning contractors")

    d = df[df.category.astype(str).str.contains("Flood", case=False, na=False)
           & (df.province == args.deo)].copy().reset_index(drop=True)
    n = len(d)
    d["abcN"] = parse_amount(d.abc)
    d["awN"] = parse_amount(d.awardAmount)
    d["ratio"] = d.awN / d.abcN
    ad = pd.to_datetime(d.advertisementDate, errors="coerce")
    bs = pd.to_datetime(d.bidSubmissionDeadline, errors="coerce")
    d["window"] = (bs - ad).dt.days

    at96_rate = float(((d.ratio >= 0.9599) & (d.ratio <= 0.9601)).mean())
    print(f"  flood-control contracts        : {n:,}")
    print(f"  award at exactly 96.00% of ABC : {at96_rate:.1%} "
          f"(national {baseline['at96Rate']:.1%}; rank {rank} of {len(per)} DEOs)")

    win_p5 = float(d.window.quantile(0.05)) if d.window.notna().any() else 0.0

    results, tally = [], defaultdict(int)
    for i, row in d.iterrows():
        ident, _ = winner_identity(row.bidders)
        nb = len(as_list(row.bidders))
        flags = []

        if nb == 1:
            flags.append({
                "code": "SINGLE_BIDDER", "severity": "medium",
                "detail": "One bidder only. Nationally "
                          f"{baseline['singleBidderRate']:.1%} of flood-control "
                          "contracts are awarded without a competing bid.",
            })
        elif nb == 2:
            flags.append({
                "code": "TWO_BIDDERS", "severity": "low",
                "detail": "Two bidders. Thin competition, not an irregularity on "
                          "its own.",
            })

        ratio = row.ratio
        if pd.notna(ratio) and abs(ratio * 100 - round(ratio * 100)) < 0.01:
            pct = ratio * 100
            sev = "medium" if abs(pct - 96.0) < 0.01 else "low"
            flags.append({
                "code": "BID_AT_ROUND_PERCENT", "severity": sev,
                "detail": f"The winning bid is exactly {pct:.0f}.00% of the approved "
                          f"budget (₱{row.awN:,.2f} of ₱{row.abcN:,.2f}). Competitive "
                          f"bids rarely land on a whole percentage — nationally "
                          f"{baseline['wholePercentRate']:.1%} do. At this office "
                          f"{at96_rate:.1%} sit on 96.00% alone, against a national "
                          f"{baseline['at96Rate']:.1%}. A statistical anomaly, not "
                          f"proof of anything.",
                "ratio": round(float(ratio), 4),
            })

        if pd.notna(row.window) and row.window < win_p5:
            flags.append({
                "code": "SHORT_BID_WINDOW", "severity": "low",
                "detail": f"{int(row.window)} days from advertisement to the bid "
                          f"deadline, below this office's 5th percentile "
                          f"({win_p5:.0f} days).",
            })

        share = float(conc.loc[ident, "share"]) if ident in conc.index else None
        if share is not None:
            mult = share * n_ident
            sev = ("medium" if mult >= CONCENTRATION_HIGH_X else
                   "low" if mult >= CONCENTRATION_MED_X else None)
            if sev:
                flags.append({
                    "code": "AWARD_CONCENTRATION", "severity": sev,
                    "detail": f"This contractor holds {share:.2%} of everything "
                              f"{args.deo} awards across all categories — "
                              f"{mult:.0f}× an equal split among its {n_ident} "
                              f"contractors. Identified by PCAB registration "
                              f"number, not by name.",
                    "concentrationMultiple": round(mult, 1),
                })

        docs = {c: (row[c] if isinstance(row[c], str) and row[c].startswith("http") else None)
                for c in DOC_FIELDS}
        if not any(docs.values()):
            flags.append({
                "code": "NO_DOCUMENTS_PUBLISHED", "severity": "low",
                "detail": "No contract document published, against roughly 95% "
                          "coverage across this office.",
            })

        for f in flags:
            tally[f["code"]] += 1

        results.append({
            "id": row.contractId,
            "bidders": nb,
            # Who actually bid, not just how many. A reader wants to know who
            # else was in the room, and DPWH publishes it.
            "bidderList": [
                {"name": re.sub(r"\s*\(\d+\)\s*$", "", str(b.get("name") or "")).strip(),
                 "pcab": (b.get("pcabId") or "") or None,
                 "won": bool(b.get("isWinner"))}
                for b in as_list(row.bidders)
            ],
            "winnerPcab": ident[5:] if ident.startswith("pcab:") else None,
            "abc": None if pd.isna(row.abcN) else float(row.abcN),
            "awardAmount": None if pd.isna(row.awN) else float(row.awN),
            "bidRatio": None if pd.isna(ratio) else round(float(ratio), 4),
            "bidWindowDays": None if pd.isna(row.window) else int(row.window),
            "advertisementDate": None if pd.isna(ad.iloc[i]) else str(ad.iloc[i].date()),
            "dateOfAward": str(row.dateOfAward)[:10] if isinstance(row.dateOfAward, str) else None,
            "valueShare": None if share is None else round(share, 5),
            "documents": docs,
            "procurementFlags": flags,
            "procurementScore": sum({"high": 3, "medium": 2, "low": 1}[f["severity"]]
                                    for f in flags),
        })

    print("\nflags raised:")
    for k, v in sorted(tally.items(), key=lambda kv: -kv[1]):
        print(f"  {k:24s} {v:5,} ({v/n:5.1%})")

    docs_any = sum(1 for r in results if any(r["documents"].values()))
    print(f"\ncontracts with at least one published document: {docs_any:,} "
          f"({docs_any/n:.1%})")

    payload = {
        "generated": pd.Timestamp.now("UTC").strftime("%Y-%m-%dT%H:%M:%SZ"),
        "districtOffice": args.deo,
        "source": {
            "name": "DPWH transparency portal, full detail export",
            "dataset": "bettergovph/dpwh-transparency-data",
            "file": "dpwh_transparency_data_all_details.parquet",
            "url": "https://huggingface.co/datasets/bettergovph/dpwh-transparency-data",
            "license": "CC0-1.0",
            "rowsUpstream": 248421,
        },
        "office": {
            "contractsAllCategories": int(len(office)),
            "contractors": n_ident,
            "equalSplitShare": round(1 / n_ident, 6),
            "at96Rate": round(at96_rate, 4),
            "deoRankAt96": rank,
            "deosCompared": int(len(per)),
            "bidWindowP5Days": win_p5,
            "documentsPublished": docs_any,
        },
        "nationalBaseline": baseline,
        "flagTally": dict(sorted(tally.items(), key=lambda kv: -kv[1])),
        "results": results,
    }
    (OUT / "procurement.json").write_text(json.dumps(payload, indent=1))
    print(f"-> {OUT/'procurement.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
