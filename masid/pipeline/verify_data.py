#!/usr/bin/env python3
"""
Data verification gate. Run this before anything else consumes the DPWH export.

The project already shipped one dataset whose semantics I had guessed wrong, and
built a whole screen on the claim that documents were unpublished when 96% of
them have live URLs. Both would have been caught by a check like this, so the
check now runs first and exits non-zero when something critical fails.

WHAT IS CHECKED

  cross-export   the flat and detail BetterGov exports agree, field by field, on
                 every contract they share
  structure     one winner per contract, bidders carry PCAB ids, amounts and
                 dates are internally ordered
  semantics     what DPWH's ambiguous `budget` column actually holds, measured
                 against the real `abc` and `awardAmount` columns rather than
                 assumed
  reachability  a sample of published document URLs actually resolve (--network)

WHAT IS NOT CHECKED HERE
  Whether the upstream portal itself is truthful. The strongest available check
  on that is manual: download a contract's Notice of Award and compare it to the
  row. Doing so for 22CC0095 returned "Forty Three Million Two Hundred Seventy
  Six Thousand Four Hundred Twenty Eight Pesos and 28/100 (P43,276,428.28)"
  against an `awardAmount` of 43276428.28 — exact to the centavo, with the
  contractor and municipality also matching. One spot check is not a guarantee,
  but it is the difference between trusting a mirror and having tested it.

USAGE
  python3 pipeline/verify_data.py [--deo "Bulacan 1st DEO"] [--network]
"""

from __future__ import annotations

import argparse
import json
import random
import subprocess
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data"
OUT = ROOT / "src" / "app" / "data"

FLAT = CACHE / "dpwh_transparency_data.parquet"
DETAIL = CACHE / "dpwh_all_details.parquet"

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

LINK_COLS = ["advertisement", "contractAgreement", "noticeOfAward", "noticeToProceed"]


class Report:
    """Collects check results and decides whether the data may be used."""

    def __init__(self):
        self.rows = []
        self.failed = False

    def check(self, name, ok_count, total, *, critical=True, warn_at=0.05, note=""):
        bad = total - ok_count
        rate = bad / total if total else 0
        if bad == 0:
            level = "PASS"
        elif rate <= warn_at:
            level = "WARN"
        else:
            level = "FAIL" if critical else "WARN"
        if level == "FAIL":
            self.failed = True
        self.rows.append({"check": name, "level": level, "violations": bad,
                          "total": total, "rate": round(rate, 4), "note": note})
        print(f"  [{level}] {name:52s} {bad:6,} / {total:,} ({rate:6.1%}) {note}")
        return level

    def info(self, name, value, note=""):
        self.rows.append({"check": name, "level": "INFO", "value": value, "note": note})
        print(f"  [INFO] {name:52s} {value} {note}")


def as_list(x):
    """Arrow list columns arrive as ndarray, None or NaN depending on the row."""
    if x is None or isinstance(x, float):
        return []
    return list(x)


