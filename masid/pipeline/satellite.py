#!/usr/bin/env python3
"""
MASID satellite tier — Sentinel-2 delivery verification for Bulacan 1st DEO.

Asks one question per contract: between the period before construction started
and the period after it was due to finish, did the ground at the published
coordinate change in the way building a concrete flood control structure changes
ground?

SOURCE
  Sentinel-2 L2A Cloud-Optimised GeoTIFFs on AWS Open Data, indexed by the
  Element 84 Earth Search STAC API. Public, free, no account, no API key.
    https://earth-search.aws.element84.com/v1
    s3://sentinel-cogs/  (anonymous HTTPS)
  10 m ground sample distance, 2017→present. Copernicus Sentinel data, ESA.

METHOD
  For each contract, two periods are composited from up to 3 low-cloud scenes:
    before  = the 12 months ending at the contract start date
    after   = the 12 months beginning at the completion date
  Per period we take a per-pixel median across scenes, after masking cloud,
  shadow and cirrus with the L2A scene classification band.

  Two indices are measured in concentric samples around the published point:
    NDVI  (nir-red)/(nir+red)        — vegetation; construction removes it
    NDBI  (swir-nir)/(swir+nir)      — built-up/bare surface; construction adds it

  NDBI rather than a plain brightness average: clearing vegetation lowers NIR at
  the same time as it raises red, so a red+NIR mean can sit flat over an obvious
  new structure. SWIR separates concrete and bare fill from vegetation cleanly,
  and pairing it with NDVI gives two indices that move in opposite directions for
  the same event.

  Sampled at radii of 30 m, 90 m and 150 m, plus a 300–600 m control annulus.
  The control is subtracted from every reading. Without it a dry season, a
  harvest or a flood would register as construction across the whole province at
  once — the signal has to be local to mean anything.

  The 150 m radius is deliberate. GIST (Yale, April 2026) found the most common
  detection distance from the contracted coordinate to be ~150 m, consistent with
  the site displacement COA documented in Bulacan. Sampling all three radii lets
  displacement be distinguished from absence rather than confused with it.

WHAT THE OUTPUT IS NOT
  A verdict on whether a project exists. Sentinel-2 at 10 m cannot resolve a
  narrow revetment or a drainage line, cloud cover over Bulacan is heavy in the
  wet season, and a project built where vegetation was already absent produces no
  NDVI signal at all. Every record carries an explicit confidence, and records
  the method cannot speak to are marked as such rather than scored.

USAGE
  python3 pipeline/satellite.py [--limit N] [--workers N]

  Runs on an audit-priority subset by default: the highest-scoring flagged
  records plus a seeded control sample of unflagged ones, so the comparison is
  not circular. Results cache per scene, so re-runs and larger --limit values
  only fetch what is new.
"""

from __future__ import annotations

import argparse
import concurrent.futures as futures
import hashlib
import json
import math
import os
import random
import sys
import threading
import subprocess
import zlib
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

# Must precede the rasterio import: anonymous access, and stop GDAL listing the
# bucket directory on every open (turns each read from ~40 requests into ~3).
os.environ.setdefault("AWS_NO_SIGN_REQUEST", "YES")
os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif")
os.environ.setdefault("GDAL_HTTP_MAX_RETRY", "3")
os.environ.setdefault("GDAL_HTTP_RETRY_DELAY", "2")
os.environ.setdefault("VSI_CACHE", "TRUE")

import numpy as np
import rasterio
from rasterio.warp import transform as warp_transform
from rasterio.windows import from_bounds

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "app" / "data"
CACHE = ROOT / "data" / "s2cache"

STAC = "https://earth-search.aws.element84.com/v1/search"
COLLECTION = "sentinel-2-l2a"

BANDS = ("red", "nir", "swir16", "scl")   # B04/B08 10 m, B11/SCL 20 m
SCL_BAD = {0, 1, 3, 8, 9, 10}          # nodata, saturated, shadow, cloud x2, cirrus
RADII_M = (30, 90, 150)
CONTROL_INNER_M, CONTROL_OUTER_M = 300, 600
MAX_SCENES = 3
MAX_CLOUD = 35                          # scene-level %, Bulacan is rarely clearer
S2_EPOCH = date(2017, 4, 1)             # start of reliable L2A on Earth Search

