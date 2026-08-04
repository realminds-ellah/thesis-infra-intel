#!/usr/bin/env python3
"""
Flood hazard join — is the flood control where the flooding is?

For a flood-control register this is the question the money is supposed to
answer, and until now nothing in MASID asked it. Every contract coordinate is
tested against the modelled 100-year flood extent, and for those outside it the
distance to the nearest hazard polygon is measured, so "thirty metres outside"
is not confused with "five kilometres outside".

SOURCE
  bettergovph/project-noah-hazard-maps -> Flood/100yr/Bulacan.zip
  UP NOAH (Nationwide Operational Assessment of Hazards), via BetterGov.
  Shapefile, GCS_WGS_1984 — the same datum as the DPWH coordinates, so the join
  needs no reprojection. `Var` is the hazard level: 1 low, 2 medium, 3 high.

WHAT A RESULT DOES AND DOES NOT MEAN

  "Outside the modelled extent" is NOT "unnecessary". A revetment or floodwall
  legitimately sits at the EDGE of a flood zone — that is where you build one —
  and the model's boundary is itself an approximation. NOAH also models fluvial
  flooding from river systems and does not claim to cover every drainage or
  coastal mechanism.

  What the measure is good for is the far tail: a contract kilometres from any
  modelled flood extent is worth a question, and the distance figure is reported
  precisely so that question can be asked at the right contracts rather than at
  all 309.

PERFORMANCE
  The shapefile decomposes into ~262,000 polygon parts and takes about nine
  minutes to parse. The result is cached per contract, so this runs once.

USAGE
  python3 pipeline/hazard.py
"""

from __future__ import annotations

import io
import json
import math
import subprocess
import sys
import time
import zipfile
from collections import Counter
from pathlib import Path

import shapefile
from shapely.geometry import Point, shape as to_shape
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data"
OUT = ROOT / "src" / "app" / "data"

URL = ("https://huggingface.co/datasets/bettergovph/project-noah-hazard-maps/"
       "resolve/main/Flood/100yr/Bulacan.zip")
ZIP = CACHE / "noah_flood_100yr_bulacan.zip"
STEM = "Bulacan_Flood_100year"

LEVELS = {0: "none", 1: "low", 2: "medium", 3: "high"}

# Far enough from any modelled flood extent that the siting is worth a question.
# A structure at the edge of a flood zone is normal; one this far out is not
# obviously flood control at all.
FAR_METRES = 1000


def fetch() -> Path:
    if ZIP.exists() and ZIP.stat().st_size > 0:
        print(f"  cached  {ZIP.name} ({ZIP.stat().st_size/1e6:.0f} MB)")
        return ZIP
    ZIP.parent.mkdir(parents=True, exist_ok=True)
    print(f"  fetch   {URL}")
    subprocess.run(["curl", "-fsSL", "-A", "masid-pipeline", "-o", str(ZIP), URL], check=True)
    return ZIP


def main() -> int:
    projects = json.loads((OUT / "projects.json").read_text())

    print("NOAH 100-year flood hazard, Bulacan")
    fetch()
    t = time.time()
    z = zipfile.ZipFile(ZIP)
    r = shapefile.Reader(
        shp=io.BytesIO(z.read(f"{STEM}.shp")),
        dbf=io.BytesIO(z.read(f"{STEM}.dbf")),
        shx=io.BytesIO(z.read(f"{STEM}.shx")),
    )
    polys, lvl = [], []
    for i in range(len(r)):
        g = to_shape(r.shape(i).__geo_interface__)
        parts = list(g.geoms) if g.geom_type == "MultiPolygon" else [g]
        level = int(r.record(i)[0])
        for q in parts:
            polys.append(q)
            lvl.append(level)
    print(f"  {len(polys):,} polygon parts parsed in {time.time()-t:.0f}s")

    tree = STRtree(polys)
    print("  spatial index built")

    results, tally = [], Counter()
    for p in projects:
        if p["lat"] is None or p["lng"] is None:
            tally["no coordinate"] += 1
            results.append({"id": p["id"], "hazard": None, "level": None, "metresToHazard": None})
            continue

        pt = Point(p["lng"], p["lat"])
        best = 0
        for i in tree.query(pt):
            if polys[i].contains(pt):
                best = max(best, lvl[i])

        dist_m = 0.0
        if best == 0:
            # Nearest hazard polygon, converted to metres at this latitude. The
            # index makes this cheap even against a quarter-million parts.
            j = tree.nearest(pt)
            d_deg = polys[j].distance(pt)
            dist_m = d_deg * 111_320 * math.cos(math.radians(float(p["lat"])))

        tally[LEVELS[best] if best else ("far outside" if dist_m > FAR_METRES else "just outside")] += 1
        results.append({
            "id": p["id"],
            "hazard": LEVELS[best],
            "level": best,
            "metresToHazard": None if best else round(dist_m),
        })

    outside = [r_ for r_ in results if r_["level"] == 0]
    far = [r_ for r_ in outside if (r_["metresToHazard"] or 0) > FAR_METRES]

    print("\nprojects by modelled 100-year flood hazard at their coordinate:")
    for k in ("high", "medium", "low", "just outside", "far outside", "no coordinate"):
        if tally[k]:
            print(f"  {k:16s} {tally[k]:5,} ({tally[k]/len(projects):5.1%})")
    if far:
        ds = sorted((r_["metresToHazard"] or 0) for r_ in far)
        print(f"\n  {len(far)} contracts sit more than {FAR_METRES} m from any modelled")
        print(f"  flood extent — median {ds[len(ds)//2]:,} m, max {ds[-1]:,} m.")
        print("  Being outside the model is not proof of anything: structures are")
        print("  built at the edge of flood zones by design. The distance is here so")
        print("  the question gets asked at the right contracts.")

    payload = {
        "generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": {
            "name": "UP NOAH 100-year flood hazard, Bulacan",
            "dataset": "bettergovph/project-noah-hazard-maps",
            "file": "Flood/100yr/Bulacan.zip",
            "url": "https://huggingface.co/datasets/bettergovph/project-noah-hazard-maps",
            "crs": "GCS_WGS_1984 — same datum as the DPWH coordinates, no reprojection",
            "polygonParts": len(polys),
        },
        "caveat": (
            "Outside the modelled extent is not 'unnecessary'. A revetment or "
            "floodwall belongs at the edge of a flood zone, and the model boundary "
            "is itself approximate. NOAH models fluvial flooding and does not claim "
            "to cover every drainage or coastal mechanism."
        ),
        "farThresholdMetres": FAR_METRES,
        "tally": dict(tally),
        "results": results,
    }
    (OUT / "hazard.json").write_text(json.dumps(payload, indent=1))
    print(f"\n-> {OUT/'hazard.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