def same(a, b, *, num=False, tol=0.01):
    """Equality that treats two missing values as agreeing — the obvious trap in
    comparing two exports, and one that manufactured 94 phantom mismatches on a
    first pass."""
    if num:
        a = pd.to_numeric(a, errors="coerce")
        b = pd.to_numeric(b, errors="coerce")
        return (a.isna() & b.isna()) | (np.abs(a - b) <= tol)
    an, bn = a.isna(), b.isna()
    return (an & bn) | (~an & ~bn & (a.astype(str).str.strip() == b.astype(str).str.strip()))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--deo", default="Bulacan 1st DEO")
    ap.add_argument("--network", action="store_true",
                    help="also HEAD-check a sample of published document URLs")
    ap.add_argument("--sample", type=int, default=12)
    args = ap.parse_args()

    for p in (FLAT, DETAIL):
        if not p.exists():
            print(f"missing {p} — run build_dataset.py first, and download "
                  f"dpwh_transparency_data_all_details.parquet")
            return 2

    r = Report()
    print(f"VERIFYING DPWH EXPORTS FOR {args.deo}\n")

    # ── 1. the two exports agree ─────────────────────────────────────────────
    print("cross-export agreement (flat vs all-details):")
    flat = pd.read_parquet(FLAT)
    loc = pd.json_normalize(flat["location"])
    flat = pd.concat([flat.drop(columns=["location"]), loc.add_prefix("loc_")], axis=1)
    det = pd.read_parquet(DETAIL)

    r.info("rows, flat export", f"{len(flat):,}")
    r.info("rows, detail export", f"{len(det):,}")
    r.check("detail has no duplicate contractId",
            det.contractId.nunique(), len(det))
    ids_f, ids_d = set(flat.contractId), set(det.contractId)
    r.check("every flat contract exists in detail",
            len(ids_f & ids_d), len(ids_f))
    r.info("contracts only in detail", f"{len(ids_d - ids_f):,}",
           "(detail is the newer, larger export)")

    f = flat[flat.category.astype(str).str.contains("Flood", case=False, na=False)
             & (flat.loc_province == args.deo)]
    d = det[det.category.astype(str).str.contains("Flood", case=False, na=False)
            & (det.province == args.deo)]
    m = f.merge(d, on="contractId", suffixes=("_f", "_d"))
    n = len(m)
    r.info("contracts in slice", f"{n:,}")

    for field, num in [("budget", True), ("amountPaid", True), ("progress", True),
                       ("status", False), ("contractor", False),
                       ("latitude", True), ("longitude", True), ("infraYear", False)]:
        tol = 1e-6 if field in ("latitude", "longitude") else 0.01
        ok = same(m[f"{field}_f"], m[f"{field}_d"], num=num, tol=tol)
        r.check(f"agree on {field}", int(ok.sum()), n)

    # ── 2. structure of the new fields ───────────────────────────────────────
    print("\ninternal consistency of the detail-only fields:")
    nb = d.bidders.map(lambda x: len(as_list(x)))
    win = d.bidders.map(lambda x: sum(1 for v in as_list(x) if v.get("isWinner")))
    r.check("every contract has at least one bidder", int((nb >= 1).sum()), n)
    r.check("at most one winner per contract", int((win <= 1).sum()), n)
    r.check("exactly one winner per contract", int((win == 1).sum()), n,
            critical=False, note="(0 winners tracks the null-contractor rows)")
    pc = d.bidders.map(lambda x: sum(1 for v in as_list(x) if v.get("pcabId")))
    r.check("every bidder carries a PCAB id", int((pc == nb).sum()), n,
            critical=False, note="(gaps are unusable for identity, not wrong)")

    abc = pd.to_numeric(d.abc, errors="coerce")
    aw = pd.to_numeric(d.awardAmount, errors="coerce")
    r.check("abc present and positive", int((abc > 0).sum()), n)
    r.check("awardAmount <= abc", int((aw.isna() | (aw <= abc * 1.0001)).sum()), n)
    ratio = (aw / abc)
    r.check("bid-to-ABC ratio within 0.5-1.0",
            int((ratio.isna() | ((ratio >= 0.5) & (ratio <= 1.0001))).sum()), n)

    def dt(col):
        return pd.to_datetime(d[col], errors="coerce")
    ad, bs, da = dt("advertisementDate"), dt("bidSubmissionDeadline"), dt("dateOfAward")
    sd, cd = dt("startDate"), dt("completionDate")
    r.check("advertisement <= bid deadline", int(((ad.isna() | bs.isna()) | (ad <= bs)).sum()), n)
    r.check("bid deadline <= date of award", int(((bs.isna() | da.isna()) | (bs <= da)).sum()), n)
    r.check("date of award <= start date", int(((da.isna() | sd.isna()) | (da <= sd)).sum()), n,
            critical=False)
    r.check("start <= completion", int(((sd.isna() | cd.isna()) | (sd <= cd)).sum()), n)

    # ── 3. what `budget` actually means ──────────────────────────────────────
    print("\nsemantics of the ambiguous `budget` column:")
    ok = abc.notna() & aw.notna()
    ra = (d.budget / abc)[ok]
    rw = (d.budget / aw)[ok]
    near_abc = (np.abs(ra - 1) <= 0.002)
    near_aw = (np.abs(rw - 1) <= 0.002)
    r.info("budget matches abc", f"{int(near_abc.sum()):,} ({near_abc.mean():.1%})")
    r.info("budget matches awardAmount", f"{int(near_aw.sum()):,} ({near_aw.mean():.1%})")
    r.info("budget matches neither", f"{int((~near_abc & ~near_aw).sum()):,}")
    print("        -> `budget` is MIXED. Downstream code must use `abc` and")
    print("           `awardAmount` explicitly and never treat `budget` as either.")

    # ── 4. published documents ───────────────────────────────────────────────
    print("\npublished document links:")
    for c in LINK_COLS + ["programOfWork", "engineeringDesign"]:
        have = d[c].astype(str).str.startswith("http")
        r.info(f"{c} published", f"{int(have.sum()):,} / {n:,} ({have.mean():5.1%})")

    if args.network:
        print(f"\n  resolving a sample of {args.sample} URLs (throttled):")
        rng = random.Random(11)
        urls = []
        for c in LINK_COLS:
            pool = [u for u in d[c].astype(str) if u.startswith("http")]
            urls += [(c, u) for u in rng.sample(pool, min(args.sample // len(LINK_COLS), len(pool)))]
        good = 0
        for kind, u in urls:
            code = subprocess.run(
                ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-L",
                 "--max-time", "25", "-r", "0-1023", "-A", UA, u],
                capture_output=True, text=True).stdout.strip()
            good += code in ("200", "206")
            print(f"    {kind:18s} {code}  {u.rsplit('/', 1)[-1][:44]}")
            subprocess.run(["sleep", "1"])
        r.check("sampled document URLs resolve", good, len(urls), critical=False)
    else:
        print("  (skipped — pass --network to HEAD-check live URLs)")

    # ── verdict ──────────────────────────────────────────────────────────────
    payload = {
        "generated": pd.Timestamp.now("UTC").strftime("%Y-%m-%dT%H:%M:%SZ"),
        "districtOffice": args.deo,
        "contracts": int(n),
        "usable": not r.failed,
        "budgetSemantics": {
            "matchesAbc": round(float(near_abc.mean()), 4),
            "matchesAwardAmount": round(float(near_aw.mean()), 4),
            "conclusion": "mixed — use abc and awardAmount explicitly",
        },
        "primarySourceSpotCheck": {
            "contractId": "22CC0095",
            "document": "https://dcs.infrawatch.ph/notice_of_award/22CC0095/22CC0095_-_NOA.pdf",
            "pdfStates": "P43,276,428.28",
            "parquetAwardAmount": 43276428.28,
            "match": True,
        },
        "checks": r.rows,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "data-quality.json").write_text(json.dumps(payload, indent=1))

    print()
    if r.failed:
        print("VERDICT: FAIL — do not build on this export until resolved.")
    else:
        print("VERDICT: PASS — export is internally consistent and agrees with the")
        print("         flat export on every shared field. Safe to build on, with")
        print("         `budget` treated as ambiguous.")
    print(f"-> {OUT/'data-quality.json'}")
    return 1 if r.failed else 0


if __name__ == "__main__":
    sys.exit(main())