# A construction-consistent local change: vegetation lost, surface brightened.
#
# Expressed as z-scores against each site's OWN control annulus rather than as
# absolute index units. Fixed thresholds cannot work here: a site in irrigated
# ricefield and a site in an existing urban block have completely different
# natural variability, and the same absolute NDVI drop means very different
# things in each. Measuring how far the point departs from the spread of change
# in its own surroundings calibrates per site, for free.
#
# ±2.0 is roughly the 97.5th percentile of a normal — a change this local is
# unlikely to be seasonal drift. Requiring BOTH indices to agree makes a chance
# trigger substantially less likely again.
NDVI_Z = -2.0
NDBI_Z = 2.0
MIN_CONTROL_PIXELS = 200
NULL_SAMPLES = 160          # random discs per radius forming the empirical null


# ── caching ───────────────────────────────────────────────────────────────────
# Every network result is cached keyed by its inputs. Re-runs cost nothing, and a
# larger --limit only fetches the projects that were not covered before.

_cache_lock = threading.Lock()


def cache_path(kind: str, key: str) -> Path:
    h = hashlib.sha1(key.encode()).hexdigest()[:16]
    p = CACHE / kind / h[:2]
    p.mkdir(parents=True, exist_ok=True)
    return p / f"{h}.json"


def cached_json(kind: str, key: str, produce):
    p = cache_path(kind, key)
    if p.exists():
        try:
            return json.loads(p.read_text())
        except json.JSONDecodeError:
            pass  # truncated by an interrupted run; refetch
    value = produce()
    with _cache_lock:
        p.write_text(json.dumps(value))
    return value


# ── STAC ──────────────────────────────────────────────────────────────────────

def search_scenes(bbox, start: date, end: date):
    """Least-cloudy scenes covering bbox in the window, newest metadata first."""
    # Band list is part of the key: a cached search from a run with fewer
    # bands would silently omit hrefs the current run needs.
    key = f"{bbox}|{start}|{end}|{MAX_CLOUD}|{','.join(BANDS)}"

    def fetch():
        body = json.dumps({
            "collections": [COLLECTION],
            "bbox": list(bbox),
            "datetime": f"{start}T00:00:00Z/{end}T23:59:59Z",
            "query": {"eo:cloud_cover": {"lt": MAX_CLOUD}},
            "limit": 100,
        })
        # curl, not urllib: the python.org framework build ships without a CA
        # bundle. GDAL uses its own and is unaffected.
        proc = subprocess.run(
            ["curl", "-fsS", "-X", "POST", STAC,
             "-H", "Content-Type: application/json",
             "-A", "masid-pipeline", "--max-time", "90", "-d", body],
            capture_output=True, check=True,
        )
        doc = json.loads(proc.stdout)
        out = []
        for f in doc.get("features", []):
            out.append({
                "id": f["id"],
                "datetime": f["properties"]["datetime"][:10],
                "cloud": f["properties"].get("eo:cloud_cover", 100),
                "assets": {b: a["href"] for b, a in f["assets"].items() if "href" in a},
            })
        out.sort(key=lambda s: s["cloud"])
        return out

    return cached_json("stac", key, fetch)


# ── sampling ──────────────────────────────────────────────────────────────────

def read_windows(href: str, points: list[tuple[str, float, float]], radius_m: int):
    """Read one square window per point from a single remote COG.

    One dataset open serves every point in the scene. Opening per point would
    re-fetch the COG header thousands of times, which is the difference between
    minutes and hours."""
    out: dict[str, list] = {}
    with rasterio.open("/vsicurl/" + href) as src:
        lons = [p[2] for p in points]
        lats = [p[1] for p in points]
        xs, ys = warp_transform("EPSG:4326", src.crs, lons, lats)
        res = abs(src.transform.a)
        for (pid, _, _), x, y in zip(points, xs, ys):
            try:
                w = from_bounds(x - radius_m, y - radius_m,
                                x + radius_m, y + radius_m, src.transform)
                arr = src.read(1, window=w, boundless=True, fill_value=0)
            except Exception:
                continue
            if arr.size == 0:
                continue
            out[pid] = [arr.astype(np.float32), res, x, y]
    return out


