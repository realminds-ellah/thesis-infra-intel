#!/usr/bin/env python3
"""
The ground a contract claims to cover, as a polygon.

THE PROBLEM

  A flood-control contract states how much work it is: "CONSTRUCTION OF
  REVETMENT ALONG GUIGUINTO RIVER, STA 0+000 TO STA 0+780" is 780 metres of
  riverbank. The register publishes ONE POINT for that, so the map showed a dot,
  and a dot cannot distinguish a 30 m repair from a two-kilometre stretch.

  The obvious fix — draw a line of the stated length — needs a direction, and the
  record has none. Drawing it in a guessed direction would invent the one fact
  the shape appears to assert, which is why the first version of this drew a
  circle of half the stated length instead: honest about scale, silent about
  where.

THE FIX

  Flood-control work is not scattered across a field. A revetment, a river wall,
  a slope protection or a dredging section follows a WATERCOURSE, and the
  watercourse geometry is public. So the direction does not have to be guessed —
  it can be looked up.

  For each contract with a stated length: find the nearest mapped waterway,
  project the published point onto it, walk half the stated length in each
  direction along the channel, and buffer that stretch into a corridor. The
  result is a polygon that follows the river the contract names, is exactly as
  long as the contract says, and is centred where DPWH put the point.

WHAT THIS IS, AND IS NOT

  It is an INFERENCE and is labelled as one everywhere it is drawn. Specifically:

  - The work may be on ONE BANK; this corridor covers both, because which bank
    is not published either.
  - The nearest waterway may not be the one the contract names. `waterwayName`
    is emitted so a reader can check it against the description themselves.
  - `metresToWaterway` is emitted for the same reason, and is worth reading on
    its own: a flood-control coordinate that is 400 m from any mapped water is a
    fact about that coordinate regardless of what shape gets drawn.
  - Where no waterway is within reach, or the contract states no length, NO
    polygon is produced. The app falls back to saying the extent is not
    published rather than drawing something it cannot support.

SOURCES
  OpenStreetMap waterways (river, stream, canal, drain) via Overpass API.
  ODbL 1.0 — © OpenStreetMap contributors. Geometry only; no tags are shipped
  beyond the name and class of the matched channel.

USAGE
  python3 pipeline/scope.py                 # fetch, match, write scope.json
  python3 pipeline/scope.py --cache ow.json # reuse a saved Overpass response
"""

from __future__ import annotations

import argparse
import json
import math
import ssl
import sys
import urllib.request
from pathlib import Path

from shapely.geometry import LineString, Point
from shapely.ops import linemerge, substring, transform
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "app" / "data" / "scope.json"
PROJECTS = ROOT / "src" / "app" / "data" / "projects.json"

# Bulacan plus a margin, so a channel crossing the provincial line is still whole.
BBOX = (14.65, 120.60, 15.10, 121.10)
ENDPOINTS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
SEARCH_RADIUS_M = 500     # beyond this, the point is not plausibly on this channel
CORRIDOR_HALF_W = 18      # metres either side — a channel plus its working width
MAX_CORRIDOR_HALF_W = 40

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()


def fetch_waterways() -> dict:
    q = ("[out:json][timeout:180];"
         '(way["waterway"~"^(river|stream|canal|drain)$"]'
         f"({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]}););out geom;")
    last = None
    for ep in ENDPOINTS:
        try:
            print(f"  trying {ep.split('/')[2]} …")
            req = urllib.request.Request(ep, data=q.encode(),
                                         headers={"User-Agent": "masid-thesis/1.0"})
            with urllib.request.urlopen(req, timeout=240, context=SSL_CTX) as r:
                return json.loads(r.read())
        except Exception as e:      # 504s are routine on the public instances
            last = e
            print(f"    {type(e).__name__}: {e}")
    raise SystemExit(f"every Overpass endpoint failed: {last}")


