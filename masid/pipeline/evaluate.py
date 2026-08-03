#!/usr/bin/env python3
"""
Which change statistic, if any, can actually see a flood control structure?

The first satellite run fired on 7.7% of ordinary completed contracts. Those are
projects that were, in the main, built — so that number is a recall failure, and
it needs no assumption about whether flagged records are ghosts. Something is
wrong with the measurement, not with Bulacan.

The suspected cause is dilution: a revetment is metres wide and a 30 m disc holds
~28 pixels of floodplain, so averaging buries the structure under seasonal noise.
This script tests that hypothesis by swapping the statistic and nothing else.

  disc-mean   mean over the whole disc            (what the first run used)
  tail        mean of the most-changed fifth      (structure covers part of it)
  core        the 3x3 touching the coordinate     (assumes the coordinate is good)
  patch       most-changed 3x3 anywhere in disc   (small structure, position free)

PRIMARY METRIC IS RECALL ON PRESUMED-BUILT CONTRACTS.
Not the flagged-vs-control gap. Treating flagged records as ghosts would assume
the very thing the thesis is trying to establish; "did this fire on a completed,
unflagged, well-observed contract" assumes nothing. A statistic that cannot see
construction where construction almost certainly happened cannot be trusted to
report its absence anywhere else.

Reads the same scene cache pipeline/satellite.py populates, so this costs no
network and no imagery is re-fetched. Run satellite.py at least once first.

USAGE
  python3 pipeline/evaluate.py [--limit N] [--controls N]
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import satellite as S  # noqa: E402  (sets GDAL env before importing rasterio)

STATS = ("disc-mean", "tail", "core", "patch")


def collect(limit: int, controls: int):
    """Rebuild the before/after composites for the same selection satellite.py uses.

    Deliberately re-derives the selection with the same seed rather than reading
    satellite.json, so the comparison covers identical records."""
    projects = json.loads((S.DATA / "projects.json").read_text())
    assessable = []
    for p in projects:
        if p["lat"] is None or p["lng"] is None or p["geocodedMunicipality"] is None:
            continue
        per = S.periods_for(p)
        if per is None:
            continue
        assessable.append((p, per))

    flagged = sorted((a for a in assessable if a[0]["auditFlags"]),
                     key=lambda a: (-a[0]["auditScore"], -a[0]["budget"]))
    clean = [a for a in assessable if not a[0]["auditFlags"]]
    import random
    rng = random.Random(20260803)
    selected = flagged[:limit] + rng.sample(clean, min(controls, len(clean)))

    def bucket(d0, d1):
        return f"{d0.year}Q{(d0.month-1)//3+1}_{d1.year}Q{(d1.month-1)//3+1}"

    groups = defaultdict(list)
    for p, (before, after) in selected:
        groups[("before", bucket(*before))].append((p, before))
        groups[("after", bucket(*after))].append((p, after))

    radius = S.CONTROL_OUTER_M
    out = defaultdict(dict)
    missing = 0
    for (phase, _key), members in sorted(groups.items()):
        pts = [(p["id"], p["lat"], p["lng"]) for p, _ in members]
        lons = [p["lng"] for p, _ in members]
        lats = [p["lat"] for p, _ in members]
        pad = 0.01
        bbox = (min(lons) - pad, min(lats) - pad, max(lons) + pad, max(lats) + pad)
        d0 = min(w[0] for _, w in members)
        d1 = max(w[1] for _, w in members)
        scenes = S.search_scenes(bbox, d0, d1)[:S.MAX_SCENES]

        per_scene = []
        for scene in scenes:
            ck = f"{scene['id']}|{radius}|{','.join(S.BANDS)}"
            cp = S.cache_path("scene", ck).with_suffix(".npz")
            if not cp.exists():
                missing += 1
                continue
            try:
                per_scene.append(dict(np.load(cp, allow_pickle=True)["d"].item()))
            except Exception:
                missing += 1

        for pid, *_ in pts:
            samples = [sc[pid] for sc in per_scene if pid in sc]
            if not samples:
                continue
            comp = S.composite(samples)
            if comp is None:
                continue
            out[pid][phase] = {
                "ndvi": comp["ndvi"], "ndbi": comp["ndbi"],
                "res": samples[0].get("res", 10.0), "coverage": comp["coverage"],
            }

    by_id = {p["id"]: p for p, _ in selected}
    if missing:
        print(f"note: {missing} scene(s) not in cache — run satellite.py first for full coverage\n")
    return out, by_id


def sweep(grids, by_id, stat: str, thresholds=(1.0, 1.5, 2.0, 2.5)):
    """Recall on presumed-built contracts as the threshold is relaxed.

    If recall stays low even at 1.0 sigma — where roughly a sixth of null discs
    fire by chance per index — then no threshold makes this usable, and the
    failure is not a tuning choice."""
    import zlib
    per_rec = []
    for pid, r in grids.items():
        if "before" not in r or "after" not in r or by_id[pid]["auditFlags"]:
            continue                      # presumed-built only
        b, a = r["before"], r["after"]
        rng = np.random.default_rng(zlib.crc32(pid.encode()))
        nd, _ = S.change_z(b["ndvi"], a["ndvi"], b["res"], rng, stat=stat, sign=-1)
        rng = np.random.default_rng(zlib.crc32(pid.encode()))
        nb, _ = S.change_z(b["ndbi"], a["ndbi"], b["res"], rng, stat=stat, sign=+1)
        if not nd or not nb:
            continue
        pairs = [(nd[k]["z"], nb[k]["z"]) for k in nd if nd.get(k) and nb.get(k)]
        if pairs:
            per_rec.append(pairs)

    out = {}
    for t in thresholds:
        hit = sum(1 for pairs in per_rec
                  if any(z1 <= -t and z2 >= t for z1, z2 in pairs))
        out[t] = {"n": len(per_rec), "fired": hit,
                  "recall": hit / len(per_rec) if per_rec else None}
    return out


def score(grids, by_id, stat: str):
    """Detection rate per group under one statistic, plus median strength."""
    import zlib
    fired = {"flagged": [], "control": []}
    zs = {"flagged": [], "control": []}

    for pid, r in grids.items():
        if "before" not in r or "after" not in r:
            continue
        b, a = r["before"], r["after"]
        rng = np.random.default_rng(zlib.crc32(pid.encode()))
        nd, _ = S.change_z(b["ndvi"], a["ndvi"], b["res"], rng, stat=stat, sign=-1)
        rng = np.random.default_rng(zlib.crc32(pid.encode()))
        nb, _ = S.change_z(b["ndbi"], a["ndbi"], b["res"], rng, stat=stat, sign=+1)
        if not nd or not nb:
            continue
        usable = [k for k in nd if nd.get(k) and nb.get(k)]
        if not usable:
            continue

        hit = any(nd[k]["z"] <= S.NDVI_Z and nb[k]["z"] >= S.NDBI_Z for k in usable)
        grp = "flagged" if by_id[pid]["auditFlags"] else "control"
        fired[grp].append(hit)
        if nd.get("r30"):
            zs[grp].append(nd["r30"]["z"])

    def pack(g):
        n = len(fired[g])
        return {
            "n": n,
            "fired": sum(fired[g]),
            "rate": (sum(fired[g]) / n) if n else None,
            "medianZ": float(np.median(zs[g])) if zs[g] else None,
        }

    return {"flagged": pack("flagged"), "control": pack("control")}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=140)
    ap.add_argument("--controls", type=int, default=60)
    args = ap.parse_args()

    print("Rebuilding composites from cache…\n")
    grids, by_id = collect(args.limit, args.controls)
    print(f"{len(grids)} records with both periods available\n")

    print(f"{'statistic':<12} {'RECALL on presumed-built':<26} {'flagged':<14} verdict")
    print("-" * 78)
    rows = {}
    for stat in STATS:
        r = score(grids, by_id, stat)
        rows[stat] = r
        c, f = r["control"], r["flagged"]
        recall = f"{c['fired']}/{c['n']} = {(c['rate'] or 0):6.1%}" if c["n"] else "—"
        fl = f"{f['fired']}/{f['n']} = {(f['rate'] or 0):5.1%}" if f["n"] else "—"
        # Recall is the bar. Below ~50% the statistic cannot see construction it
        # should be seeing, and its silences mean nothing.
        note = ("usable" if (c["rate"] or 0) >= 0.5 else
                "weak" if (c["rate"] or 0) >= 0.25 else "cannot see construction")
        print(f"{stat:<12} {recall:<26} {fl:<14} {note}")

    print()
    print("Recall on presumed-built as the threshold is relaxed:")
    print(f"{'statistic':<12}" + "".join(f"{t}σ".rjust(10) for t in (1.0, 1.5, 2.0, 2.5)))
    print("-" * 78)
    sweeps = {}
    for stat in STATS:
        sw = sweep(grids, by_id, stat)
        sweeps[stat] = sw
        print(f"{stat:<12}" + "".join(f"{(sw[t]['recall'] or 0):9.1%} " for t in (1.0, 1.5, 2.0, 2.5)))
    print("(at 1.0σ roughly a sixth of null discs fire by chance, per index)")

    best = max(STATS, key=lambda k: rows[k]["control"]["rate"] or 0)
    br = rows[best]["control"]["rate"] or 0
    print()
    print(f"best statistic: {best}  (recall {br:.1%} on presumed-built contracts)")
    if br < 0.5:
        print("\nNo statistic reaches usable recall. The limit is the sensor, not the")
        print("estimator: at 10 m a metres-wide revetment does not separate from")
        print("floodplain seasonality however the disc is reduced. Next lever is")
        print("resolution (3 m PlanetScope) or a different physics (Sentinel-1 SAR),")
        print("not another statistic.")

    (S.DATA / "stat-comparison.json").write_text(json.dumps({
        "primaryMetric": "recall on presumed-built contracts (completed, unflagged)",
        "thresholds": {"ndviZ": S.NDVI_Z, "ndbiZ": S.NDBI_Z},
        "statistics": rows,
        "thresholdSweep": {k: {str(t): v for t, v in sw.items()} for k, sw in sweeps.items()},
        "best": best,
        "usable": br >= 0.5,
    }, indent=1))
    print(f"\n-> {S.DATA/'stat-comparison.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