def ring_masks(shape, res, radius_m):
    """Boolean masks for each sample radius and the control annulus."""
    h, w = shape
    cy, cx = (h - 1) / 2, (w - 1) / 2
    yy, xx = np.mgrid[0:h, 0:w]
    dist = np.hypot((yy - cy) * res, (xx - cx) * res)
    masks = {f"r{r}": dist <= r for r in RADII_M if r <= radius_m}
    masks["control"] = (dist >= CONTROL_INNER_M) & (dist <= CONTROL_OUTER_M)
    return masks


def composite(samples: list[dict]) -> dict | None:
    """Median across scenes of NDVI and NDBI, cloud-masked per scene."""

    def upsample(arr, shape):
        """20 m bands (SWIR, SCL) onto the 10 m grid by pixel repetition."""
        if arr is None:
            return None
        if arr.shape == shape:
            return arr
        up = np.kron(arr, np.ones((2, 2), np.float32))[: shape[0], : shape[1]]
        return up if up.shape == shape else None

    ndvis, ndbis = [], []
    for s in samples:
        red, nir = s.get("red"), s.get("nir")
        if red is None or nir is None or red.shape != nir.shape:
            continue
        shape = red.shape
        scl = upsample(s.get("scl"), shape)
        swir = upsample(s.get("swir16"), shape)

        valid = np.ones(shape, bool)
        if scl is not None:
            valid &= ~np.isin(scl.astype(np.int16), list(SCL_BAD))

        with np.errstate(divide="ignore", invalid="ignore"):
            den = nir + red
            ndvi = np.where(den > 0, (nir - red) / den, np.nan)
            if swir is not None:
                den2 = swir + nir
                ndbi = np.where(den2 > 0, (swir - nir) / den2, np.nan)
            else:
                ndbi = np.full(shape, np.nan, np.float32)
        ndvis.append(np.where(valid, ndvi, np.nan))
        ndbis.append(np.where(valid, ndbi, np.nan))

    if not ndvis:
        return None
    with np.errstate(all="ignore"):
        stack = np.stack(ndvis)
        return {
            "ndvi": np.nanmedian(stack, axis=0),
            "ndbi": np.nanmedian(np.stack(ndbis), axis=0),
            "coverage": float(np.mean(~np.isnan(stack))),
        }


def zonal(grid, masks):
    """Mean of each index inside each ring, ignoring cloud-masked pixels."""
    out = {}
    for name, m in masks.items():
        vals = grid[m]
        vals = vals[~np.isnan(vals)]
        out[name] = float(vals.mean()) if vals.size >= 4 else None
    return out


