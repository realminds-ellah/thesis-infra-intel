#!/usr/bin/env python3
"""
Esri Wayback — the dated high-resolution imagery archive over Bulacan.

WHAT THIS SOLVES

  The satellite tier in this project runs on Sentinel-2 at 10 m per pixel, which
  is wider than most of the structures in the register, and its own validation
  says it cannot tell flagged contracts from ordinary ones. The imagery a person
  CAN read a revetment off is the sub-metre basemap the map already draws — but
  that basemap is a single current mosaic with no history and no dates, so it
  answers "what is there now" and nothing about when it appeared.

  Esri archives every past version of that mosaic as a separately addressable
  tile layer. Resolved against a coordinate, those versions become a dated stack:
  the same patch of riverbank photographed repeatedly over a decade.

HOW A VERSION IS FOUND, which is not obvious

  Requesting a tile for release N returns 301 REDIRECTING to whichever release
  actually holds imagery for that tile. Most of the ~196 global releases have
  never re-flown Bulacan, so they all redirect to the same handful. Following the
  redirect and collecting distinct targets is what collapses 196 releases into
  the ~28 real photographs — there is no endpoint that simply lists them.

SOURCES
  Release catalogue
    https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json
  Tiles
    https://wayback.maptiles.arcgis.com/.../MapServer/tile/{release}/{z}/{row}/{col}
  Per-point acquisition metadata (flight date, resolution, accuracy, provider)
    the metadataLayerUrl carried by each release in the catalogue above

  Imagery is Esri World Imagery — Maxar, Earthstar Geographics and others. It is
  SERVED LIVE to the browser and never redistributed by this project; the app
  carries the attribution Esri requires. Anything published beyond research
  should be checked against Esri's current terms of use.

WHAT THE OUTPUT IS HONEST ABOUT

  Roughly 28 frames across twelve years is about 2.3 a year, and there is a
  two-and-a-half-year gap between Nov 2014 and Feb 2017. A flood-control contract
  runs six to twelve months, so a typical one is covered by TWO OR THREE frames.
  That supports "did a structure appear between award and completion" and does
  not support "how far along was it in March". The app states this where the
  slider is drawn; the number of frames inside each contract window is written
  into the output so the claim can be checked rather than trusted.

USAGE
  python3 pipeline/wayback.py            # sample points, write the release list
  python3 pipeline/wayback.py --probe N  # widen the sample to N points
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import ssl
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "app" / "data" / "wayback.json"
PROJECTS = ROOT / "src" / "app" / "data" / "projects.json"

CONFIG_URL = "https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json"

# python.org builds on macOS ship without a usable trust store, so every HTTPS
# call fails on certificate verification until one is pointed at explicitly.
# certifi's bundle if it is installed, the system default otherwise — never an
# unverified context, which would silently accept anything.
try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()
ZOOM = 16          # the level a structure is legible at; also what the app opens on
TIMEOUT = 25


def get(url: str, timeout: int = TIMEOUT) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "masid-thesis/1.0"})
    with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as r:
        return r.read()


def tile_xy(lat: float, lng: float, z: int) -> tuple[int, int]:
    """Web Mercator tile row/col. Standard slippy-map maths."""
    n = 2 ** z
    col = int((lng + 180.0) / 360.0 * n)
    lat_r = math.radians(lat)
    row = int((1.0 - math.log(math.tan(lat_r) + 1 / math.cos(lat_r)) / math.pi) / 2.0 * n)
    return row, col


def load_catalogue() -> list[dict]:
    """Every Wayback release that carries a parseable date, newest first."""
    cfg = json.loads(get(CONFIG_URL, timeout=60))
    out = []
    for v in cfg.values():
        d = re.search(r"(\d{4}-\d{2}-\d{2})", v.get("itemTitle", ""))
        n = re.search(r"/tile/(\d+)/", v.get("itemURL", ""))
        if d and n:
            out.append({
                "release": int(n.group(1)),
                "published": d.group(1),
                "tileUrl": v["itemURL"],
                "metadataUrl": v.get("metadataLayerUrl", ""),
            })
    out.sort(key=lambda r: r["published"], reverse=True)
    return out


def resolve_at(cat: list[dict], lat: float, lng: float) -> set[int]:
    """Distinct releases that actually hold imagery over one point."""
    row, col = tile_xy(lat, lng, ZOOM)

    def one(rel: dict) -> int | None:
        url = (rel["tileUrl"].replace("{level}", str(ZOOM))
                             .replace("{row}", str(row)).replace("{col}", str(col)))
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "masid-thesis/1.0"})
            with urllib.request.urlopen(req, timeout=TIMEOUT, context=SSL_CTX) as r:
                m = re.search(r"/tile/(\d+)/", r.geturl())   # the REDIRECT target
                return int(m.group(1)) if m else None
        except Exception:
            return None

    with ThreadPoolExecutor(max_workers=12) as ex:
        return {r for r in ex.map(one, cat) if r is not None}


def acquisition(rel: dict, lat: float, lng: float) -> dict | None:
    """
    When the frame was actually FLOWN, and by whom.

    The release date is when Esri published a version; it is not the date the
    photograph was taken, and the two can differ by many months. Captioning a
    slider with publication dates would misdate every frame, so the acquisition
    record is read from the release's own metadata layer at this exact point.
    """
    if not rel.get("metadataUrl"):
        return None
    q = (f"{rel['metadataUrl']}/identify?geometry={lng},{lat}"
         f"&geometryType=esriGeometryPoint&sr=4326&layers=all&tolerance=1"
         f"&mapExtent={lng-0.02},{lat-0.02},{lng+0.02},{lat+0.02}"
         f"&imageDisplay=400,400,96&returnGeometry=false&f=json")
    try:
        res = json.loads(get(q)).get("results", [])
    except Exception:
        return None
    if not res:
        return None
    a = res[0].get("attributes", {})
    raw = str(a.get("SRC_DATE", ""))
    flown = f"{raw[:4]}-{raw[4:6]}-{raw[6:8]}" if len(raw) == 8 and raw.isdigit() else None
    # Esri returns SRC_RES and SRC_ACC as STRINGS ("0.5", "10.2"). Passing them
    # through shipped a measurement typed as text, which sorts wrong, compares
    # wrong, and is the kind of thing a data contract exists to catch. Coerced
    # here at the boundary rather than in the app.
    def as_float(v):
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    return {
        "flown": flown,
        "resolutionMetres": as_float(a.get("SRC_RES")),
        "accuracyMetres": as_float(a.get("SRC_ACC")),
        "provider": a.get("NICE_NAME") or a.get("SRC_DESC"),
    }


def sample_points(n: int) -> list[tuple[str, float, float]]:
    """Spread the probe across municipalities, not across one town."""
    rows = json.loads(PROJECTS.read_text())
    rows = rows if isinstance(rows, list) else rows.get("projects", [])
    seen, out = set(), []
    for p in rows:
        m = p.get("municipality")
        if p.get("lat") is None or m in seen:
            continue
        seen.add(m)
        out.append((m, float(p["lat"]), float(p["lng"])))
        if len(out) >= n:
            break
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--probe", type=int, default=4,
                    help="how many municipalities to resolve against")
    args = ap.parse_args()

    print("fetching the Wayback release catalogue…")
    cat = load_catalogue()
    print(f"  {len(cat)} dated releases, {cat[-1]['published']} → {cat[0]['published']}")

    pts = sample_points(args.probe)
    print(f"resolving which of them hold imagery, over {len(pts)} municipalities…")

    # Union across sample points. A release that re-flew only part of the
    # province still belongs in the list; the app confirms per contract.
    live: set[int] = set()
    for name, lat, lng in pts:
        got = resolve_at(cat, lat, lng)
        live |= got
        print(f"  {name:<24} {len(got)} distinct")

    frames = [r for r in cat if r["release"] in live]
    frames.sort(key=lambda r: r["published"])
    print(f"{len(frames)} distinct imagery versions over Bulacan")

    print("reading acquisition metadata for each…")
    ref_lat, ref_lng = pts[0][1], pts[0][2]
    for f in frames:
        meta = acquisition(f, ref_lat, ref_lng) or {}
        f.update(meta)
        f.pop("metadataUrl", None)
        print(f"  published {f['published']}  flown {meta.get('flown') or '—'}"
              f"  {meta.get('resolutionMetres') or '?'} m  {meta.get('provider') or ''}")

    # ── collapse republications to actual photographs ───────────────────
    #
    # This is the finding that decides what the feature can honestly be. The 28
    # "versions" are NOT 28 photographs: Esri republishes the same imagery in
    # release after release, and the 2019-10-05 flight alone appears in twelve
    # of them. Deduplicating on the flight date leaves SIX photographs of
    # Bulacan in sixteen years, with a five-and-a-half-year gap between Oct 2019
    # and Apr 2025 — the gap that contains this district office's entire
    # spending surge.
    #
    # A slider over 28 frames would show a reader twelve identical pictures and
    # imply a cadence that does not exist. Only distinct flights are kept, and
    # the newest release carrying each is used, since Esri's later processing of
    # the same capture is the better rendering of it.
    by_flight: dict[str, dict] = {}
    for f in frames:
        key = f.get("flown") or f["published"]
        prev = by_flight.get(key)
        if prev is None or f["published"] > prev["published"]:
            f = {**f, "republishedAs": (prev or {}).get("republishedAs", 0) + 1}
            by_flight[key] = f
        else:
            prev["republishedAs"] = prev.get("republishedAs", 1) + 1
    flights = sorted(by_flight.values(), key=lambda r: r.get("flown") or r["published"])
    print(f"{len(frames)} published versions collapse to {len(flights)} distinct flights")

    # How many frames a typical contract window actually contains — the number
    # that decides whether calling this a "progress" view would be a lie.
    rows = json.loads(PROJECTS.read_text())
    rows = rows if isinstance(rows, list) else rows.get("projects", [])
    dates = [f.get("flown") or f["published"] for f in flights]
    during = pair = neither = 0
    dated = 0
    for p in rows:
        s, e = p.get("startDate"), p.get("endDate")
        if not s or not e:
            continue
        dated += 1
        s, e = s[:10], e[:10]
        if any(s <= d <= e for d in dates):
            during += 1
        elif any(d < s for d in dates) and any(d > e for d in dates):
            pair += 1
        else:
            neither += 1
    inside = {
        "contractsWithDates": dated,
        "flightDuringConstruction": during,
        "cleanBeforeAndAfter": pair,
        "neither": neither,
    }
    print(f"of {dated} contracts with both dates: {during} have a flight DURING "
          f"construction, {pair} have a clean BEFORE/AFTER pair, {neither} have neither")

    OUT.write_text(json.dumps({
        "generated": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "source": "Esri World Imagery Wayback",
        "attribution": "Imagery © Esri, Maxar, Earthstar Geographics",
        "note": ("Frames are served live from Esri and are not redistributed by this "
                 "project. Roughly two to three frames fall inside a typical contract "
                 "window, which supports 'did a structure appear' and does not support "
                 "'how far along was it'."),
        "zoom": ZOOM,
        "publishedVersions": len(frames),
        "coverage": inside,
        "frames": flights,
    }, indent=1) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