def metric_frame(lat0: float, lng0: float):
    """
    Local equirectangular projection in metres about a point.

    Buffering and measuring along a line both need real distances, and degrees
    are not distances. Over the few hundred metres this works at, the distortion
    is far below the 8 m positional accuracy of the imagery anyone will compare
    the result against.
    """
    R = 6378137.0
    k = math.cos(math.radians(lat0))
    fwd = lambda x, y: ((x - lng0) * math.radians(1) * R * k, (y - lat0) * math.radians(1) * R)
    inv = lambda x, y: (lng0 + x / (math.radians(1) * R * k), lat0 + y / (math.radians(1) * R))
    return (lambda g: transform(lambda a, b: fwd(a, b), g),
            lambda g: transform(lambda a, b: inv(a, b), g))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", help="a saved Overpass JSON response")
    args = ap.parse_args()

    if args.cache and Path(args.cache).exists():
        print(f"reading cached waterways from {args.cache}")
        raw = json.loads(Path(args.cache).read_text())
    else:
        print("fetching OpenStreetMap waterways over Bulacan…")
        raw = fetch_waterways()
        if args.cache:
            Path(args.cache).write_text(json.dumps(raw))

    ways, meta = [], []
    for el in raw.get("elements", []):
        g = el.get("geometry") or []
        if len(g) < 2:
            continue
        ways.append(LineString([(p["lng"] if "lng" in p else p["lon"], p["lat"]) for p in g]))
        t = el.get("tags", {})
        meta.append({"name": t.get("name"), "class": t.get("waterway")})
    print(f"  {len(ways)} channels, {sum(len(w.coords) for w in ways):,} vertices")

    tree = STRtree(ways)

    rows = json.loads(PROJECTS.read_text())
    rows = rows if isinstance(rows, list) else rows["projects"]
    todo = [p for p in rows if p.get("lengthMetres") and p.get("lat") is not None]
    print(f"{len(todo)} contracts state a length and publish a coordinate")

    out, no_channel, truncated = [], 0, 0
    for p in todo:
        lat, lng, L = float(p["lat"]), float(p["lng"]), float(p["lengthMetres"])
        to_m, to_deg = metric_frame(lat, lng)
        here = Point(0.0, 0.0)                       # the contract point, in metres

        # Candidate channels: a generous degree box, then real distances.
        deg = SEARCH_RADIUS_M / 111_000 * 2
        idx = tree.query(Point(lng, lat).buffer(deg))
        cands = [ways[i] for i in idx] if len(idx) else []
        if not cands:
            no_channel += 1
            continue

        merged = linemerge([to_m(c) for c in cands])
        parts = list(merged.geoms) if merged.geom_type == "MultiLineString" else [merged]
        best, best_d = None, float("inf")
        for ln in parts:
            d = ln.distance(here)
            if d < best_d:
                best, best_d = ln, d
        if best is None or best_d > SEARCH_RADIUS_M:
            no_channel += 1
            continue

        # Walk half the stated length each way from the projected position.
        at = best.project(here)
        a, b = at - L / 2, at + L / 2
        if a < 0 or b > best.length:
            truncated += 1
        seg = substring(best, max(0.0, a), min(best.length, b))
        if seg.is_empty or seg.length < 5:
            no_channel += 1
            continue

        # Wider for longer works: a 2 km river wall is not an 18 m ribbon.
        half_w = min(MAX_CORRIDOR_HALF_W, max(CORRIDOR_HALF_W, L * 0.02))
        poly = to_deg(seg.buffer(half_w, cap_style=2, join_style=2))

        # Which channel it landed on — for the reader to check against the title.
        near_i = min(range(len(ways)), key=lambda i: ways[i].distance(Point(lng, lat)))
        out.append({
            "id": p["id"],
            "lengthMetres": round(L),
            "metresToWaterway": round(best_d),
            "waterwayName": meta[near_i]["name"],
            "waterwayClass": meta[near_i]["class"],
            "coveredMetres": round(seg.length),
            "ring": [[round(x, 6), round(y, 6)] for x, y in poly.exterior.coords],
        })

    far = [r for r in out if r["metresToWaterway"] > 100]
    print(f"corridors built            {len(out)}")
    print(f"  no mapped channel within {SEARCH_RADIUS_M} m   {no_channel}")
    print(f"  channel ran out, corridor truncated   {truncated}")
    print(f"  point further than 100 m from water   {len(far)}")

    OUT.write_text(json.dumps({
        "generated": __import__("datetime").datetime.now(__import__("datetime").UTC)
                        .isoformat(timespec="seconds").replace("+00:00", "Z"),
        "source": "OpenStreetMap waterways via Overpass API",
        "licence": "ODbL 1.0 — © OpenStreetMap contributors",
        "method": ("The published point projected onto the nearest mapped watercourse, "
                   "then half the contract's stated length walked along the channel in "
                   "each direction and buffered. An INFERENCE: the record publishes a "
                   "point and a length but no direction and no bank."),
        "searchRadiusMetres": SEARCH_RADIUS_M,
        "counts": {"corridors": len(out), "noChannel": no_channel,
                   "truncated": truncated, "over100mFromWater": len(far)},
        "corridors": out,
    }, indent=1) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