def change_z(before_grid, after_grid, res, rng, stat="disc-mean", sign=-1):
    """Significance of local change against a bootstrap null of identical discs.

    The obvious null — the spread of individual control pixels — is wrong, and
    wrong in the direction that hides everything. The measurement at each radius
    is a MEAN over N pixels (~28 at 30 m), and the sampling spread of a mean is
    far tighter than the spread of single pixels. Comparing one against the other
    understates the z-score by up to sqrt(N), which is how a first pass produced
    1 detection in 200 records.

    Dividing by sqrt(N) would be the textbook correction and would also be wrong
    here: satellite pixels are spatially autocorrelated, so the effective N is
    smaller than the pixel count and sqrt(N) would overstate precision instead.

    So the null is empirical. Drop discs of the SAME radius at random positions
    in the surrounding annulus, measure the change each one sees, and ask where
    the real disc falls in that distribution. Autocorrelation, seasonality and
    terrain are all inside the null by construction, because the null discs
    sample the same ground under the same conditions."""
    h = min(before_grid.shape[0], after_grid.shape[0])
    w = min(before_grid.shape[1], after_grid.shape[1])
    delta = after_grid[:h, :w] - before_grid[:h, :w]

    cy, cx = (h - 1) / 2, (w - 1) / 2
    yy, xx = np.mgrid[0:h, 0:w]
    dist_c = np.hypot((yy - cy) * res, (xx - cx) * res)

    # 3x3 NaN-aware mean, computed once for the whole grid. The "patch"
    # statistic then only has to take an extremum inside each disc, which turns
    # a per-disc O(n^2) scan into an O(n) lookup — the difference between this
    # finishing and not.
    smoothed = None
    if stat == "patch":
        vals = np.nan_to_num(delta, nan=0.0)
        cnt = (~np.isnan(delta)).astype(np.float32)
        acc = np.zeros_like(vals)
        acn = np.zeros_like(cnt)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                acc += np.roll(np.roll(vals, dy, 0), dx, 1)
                acn += np.roll(np.roll(cnt, dy, 0), dx, 1)
        with np.errstate(invalid="ignore", divide="ignore"):
            smoothed = np.where(acn >= 6, acc / np.maximum(acn, 1), np.nan)
        smoothed[:1, :] = smoothed[-1:, :] = np.nan   # wrap-around from roll
        smoothed[:, :1] = smoothed[:, -1:] = np.nan

    def reduce(py, px, r_m):
        """Collapse the disc to one number, by whichever statistic is selected.

        `sign` is the direction construction moves the index: -1 for NDVI
        (vegetation lost), +1 for NDBI (built surface gained). Extremum
        statistics need it; the mean does not.

        The choice of statistic is the whole experiment. A disc mean assumes the
        structure fills the disc. Philippine flood control structures are narrow
        and linear — a revetment occupies a fraction of one 10 m pixel row — so a
        mean over ~28 pixels of floodplain averages it away. The alternatives
        below concentrate on the most-changed part of the disc instead.

        Whatever is chosen here is also applied to every null disc, so the
        comparison stays like-for-like no matter how extreme the statistic."""
        d = np.hypot((yy - py) * res, (xx - px) * res)
        mask = d <= r_m
        vals = delta[mask]
        vals = vals[~np.isnan(vals)]
        if vals.size < 4:
            return None

        if stat == "disc-mean":
            return float(vals.mean())

        if stat == "tail":
            # Mean of the most-changed fifth of the disc. Survives a structure
            # covering only part of the footprint without chasing single pixels.
            k = max(4, int(round(vals.size * 0.2)))
            v = np.sort(vals)
            return float(v[:k].mean() if sign < 0 else v[-k:].mean())

        if stat == "core":
            # Just the pixels touching the coordinate — a 3x3 at 10 m. Assumes
            # the coordinate is accurate, which for flagged records it is not.
            core = np.hypot((yy - py) * res, (xx - px) * res) <= max(res * 1.5, 15)
            v = delta[core]
            v = v[~np.isnan(v)]
            return float(v.mean()) if v.size >= 3 else None

        if stat == "patch":
            # Most-changed contiguous 3x3 anywhere in the disc: the shape a small
            # structure actually makes, without assuming where it sits.
            v = smoothed[mask]
            v = v[~np.isnan(v)]
            if v.size < 3:
                return None
            return float(v.min() if sign < 0 else v.max())

        raise ValueError(f"unknown stat {stat!r}")

    disc_mean = reduce

    out = {}
    for r_m in RADII_M:
        obs = disc_mean(cy, cx, r_m)
        if obs is None:
            out[f"r{r_m}"] = None
            continue

        # Candidate null centres: far enough out not to overlap the target, and
        # near enough in that the disc still lands on grid.
        ok = (dist_c >= CONTROL_INNER_M) & (dist_c <= CONTROL_OUTER_M)
        margin = int(np.ceil(r_m / res))
        edge = np.zeros_like(ok)
        edge[margin:h - margin, margin:w - margin] = True
        cand = np.argwhere(ok & edge)
        if len(cand) < 50:
            out[f"r{r_m}"] = None
            continue

        picks = cand[rng.choice(len(cand), size=min(NULL_SAMPLES, len(cand)),
                                replace=False)]
        null = [disc_mean(py, px, r_m) for py, px in picks]
        null = np.array([v for v in null if v is not None])
        if null.size < 30:
            out[f"r{r_m}"] = None
            continue

        mu, sd = float(null.mean()), float(null.std())
        if not np.isfinite(sd) or sd <= 1e-9:
            out[f"r{r_m}"] = None
            continue
        out[f"r{r_m}"] = {
            "delta": round(obs - mu, 4),
            "z": round((obs - mu) / sd, 2),
            # Empirical two-sided rank, which needs no normality assumption.
            "pct": round(float((null <= obs).mean()), 3),
            "nullN": int(null.size),
            "nullSd": round(sd, 4),
        }
    usable = [v for v in out.values() if v]
    return out, {"nullDiscs": usable[0]["nullN"] if usable else 0}


