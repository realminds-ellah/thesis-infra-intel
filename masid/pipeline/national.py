#!/usr/bin/env python3
"""
Every district engineering office in the country, on the same indicators.

WHY THIS EXISTS

  This project is a case study of one office, and a case study invites the
  fairest possible objection: how do you know 38.4% of contracts awarded at
  exactly 96.00% of the approved budget is unusual, rather than simply how DPWH
  procurement works everywhere?

  The procurement pipeline already answered that for one number — it computes a
  national baseline before narrowing — but the comparison was never shipped. So
  a reader in Cebu or Davao opening this tool learns nothing about their own
  district, and a panel cannot see the distribution the ranking came from.

  This computes the same indicators for all 216 offices, so "rank 1 of 48" stops
  being an assertion and becomes a table anyone can scroll.

WHAT IS AND IS NOT COMPARED

  Only PROCUREMENT indicators, because only those are computable nationally from
  the same export. The records-side consistency checks need municipal boundary
  geometry, which this project ships for Bulacan alone; running them nationally
  would need every province's ADM3 polygons and is a different piece of work.

  Offices with very few contracts are kept but marked. A 100% rate over three
  contracts is not evidence of anything, and hiding those rows would quietly
  flatter the ranking by removing its noisiest members rather than labelling them.

SOURCE
  data/dpwh_all_details.parquet — the DPWH detail export via BetterGov,
  CC0-1.0. Same file the single-office procurement tier reads.

USAGE
  python3 pipeline/national.py
"""

from __future__ import annotations

import json
import re
import sys
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "dpwh_all_details.parquet"
OUT = ROOT / "src" / "app" / "data" / "national.json"

MIN_FOR_RANK = 30      # below this, a rate is noise; kept, flagged, not ranked


def parse_amount(v) -> float:
    """Thousands separators arrive as strings and silently become NaN."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return float("nan")
    if isinstance(v, (int, float)):
        return float(v)
    s = re.sub(r"[^\d.\-]", "", str(v))
    try:
        return float(s)
    except ValueError:
        return float("nan")


def main() -> int:
    if not SRC.exists():
        print(f"missing {SRC} — the national export is not on disk", file=sys.stderr)
        return 1

    print("reading the national detail export…")
    df = pd.read_parquet(SRC, columns=[
        "contractId", "category", "province", "region", "contractor",
        "abc", "awardAmount", "bidders", "latitude", "longitude", "infraYear",
    ])
    flood = df[df.category.astype(str).str.contains("Flood", case=False, na=False)].copy()
    print(f"  {len(flood):,} flood-control contracts, {flood.province.nunique()} offices")

    flood["abcN"] = flood.abc.map(parse_amount)
    flood["awN"] = flood.awardAmount.map(parse_amount)
    ok = flood.abcN.gt(0) & flood.awN.gt(0)
    flood["ratio"] = (flood.awN / flood.abcN).where(ok)

    # Exactly a whole percentage of the ceiling, and the 96.00% case specifically.
    pct = flood.ratio * 100
    flood["whole"] = ok & (pct - pct.round()).abs().lt(0.01)
    flood["at96"] = ok & (pct - 96.0).abs().lt(0.01)
    flood["nbid"] = flood.bidders.map(lambda b: len(b) if hasattr(b, "__len__") else 0)
    flood["hasCoord"] = flood.latitude.notna() & flood.longitude.notna()

    rows = []
    for name, g in flood.groupby("province", dropna=True):
        n = len(g)
        withratio = int(g.ratio.notna().sum())
        rows.append({
            "office": str(name),
            "region": str(g.region.mode().iloc[0]) if g.region.notna().any() else None,
            "contracts": n,
            "value": round(float(g.awN.fillna(0).sum()), 2),
            "contractors": int(g.contractor.nunique()),
            "withRatio": withratio,
            "at96": int(g.at96.sum()),
            "at96Rate": round(float(g.at96.sum() / withratio), 4) if withratio else None,
            "wholePctRate": round(float(g.whole.sum() / withratio), 4) if withratio else None,
            "singleBidderRate": round(float((g.nbid == 1).sum() / n), 4) if n else None,
            "coordRate": round(float(g.hasCoord.sum() / n), 4) if n else None,
            "rankable": withratio >= MIN_FOR_RANK,
        })

    # Rank on the 96.00% rate, over offices with enough contracts to mean anything.
    rankable = [r for r in rows if r["rankable"] and r["at96Rate"] is not None]
    rankable.sort(key=lambda r: -r["at96Rate"])
    for i, r in enumerate(rankable, 1):
        r["rankAt96"] = i
    for r in rows:
        r.setdefault("rankAt96", None)
    rows.sort(key=lambda r: (-(r["at96Rate"] or 0), -r["contracts"]))

    tot_ratio = int(flood.ratio.notna().sum())
    national = {
        "contracts": len(flood),
        "offices": int(flood.province.nunique()),
        "value": round(float(flood.awN.fillna(0).sum()), 2),
        "at96Rate": round(float(flood.at96.sum() / tot_ratio), 4) if tot_ratio else None,
        "wholePctRate": round(float(flood.whole.sum() / tot_ratio), 4) if tot_ratio else None,
        "singleBidderRate": round(float((flood.nbid == 1).sum() / len(flood)), 4),
        "coordRate": round(float(flood.hasCoord.sum() / len(flood)), 4),
    }

    print(f"nationally: {national['at96Rate']:.2%} at 96.00%, "
          f"{national['singleBidderRate']:.2%} single-bidder, "
          f"{national['coordRate']:.1%} publish a coordinate")
    print(f"rankable offices (>= {MIN_FOR_RANK} priced contracts): {len(rankable)}")
    print("top 5 by share awarded at exactly 96.00%:")
    for r in rankable[:5]:
        print(f"  {r['rankAt96']:>2}. {r['office']:<34} {r['at96Rate']:.1%}  ({r['at96']}/{r['withRatio']})")

    OUT.write_text(json.dumps({
        "generated": datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "source": "DPWH detail export via BetterGov (CC0-1.0)",
        "note": ("Procurement indicators only. The records-side consistency checks need "
                 "municipal boundary geometry, which this project ships for Bulacan alone. "
                 "Offices with fewer than "
                 f"{MIN_FOR_RANK} priced contracts are listed but not ranked: a rate over "
                 "a handful of contracts is noise, and dropping those rows would flatter "
                 "the ranking rather than label it."),
        "minContractsForRank": MIN_FOR_RANK,
        "national": national,
        "offices": rows,
    }, indent=1) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