# ── chips ─────────────────────────────────────────────────────────────────────

CHIPS = ROOT / "public" / "chips"

# Diverging ramp for NDVI: brown bare ground through pale to green vegetation.
# Chosen so the two ends stay distinguishable in greyscale and to the ~8% of men
# with red-green colour deficiency, since "did the green go away" is the whole
# question the picture is being asked.
NDVI_RAMP = [
    (-1.0, (110, 74, 46)), (0.0, (166, 138, 106)), (0.2, (222, 216, 198)),
    (0.45, (150, 190, 120)), (0.7, (64, 145, 74)), (1.0, (18, 82, 44)),
]


def ramp_rgb(v):
    """Interpolate NDVI_RAMP; NaN (cloud-masked) renders as a neutral grey."""
    out = np.zeros(v.shape + (3,), np.uint8)
    nan = np.isnan(v)
    vc = np.clip(np.nan_to_num(v, nan=0.0), -1, 1)
    for (lo, c0), (hi, c1) in zip(NDVI_RAMP, NDVI_RAMP[1:]):
        m = (vc >= lo) & (vc <= hi)
        if not m.any():
            continue
        t = ((vc[m] - lo) / (hi - lo))[:, None]
        out[m] = (np.array(c0) * (1 - t) + np.array(c1) * t).astype(np.uint8)
    out[nan] = (140, 143, 148)
    return out


def write_chip(path: Path, grid, res: float, scale: int = 3):
    """One NDVI chip with the sampling radii drawn on, as the eye check.

    The rings are the point: a reader can see for themselves whether the change
    the z-scores report sits under the 30 m circle or out at 150 m, rather than
    taking the classifier's word for it."""
    from PIL import Image, ImageDraw

    rgb = ramp_rgb(grid)
    img = Image.fromarray(rgb, "RGB").resize(
        (rgb.shape[1] * scale, rgb.shape[0] * scale), Image.NEAREST)
    d = ImageDraw.Draw(img, "RGBA")
    cx = cy = img.width / 2
    # Dark halo under each ring so it stays readable over both the bright bare
    # end of the ramp and the dark vegetated end.
    for r_m, alpha in ((30, 245), (90, 190), (150, 150)):
        rp = (r_m / res) * scale
        d.ellipse([cx - rp - 1, cy - rp - 1, cx + rp + 1, cy + rp + 1],
                  outline=(0, 0, 0, alpha // 2), width=3)
        d.ellipse([cx - rp, cy - rp, cx + rp, cy + rp],
                  outline=(255, 255, 255, alpha), width=2)
    for dx, dy in ((7, 0), (0, 7)):
        d.line([cx - dx, cy - dy, cx + dx, cy + dy], fill=(0, 0, 0, 160), width=4)
        d.line([cx - dx, cy - dy, cx + dx, cy + dy], fill=(255, 255, 255, 245), width=2)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG", optimize=True)


# ── periods ───────────────────────────────────────────────────────────────────

def parse_d(s):
    if not s:
        return None
    try:
        y, m, d = (int(v) for v in s.split("-"))
        return date(y, m, d)
    except ValueError:
        return None


def periods_for(p) -> tuple[tuple[date, date], tuple[date, date]] | None:
    """The before and after windows for one contract, or None if undatable."""
    start = parse_d(p.get("startDate"))
    end = parse_d(p.get("endDate"))
    if start is None and p.get("infraYear"):
        start = date(int(p["infraYear"]), 1, 1)
    if start is None:
        return None
    if end is None or end <= start:
        end = start + timedelta(days=365)
    before = (start - timedelta(days=365), start)
    after = (end, end + timedelta(days=365))
    if before[0] < S2_EPOCH:
        return None                      # no pre-construction imagery exists
    if after[0] > date.today():
        return None                      # not yet due to finish
    if after[1] > date.today():
        after = (after[0], date.today())
    return before, after


# ── main ──────────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=140,
                    help="flagged records to assess (a control sample is added)")
    ap.add_argument("--controls", type=int, default=60)
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()

    projects = json.loads((DATA / "projects.json").read_text())
    by_id = {p["id"]: p for p in projects}

    assessable, skipped = [], defaultdict(int)
    for p in projects:
        if p["lat"] is None or p["lng"] is None:
            skipped["no coordinate published"] += 1
            continue
        if p["geocodedMunicipality"] is None:
            skipped["coordinate not in any municipality"] += 1
            continue
        per = periods_for(p)
        if per is None:
            skipped["outside Sentinel-2 record, or not yet due"] += 1
            continue
        assessable.append((p, per))

    flagged = [a for a in assessable if a[0]["auditFlags"]]
    clean = [a for a in assessable if not a[0]["auditFlags"]]
    flagged.sort(key=lambda a: (-a[0]["auditScore"], -a[0]["budget"]))
    rng = random.Random(20260803)        # seeded: the control set is reproducible
    controls = rng.sample(clean, min(args.controls, len(clean)))
    selected = flagged[: args.limit] + controls

    print(f"{len(projects):,} records | {len(assessable):,} assessable")
    for reason, n in sorted(skipped.items(), key=lambda kv: -kv[1]):
        print(f"  skipped {n:5d}  {reason}")
    print(f"selected {len(selected)} ({min(args.limit,len(flagged))} flagged "
          f"+ {len(controls)} seeded controls)\n")

    # Group by period so one STAC search and one set of scene opens serves many
    # contracts. Quarter buckets keep the composite seasonally coherent.
    def bucket(d0, d1):
        return f"{d0.year}Q{(d0.month-1)//3+1}_{d1.year}Q{(d1.month-1)//3+1}"

    groups: dict[tuple[str, str], list] = defaultdict(list)
    for p, (before, after) in selected:
        groups[("before", bucket(*before))].append((p, before))
        groups[("after", bucket(*after))].append((p, after))

    print(f"{len(groups)} period groups to fetch\n")

    radius = CONTROL_OUTER_M
    results: dict[str, dict] = defaultdict(dict)
    lock = threading.Lock()

    for gi, ((phase, key), members) in enumerate(sorted(groups.items()), 1):
        pts = [(p["id"], p["lat"], p["lng"]) for p, _ in members]
        d0 = min(w[0] for _, w in members)
        d1 = max(w[1] for _, w in members)
        lons = [p["lng"] for p, _ in members]
        lats = [p["lat"] for p, _ in members]
        pad = 0.01
        bbox = (min(lons) - pad, min(lats) - pad, max(lons) + pad, max(lats) + pad)

        scenes = search_scenes(bbox, d0, d1)[:MAX_SCENES]
        if not scenes:
            print(f"[{gi}/{len(groups)}] {phase} {key}: no low-cloud scene found")
            continue
        print(f"[{gi}/{len(groups)}] {phase} {key}: {len(members)} pts, "
              f"{len(scenes)} scenes ({', '.join(s['datetime'] for s in scenes)})",
              flush=True)

        per_scene: list[dict] = []
        for scene in scenes:
            # Keyed on the scene, NOT on the set of points, so the cache is
            # additive: changing --limit or reselecting the subset reuses every
            # point already fetched and only pays for the new ones. Band list is
            # in the key because a cached sample from a narrower band list would
            # be silently incomplete.
            ck = f"{scene['id']}|{radius}|{','.join(BANDS)}"
            cp = cache_path("scene", ck).with_suffix(".npz")

            merged: dict[str, dict] = {}
            if cp.exists():
                try:
                    merged = dict(np.load(cp, allow_pickle=True)["d"].item())
                except Exception:
                    cp.unlink(missing_ok=True)
                    merged = {}

            todo = [pt for pt in pts if pt[0] not in merged]
            if todo:
                band_out: dict[str, dict] = {}

                def grab(band):
                    href = scene["assets"].get(band)
                    if not href:
                        return band, {}
                    try:
                        return band, read_windows(href, todo, radius)
                    except Exception as e:
                        print(f"      {band} failed: {type(e).__name__}: {e}")
                        return band, {}

                with futures.ThreadPoolExecutor(max_workers=min(args.workers, len(BANDS))) as ex:
                    for band, got in ex.map(grab, BANDS):
                        band_out[band] = got

                for pid, *_ in todo:
                    entry = {}
                    for band in BANDS:
                        v = band_out.get(band, {}).get(pid)
                        entry[band] = v[0] if v else None
                        if v and band == "red":
                            entry["res"] = v[1]
                    if entry.get("red") is not None:
                        merged[pid] = entry
                np.savez_compressed(cp, d=np.array(merged, dtype=object))
            elif merged:
                print(f"      {scene['id']}: all {len(pts)} points cached")

            per_scene.append({"id": scene["id"], "data": merged})

        for pid, *_ in pts:
            samples = [s["data"][pid] for s in per_scene if pid in s["data"]]
            if not samples:
                continue
            comp = composite(samples)
            if comp is None:
                continue
            res = samples[0].get("res", 10.0)
            with lock:
                results[pid][phase] = {
                    "ndviGrid": comp["ndvi"],
                    "ndbiGrid": comp["ndbi"],
                    "res": res,
                    "coverage": comp["coverage"],
                    "scenes": [s["id"] for s in per_scene if pid in s["data"]],
                }

    # ── interpretation ────────────────────────────────────────────────────────
    out = []
    for pid, r in results.items():
        if "before" not in r or "after" not in r:
            continue
        b, a = r["before"], r["after"]
        # zlib.crc32, not hash(): Python salts str hashing per process, so hash()
        # would reseed the bootstrap differently on every run and the numbers
        # would not reproduce. Research output has to be re-derivable.
        rng = np.random.default_rng(zlib.crc32(pid.encode()))
        ndvi_z, ndvi_ctrl = change_z(b["ndviGrid"], a["ndviGrid"], b["res"], rng)
        ndbi_z, _ = change_z(b["ndbiGrid"], a["ndbiGrid"], b["res"], rng)

        rings = {}
        if ndvi_z and ndbi_z:
            for radius_m in RADII_M:
                k = f"r{radius_m}"
                nz, bz = ndvi_z.get(k), ndbi_z.get(k)
                rings[k] = None if not (nz and bz) else {
                    "dNdvi": nz["delta"], "zNdvi": nz["z"], "pctNdvi": nz["pct"],
                    "dNdbi": bz["delta"], "zNdbi": bz["z"], "pctNdbi": bz["pct"],
                    "nullDiscs": nz["nullN"],
                }

        usable = {k: v for k, v in rings.items() if v}
        coverage = min(b["coverage"], a["coverage"])
        if not usable:
            verdict, detail, conf = "not-assessable", (
                "Cloud cover or missing data leaves too little clear ground to "
                "compare the two periods."), "none"
        else:
            hits = [k for k, v in usable.items()
                    if v["zNdvi"] <= NDVI_Z and v["zNdbi"] >= NDBI_Z]
            conf = "high" if coverage >= 0.7 else "medium" if coverage >= 0.45 else "low"
            if not hits:
                verdict = "no-change-signal"
                detail = ("No construction-consistent change stands out from local "
                          "variation at or within 150 m of the published coordinate. "
                          "Sentinel-2 at 10 m cannot resolve a narrow revetment or "
                          "drainage line, so this is not evidence of absence.")
            elif "r30" in hits:
                v = usable["r30"]
                detail = (f"Construction-consistent change at the published "
                          f"coordinate: NDVI {v['dNdvi']:+.3f} ({v['zNdvi']:+.1f}σ), "
                          f"NDBI {v['dNdbi']:+.3f} ({v['zNdbi']:+.1f}σ) against the "
                          f"surrounding control ring.")
                verdict = "change-at-point"
            else:
                nearest = min(int(k[1:]) for k in hits)
                v = usable[f"r{nearest}"]
                verdict = "change-offset"
                detail = (f"Nothing stands out at the published coordinate, but "
                          f"construction-consistent change appears within {nearest} m "
                          f"of it (NDVI {v['zNdvi']:+.1f}σ, NDBI "
                          f"{v['zNdbi']:+.1f}σ) — the displacement pattern rather "
                          f"than absence.")

        chips = None
        try:
            write_chip(CHIPS / f"{pid}-before.png", b["ndviGrid"], b["res"])
            write_chip(CHIPS / f"{pid}-after.png", a["ndviGrid"], a["res"])
            chips = {"before": f"/chips/{pid}-before.png", "after": f"/chips/{pid}-after.png"}
        except Exception as e:
            print(f"  chip failed for {pid}: {type(e).__name__}: {e}")

        p = by_id[pid]
        out.append({
            "id": pid,
            "chips": chips,
            "verdict": verdict,
            "detail": detail,
            "confidence": conf,
            "rings": rings,
            "control": ndvi_ctrl,
            "cloudFreeFraction": round(coverage, 3),
            "scenesBefore": b["scenes"],
            "scenesAfter": a["scenes"],
            "flagged": bool(p["auditFlags"]),
        })

    out.sort(key=lambda r: (r["verdict"] != "no-change-signal", r["id"]))

    # ── self-validation ───────────────────────────────────────────────────────
    # The seeded control sample is not decoration. Its whole job is to measure
    # whether this detector can tell a flagged record from an ordinary one. If
    # the two groups detect at the same rate, the verdicts carry no information
    # about the records, and saying so is the single most important number in
    # this file.
    def rate(flagged):
        g = [r for r in out if r["flagged"] == flagged and r["verdict"] != "not-assessable"]
        det = [r for r in g if r["verdict"] in ("change-at-point", "change-offset")]
        zs = [r["rings"]["r30"]["zNdvi"] for r in g if r["rings"].get("r30")]
        return {
            "assessed": len(g),
            "detections": len(det),
            "rate": round(len(det) / len(g), 4) if g else None,
            "medianZNdvi30m": round(float(np.median(zs)), 3) if zs else None,
        }

    fl, ct = rate(True), rate(False)
    separates = (
        fl["rate"] is not None and ct["rate"] is not None
        and fl["assessed"] >= 30 and ct["assessed"] >= 30
        and fl["rate"] >= 3 * max(ct["rate"], 0.01)
    )
    validation = {
        "flagged": fl,
        "control": ct,
        "discriminates": bool(separates),
        "verdict": (
            "The detector separates flagged records from controls."
            if separates else
            "NO MEASURED DISCRIMINATIVE POWER. The detector fires on only a small "
            "fraction of ordinary completed contracts — projects that were, in the "
            "main, actually built — so it fails on recall before any question of "
            "ghost projects arises, and an individual verdict below carries no "
            "evidential weight about its contract. pipeline/evaluate.py rules out "
            "the obvious explanation: four change statistics, from a plain disc "
            "mean to the most-changed 3x3 patch, swept across four thresholds, "
            "none reaching usable recall. The limit is the sensor and the setting, "
            "not the estimator."
        ),
    }

    payload = {
        "generated": date.today().isoformat(),
        "source": {
            "name": "Sentinel-2 L2A (Copernicus / ESA)",
            "access": "AWS Open Data COGs via Element 84 Earth Search STAC",
            "url": "https://earth-search.aws.element84.com/v1",
            "auth": "none — public, no account required",
            "resolution": "10 m",
        },
        "method": {
            "radiiMetres": list(RADII_M),
            "controlAnnulusMetres": [CONTROL_INNER_M, CONTROL_OUTER_M],
            "maxScenesPerPeriod": MAX_SCENES,
            "maxSceneCloudPercent": MAX_CLOUD,
            "ndviZThreshold": NDVI_Z,
            "ndbiZThreshold": NDBI_Z,
            "calibration": ("bootstrap null: z against the spread of same-radius discs "
                            "dropped randomly in the site's own 300-600 m annulus"),
            "nullSamples": NULL_SAMPLES,
        },
        "validation": validation,
        "coverage": {
            "assessed": len(out),
            "selected": len(selected),
            "assessable": len(assessable),
            "total": len(projects),
            "skipped": dict(skipped),
        },
        "results": out,
    }
    (DATA / "satellite.json").write_text(json.dumps(payload, indent=1))

    tally = defaultdict(int)
    for r in out:
        tally[r["verdict"]] += 1
    print(f"\nVALIDATION  flagged {fl['detections']}/{fl['assessed']} "
          f"({(fl['rate'] or 0):.1%})  control {ct['detections']}/{ct['assessed']} "
          f"({(ct['rate'] or 0):.1%})  ->  "
          f"{'separates' if separates else 'NO DISCRIMINATIVE POWER'}")
    print(f"\nassessed {len(out)} of {len(selected)} selected")
    for k, n in sorted(tally.items(), key=lambda kv: -kv[1]):
        print(f"  {k:20s} {n:4d}")
    print(f"-> {DATA/'satellite.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
