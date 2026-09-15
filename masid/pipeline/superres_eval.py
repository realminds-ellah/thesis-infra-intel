#!/usr/bin/env python3
"""
Does 10x super-resolution recover real structures, or synthesise plausible ones?

WHY THIS SCRIPT EXISTS

  The Sentinel-2 tier failed for a measured reason: at 10 m per pixel a 30 m
  disc holds ~28 pixels of floodplain and a revetment is metres wide, so the
  structure is diluted below the seasonal noise. evaluate.py swapped four
  statistics and none of them recovered it. That is FINDINGS' null result.

  Single-image super-resolution offers to fix this by upscaling 10 m Sentinel-2
  to 1 m. S2DR3 is the current example: 12 bands, 10x, claiming features down to
  ~3 m. If it works, every one of the 1,293 contracts becomes checkable against
  free public imagery and the imagery tier stops being a null.

  It probably does not work, and the reason is information, not engineering. A
  3 m structure occupies roughly 9% of one 10 m pixel. That detail is not
  attenuated in the input, it is ABSENT from it, so a model that draws a
  convincing revetment is not recovering it — it is inventing something
  consistent with the pixel it was given.

  The model's own author says as much: the high-resolution multi-spectral ground
  truth "does not exist and had to be artificially synthesised" for training, and
  the published validation is SPECTRAL fidelity — downsample the 1 m output and
  compare it with the 10 m input. A model that hallucinates a structure passes
  that check perfectly, because downsampling the hallucination reproduces the
  input. It constrains the low frequencies. The high frequencies — the part you
  would be reading a structure off — are exactly what it does not test.

WHAT THIS PROJECT HAS THAT THE FIELD DOES NOT

  Real ground truth at sub-metre resolution, over the same coordinates.

  Esri Wayback publishes six dated flights over Bulacan at 0.34-0.5 m, and 826
  of the 962 dated contracts have a clean before-and-after pair straddling the
  whole build. So the question can be asked properly, and answered either way:

      Does the CHANGE that super-resolution reports between two dates
      agree with the CHANGE that 0.5 m reference imagery shows,
      at contract coordinates, more than it does at random nearby discs?

  The control is what makes it a test. Super-resolution will happily draw linear
  bright features along every riverbank in the province; agreement at the site
  only means something if it exceeds agreement where nothing was built.

WHY THE COMPARISON IS OF CHANGE AND NOT OF A SINGLE FRAME

  Two frames of the same place from different sensors on different dates never
  correlate well in absolute terms, and reading anything into that number would
  be measuring sensor difference. Differencing removes everything static — the
  river, the road, the field boundaries — and leaves what appeared or vanished.
  That is also the only question the project actually asks of imagery.

  It needs no labels. Nobody has to annotate anything for this metric to run,
  which is why it can be answered before the review station has been filled in.

THIS RUNS LOCALLY AND TALKS TO NO PAID SERVICE

  Nothing here calls S2DR3. `plan` tells you which Sentinel-2 scenes to put
  through the free Colab notebook; you download the GeoTIFFs it produces into
  --sr-dir; `score` reads them off disk. The only network this script does is
  the STAC search (cached, shared with satellite.py) and fetching Wayback
  reference tiles (cached, serialised, never redistributed).

OUTPUT GOES TO data/ AND NEVER TO src/app/data/

  Deliberately, and it is the point rather than an oversight. Super-resolved
  imagery must never reach the dashboard: it is model output, it cannot support
  a statement about whether a structure exists, and a reader who saw it beside
  the real frames would reasonably assume it was a photograph. It belongs in the
  evaluation, labelled as model output, beside the reference it is scored
  against. Writing it anywhere else would be the overclaim this whole project is
  built to avoid.

USAGE

  python3 pipeline/superres_eval.py plan  [--limit N] [--window-days 10]
  python3 pipeline/superres_eval.py fetch [--limit N]
  python3 pipeline/superres_eval.py score [--sr-dir data/superres/sr] [--rgb 4,3,2]
"""

from __future__ import annotations

import argparse
import json
import math
import random
import subprocess
import sys
import threading
import time
from datetime import date, timedelta
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import satellite as S  # noqa: E402  (sets GDAL env before importing rasterio)

import rasterio                                    # noqa: E402
from rasterio.transform import rowcol              # noqa: E402
from rasterio.warp import transform as warp_transform  # noqa: E402
from scipy import ndimage                          # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
APPDATA = ROOT / "src" / "app" / "data"
OUT = ROOT / "data" / "superres"
REF = OUT / "ref"
TILES = OUT / "tilecache"

# ── the sampling geometry ─────────────────────────────────────────────────────
#
# satellite.py draws its null from a 300-600 m annulus, which cannot be used
# here: the reference chip would have to be 1.2 km across and that is 121 Esri
# tiles per site per date. The chip is 300 m, the site disc keeps the 30 m
# radius the detector used, and controls are drawn from a 60-140 m ring inside
# the same chip. A tighter ring is a HARDER test, not an easier one — nearby
# discs share the site's land cover, so beating them means more than beating
# arbitrary floodplain.
CHIP_M = 300
GRID_RES_M = 1.0            # the resolution S2DR3 claims; both sources resample to it
SITE_R_M = 30
CTRL_INNER_M, CTRL_OUTER_M = 60, 115   # + SITE_R must stay inside CHIP_M/2
NULL_SAMPLES = 120
# TESTED, not assumed. The Wayback pyramid does not carry the same depth for
# every release over Bulacan: z=19 returns 404 for the 2010 and 2019 flights and
# is served only for 2025, and z=20 is 404 for all of them. A comparison of two
# dates has to be drawn at ONE zoom or it is measuring resampling, so the
# reference is the deepest level every release actually serves — z=18, about
# 0.58 m/px at this latitude. That is coarser than the 0.34-0.5 m Esri quotes
# for the source imagery, and it is still nearly twenty times finer than the
# Sentinel-2 input the model is upscaling from.
ZOOM = 18

# Sentinel-2 revisits every 5 days, but Bulacan is cloudy and search_scenes
# filters at 35%. Measured against the two flights that matter: 2019-10-05 has a
# SAME-DAY scene at 12% cloud, and 2025-04-07 has nothing inside +-10 days and
# its nearest usable scene is 2025-04-26 at 15%. So the window is 20 days, and
# the lag of each leg is recorded per site rather than assumed away.
WINDOW_DAYS = 20
MIN_VALID_FRAC = 0.6        # of the disc, after nodata masking

# Esri serves these tiles live and this project does not redistribute them.
# One client hammering a public archive is how public archives get closed.
FETCH_GAP_S = 0.25
_fetch_lock = threading.Lock()


# ── web mercator ──────────────────────────────────────────────────────────────

def deg2tile(lat: float, lng: float, z: int) -> tuple[float, float]:
    """Fractional tile coordinates — the fraction is what makes sampling exact."""
    n = 2.0 ** z
    x = (lng + 180.0) / 360.0 * n
    r = math.radians(lat)
    y = (1.0 - math.log(math.tan(r) + 1.0 / math.cos(r)) / math.pi) / 2.0 * n
    return x, y


def metres_per_px(lat: float, z: int) -> float:
    return 156543.03392804097 * math.cos(math.radians(lat)) / (2.0 ** z)


def local_grid(lat: float, lng: float, extent_m: int, res_m: float):
    """A square grid in GROUND metres, returned as lon/lat arrays.

    Web Mercator metres are stretched by 1/cos(lat); working in degrees about
    the site and converting with the local scale keeps the disc a real circle of
    real metres rather than an ellipse that grows with latitude.
    """
    n = int(round(extent_m / res_m))
    off = (np.arange(n) - (n - 1) / 2.0) * res_m           # metres from centre
    dlat = off / 111_320.0
    dlng = off / (111_320.0 * math.cos(math.radians(lat)))
    lons, lats = np.meshgrid(lng + dlng, lat + dlat[::-1])  # north-up
    ex, ey = np.meshgrid(off, off[::-1])
    return lons, lats, ex, ey


# ── reference imagery: Esri Wayback, fetched and cached ───────────────────────

def tile_bytes(url: str, release: int, z: int, x: int, y: int) -> bytes | None:
    # The release is part of the path, and leaving it out was a real bug: the
    # cache returned the first flight's tiles for every later one, two dates
    # came back byte-identical, and the change field was exactly zero. A cache
    # keyed on less than its inputs does not speed a pipeline up, it silently
    # answers a different question.
    p = TILES / str(release) / f"{z}" / f"{x}" / f"{y}.jpg"
    if p.exists():
        return p.read_bytes()
    p.parent.mkdir(parents=True, exist_ok=True)
    href = url.replace("{level}", str(z)).replace("{row}", str(y)).replace("{col}", str(x))
    with _fetch_lock:
        time.sleep(FETCH_GAP_S)
        proc = subprocess.run(
            # -L because some releases 301 to a CDN host; without it the body is
            # a 300-byte redirect page that PIL cheerfully fails to open.
            ["curl", "-fsSL", "-A", "masid-pipeline", "--max-time", "45", href],
            capture_output=True,
        )
    if proc.returncode != 0 or not proc.stdout:
        return None
    p.write_bytes(proc.stdout)
    return proc.stdout


def reference_chip(frame: dict, lat: float, lng: float) -> dict | None:
    """Stitch enough tiles to cover CHIP_M around the point, cached on disk."""
    mpp0 = metres_per_px(lat, ZOOM)
    # +2 rather than +1: the site sits at a fractional tile coordinate, so a
    # mosaic sized to the chip alone can leave the far edge of the grid outside
    # the canvas. The self-test found exactly that, which is what it is for.
    span = int(math.ceil((CHIP_M / mpp0) / 256.0)) + 2
    key = f"{frame['release']}_{lat:.6f}_{lng:.6f}_{ZOOM}_{CHIP_M}_{span}"
    meta_p = REF / f"{key}.json"
    img_p = REF / f"{key}.png"
    if meta_p.exists() and img_p.exists():
        return json.loads(meta_p.read_text())

    fx, fy = deg2tile(lat, lng, ZOOM)
    x0, y0 = int(math.floor(fx - span / 2.0)), int(math.floor(fy - span / 2.0))

    canvas = Image.new("RGB", (span * 256, span * 256))
    got = 0
    for dx in range(span):
        for dy in range(span):
            b = tile_bytes(frame["tileUrl"], frame["release"], ZOOM, x0 + dx, y0 + dy)
            if b is None:
                continue
            try:
                canvas.paste(Image.open(BytesIO(b)).convert("RGB"), (dx * 256, dy * 256))
                got += 1
            except Exception:
                pass
    if got < span * span:
        return None                                     # a partial mosaic is not a reference

    REF.mkdir(parents=True, exist_ok=True)
    canvas.save(img_p)
    meta = {"key": key, "png": img_p.name, "zoom": ZOOM, "x0": x0, "y0": y0,
            "span": span, "release": frame["release"], "flown": frame.get("flown")}
    meta_p.write_text(json.dumps(meta))
    return meta


def sample_reference(meta: dict, lons, lats) -> np.ndarray | None:
    """Luminance of the reference mosaic at each grid point."""
    img = Image.open(REF / meta["png"])
    arr = np.asarray(img, dtype=np.float32)
    lum = 0.2126 * arr[..., 0] + 0.7152 * arr[..., 1] + 0.0722 * arr[..., 2]

    n = 2.0 ** meta["zoom"]
    xr = (lons + 180.0) / 360.0 * n
    r = np.radians(lats)
    yr = (1.0 - np.log(np.tan(r) + 1.0 / np.cos(r)) / np.pi) / 2.0 * n
    px = ((xr - meta["x0"]) * 256.0).astype(int)
    py = ((yr - meta["y0"]) * 256.0).astype(int)
    if px.min() < 0 or py.min() < 0 or px.max() >= lum.shape[1] or py.max() >= lum.shape[0]:
        return None
    return lum[py, px]


# ── the super-resolved raster, read off disk ──────────────────────────────────

def sample_sr(path: Path, lons, lats, rgb: tuple[int, int, int]) -> np.ndarray | None:
    """Luminance of the model output at each grid point, in its own CRS."""
    with rasterio.open(path) as src:
        bands = rgb if src.count >= max(rgb) else (1, 2, 3)[: min(3, src.count)]
        xs, ys = warp_transform("EPSG:4326", src.crs,
                                lons.ravel().tolist(), lats.ravel().tolist())
        rr, cc = rowcol(src.transform, xs, ys)
        rr = np.asarray(rr).reshape(lons.shape)
        cc = np.asarray(cc).reshape(lons.shape)
        if rr.min() < 0 or cc.min() < 0 or rr.max() >= src.height or cc.max() >= src.width:
            return None
        planes = [src.read(b).astype(np.float32) for b in bands]
        if len(planes) == 3:
            lum = 0.2126 * planes[0] + 0.7152 * planes[1] + 0.0722 * planes[2]
        else:
            lum = np.mean(planes, axis=0)
        return lum[rr, cc]


# ── the statistic ─────────────────────────────────────────────────────────────

def norm(a: np.ndarray) -> np.ndarray:
    """Z-score, so brightness offsets and gain differences drop out."""
    m, s = np.nanmean(a), np.nanstd(a)
    return (a - m) / s if s > 1e-9 else a * 0.0


def structure(a: np.ndarray) -> np.ndarray:
    """Edge magnitude. A built structure is an edge before it is a brightness."""
    a = ndimage.gaussian_filter(a, 1.0)
    return np.hypot(ndimage.sobel(a, 0), ndimage.sobel(a, 1))


def corr(a: np.ndarray, b: np.ndarray, mask: np.ndarray) -> float | None:
    """Pearson r between two fields over a mask."""
    x, y = a[mask], b[mask]
    ok = np.isfinite(x) & np.isfinite(y)
    if ok.sum() < 30:
        return None
    x, y = x[ok] - x[ok].mean(), y[ok] - y[ok].mean()
    d = math.sqrt(float((x * x).sum()) * float((y * y).sum()))
    return float((x * y).sum() / d) if d > 1e-12 else None


def score_site(ref_b, ref_a, sr_b, sr_a, rng) -> dict | None:
    """Is the model's change field specific to THIS spot, or generic texture?

    THE NULL IS A DISPLACEMENT, AND THE FIRST VERSION OF IT WAS WRONG

    The obvious control — score the model at the site, then score it again at
    nearby discs — cannot answer the question. A model that reconstructed the
    province perfectly would agree with the reference everywhere, so the site
    would not stand out and the test would report "no evidence" about a model
    that was right. That is a false negative built into the statistic.

    So the reference patch stays fixed at the site and the MODEL patch moves.
    The question becomes whether the model's change field lines up with the
    reference's change field HERE better than the model's change field from
    sixty metres away does. Both extremes now behave:

        a model that resolves the structure   r_site high, displaced ~0  -> z large
        a model drawing plausible riverbank   r_site ~ displaced        -> z ~ 0

    which is exactly the distinction between recovering detail and inventing it.
    """
    d_ref = structure(norm(ref_a)) - structure(norm(ref_b))
    d_sr = structure(norm(sr_a)) - structure(norm(sr_b))

    n = d_ref.shape[0]
    c = n // 2
    r_px = int(SITE_R_M / GRID_RES_M)
    yy, xx = np.mgrid[-r_px:r_px + 1, -r_px:r_px + 1]
    disc = np.hypot(yy, xx) <= r_px

    def win(arr, dy=0, dx=0):
        return arr[c + dy - r_px: c + dy + r_px + 1, c + dx - r_px: c + dx + r_px + 1]

    ref_patch = win(d_ref)
    if ref_patch.shape != disc.shape:
        return None
    r_site = corr(ref_patch, win(d_sr), disc)
    if r_site is None:
        return None

    lo = int(CTRL_INNER_M / GRID_RES_M)
    hi = int(CTRL_OUTER_M / GRID_RES_M)
    nulls = []
    for _ in range(NULL_SAMPLES):
        for _try in range(20):
            ang = rng.uniform(0, 2 * math.pi)
            rad = rng.uniform(lo, hi)
            dy, dx = int(rad * math.sin(ang)), int(rad * math.cos(ang))
            if (r_px <= c + dy < n - r_px) and (r_px <= c + dx < n - r_px):
                break
        else:
            continue
        w = win(d_sr, dy, dx)
        if w.shape != disc.shape:
            continue
        v = corr(ref_patch, w, disc)     # reference stays put; the MODEL moves
        if v is not None:
            nulls.append(v)
    if len(nulls) < NULL_SAMPLES // 2:
        return None

    mu, sd = float(np.mean(nulls)), float(np.std(nulls))
    z = (r_site - mu) / sd if sd > 1e-9 else 0.0
    return {"rSite": round(r_site, 4), "nullMean": round(mu, 4),
            "nullSd": round(sd, 4), "z": round(z, 3),
            "percentile": round(float(np.mean([r_site > v for v in nulls])), 3),
            "nulls": len(nulls)}


# ── contracts and their flights ───────────────────────────────────────────────

def load_sites() -> list[dict]:
    projects = json.loads((APPDATA / "projects.json").read_text())
    rows = projects if isinstance(projects, list) else projects.get("projects", projects)
    return [r for r in rows if r.get("lat") and r.get("lng")]


def frames() -> list[dict]:
    w = json.loads((APPDATA / "wayback.json").read_text())
    fs = [f for f in w["frames"] if f.get("flown") or f.get("published")]
    for f in fs:
        f["date"] = (f.get("flown") or f["published"])[:10]
    return sorted(fs, key=lambda f: f["date"])


def pair_for(site: dict, fs: list[dict]) -> tuple[dict, dict] | None:
    """The last flight before work started, and the first after it was due to end."""
    s, e = (site.get("startDate") or "")[:10], (site.get("endDate") or "")[:10]
    if not s or not e:
        return None
    before = [f for f in fs if f["date"] < s]
    after = [f for f in fs if f["date"] > e]
    if not before or not after:
        return None
    return before[-1], after[0]


# ── commands ──────────────────────────────────────────────────────────────────

def cmd_plan(args) -> int:
    fs, sites = frames(), load_sites()
    out, skipped = [], {"no dates or no straddling pair": 0, "flight predates Sentinel-2": 0,
                        "no clear scene near a flight": 0}

    for site in sites[: args.limit]:
        pair = pair_for(site, fs)
        if not pair:
            skipped["no dates or no straddling pair"] += 1
            continue
        lat, lng = float(site["lat"]), float(site["lng"])
        d = 0.006                                  # ~650 m box, comfortably over the chip
        bbox = (round(lng - d, 6), round(lat - d, 6), round(lng + d, 6), round(lat + d, 6))

        legs, bad = [], None
        for role, f in (("before", pair[0]), ("after", pair[1])):
            fd = date.fromisoformat(f["date"])
            if fd < S.S2_EPOCH:
                bad = "flight predates Sentinel-2"
                break
            scenes = S.search_scenes(bbox, fd - timedelta(days=args.window_days),
                                     fd + timedelta(days=args.window_days))
            if not scenes:
                bad = "no clear scene near a flight"
                break
            best = scenes[0]                        # search_scenes sorts least-cloudy first
            legs.append({"role": role, "release": f["release"], "flown": f["date"],
                         "sceneId": best["id"], "sceneDate": best["datetime"],
                         "cloud": round(best["cloud"], 1),
                         "lagDays": abs((date.fromisoformat(best["datetime"]) - fd).days)})
        if bad:
            skipped[bad] += 1
            continue

        out.append({"id": site["id"], "lat": lat, "lng": lng, "bbox": list(bbox),
                    "municipality": site.get("municipality"),
                    "startDate": site.get("startDate"), "endDate": site.get("endDate"),
                    "legs": legs})

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "worklist.json").write_text(json.dumps(
        {"generated": date.today().isoformat(), "windowDays": args.window_days,
         "chipMetres": CHIP_M, "sites": out, "skipped": skipped}, indent=1))

    print(f"planned {len(out)} sites  ({len(out) * 2} scene-legs)")
    for k, v in skipped.items():
        if v:
            print(f"  skipped {v:>5}  {k}")
    scenes = sorted({leg["sceneId"] for s in out for leg in s["legs"]})
    print(f"\n{len(scenes)} distinct Sentinel-2 scenes to run through the S2DR3 Colab:")
    for s in scenes[:40]:
        print("   ", s)
    if len(scenes) > 40:
        print(f"    … and {len(scenes) - 40} more, all listed in data/superres/worklist.json")
    print(f"\nSave each output as  {OUT / 'sr'}/<contractId>_<before|after>.tif")
    return 0


def cmd_fetch(args) -> int:
    wl = json.loads((OUT / "worklist.json").read_text())
    fs = {f["release"]: f for f in frames()}
    ok = miss = 0
    for site in wl["sites"][: args.limit]:
        for leg in site["legs"]:
            m = reference_chip(fs[leg["release"]], site["lat"], site["lng"])
            if m:
                ok += 1
            else:
                miss += 1
                print(f"  no complete mosaic  {site['id']} {leg['role']} {leg['flown']}")
    print(f"reference chips: {ok} cached, {miss} incomplete  →  {REF}")
    return 0


def cmd_score(args) -> int:
    wl = json.loads((OUT / "worklist.json").read_text())
    fs = {f["release"]: f for f in frames()}
    rgb = tuple(int(x) for x in args.rgb.split(","))
    rng = random.Random(20260819)
    sr_dir = Path(args.sr_dir) if Path(args.sr_dir).is_absolute() else ROOT / args.sr_dir

    rows, missing = [], 0
    for site in wl["sites"]:
        paths = {leg["role"]: sr_dir / f"{site['id']}_{leg['role']}.tif" for leg in site["legs"]}
        if not all(p.exists() for p in paths.values()):
            missing += 1
            continue
        lons, lats, _ex, _ey = local_grid(site["lat"], site["lng"], CHIP_M, GRID_RES_M)

        chips = {}
        for leg in site["legs"]:
            m = reference_chip(fs[leg["release"]], site["lat"], site["lng"])
            chips[leg["role"]] = sample_reference(m, lons, lats) if m else None
        srs = {r: sample_sr(p, lons, lats, rgb) for r, p in paths.items()}
        if any(v is None for v in list(chips.values()) + list(srs.values())):
            print(f"  unreadable  {site['id']}")
            continue

        res = score_site(chips["before"], chips["after"], srs["before"], srs["after"], rng)
        if res:
            res.update({"id": site["id"], "municipality": site.get("municipality")})
            rows.append(res)

    if not rows:
        print(f"nothing to score: {missing} sites have no super-resolved pair in {sr_dir}")
        print("run `plan`, put the scenes through the Colab, then `fetch` and `score` again.")
        return 1

    zs = np.array([r["z"] for r in rows])
    beat = float(np.mean(zs > 2.0))
    report = {
        "generated": date.today().isoformat(),
        "method": ("Change in edge magnitude between the pre-construction and post-completion "
                   f"flights, compared at {SITE_R_M} m against a null of {NULL_SAMPLES} discs of "
                   f"the same radius drawn from a {CTRL_INNER_M}-{CTRL_OUTER_M} m ring in the same "
                   "chip, with the REFERENCE patch held at the site and the MODEL patch displaced. Reference is Esri Wayback at ~0.29 m/px; model output is read from disk "
                   "and never fetched by this project."),
        "sites": len(rows),
        "medianZ": round(float(np.median(zs)), 3),
        "meanZ": round(float(zs.mean()), 3),
        "shareAboveZ2": round(beat, 3),
        "verdict": ("super-resolution agrees with sub-metre reference at contract coordinates "
                    "more than at nearby control discs")
        if beat > 0.2 else
                   ("NO EVIDENCE that super-resolution recovers site-specific structure: "
                    "agreement at contract coordinates is indistinguishable from agreement "
                    "at nearby discs where nothing was built"),
        "perSite": sorted(rows, key=lambda r: -r["z"]),
    }
    (OUT / "report.json").write_text(json.dumps(report, indent=1))

    print(f"\nscored {len(rows)} sites   ({missing} without a super-resolved pair)")
    print(f"  median z {report['medianZ']:+.2f}   mean z {report['meanZ']:+.2f}"
          f"   share above z=2: {beat:.1%}")
    print(f"\n  {report['verdict']}\n")
    for r in report["perSite"][:12]:
        print(f"   z {r['z']:+6.2f}  r {r['rSite']:+.3f} vs null {r['nullMean']:+.3f}"
              f" ±{r['nullSd']:.3f}   {r['id']}  {r.get('municipality') or ''}")
    print(f"\nwritten to {OUT / 'report.json'} — and nowhere under src/app/data, by design.")
    return 0


def cmd_selftest(args) -> int:
    """Prove the statistic can tell recovery from invention, before anyone runs a model.

    verify_data.py gates the rest of the pipeline for the same reason: a check
    nobody has run on a case with a known answer is not a check. Three stand-ins
    are scored against the cached reference chips, and the expected ordering is
    stated in advance:

      perfect   the model output IS the reference          -> z must be large
      shifted   the reference, moved 15 m                  -> z must fall
      noise     smoothed random field, no shared structure -> z must be ~ 0

    If perfect does not separate from noise, the metric cannot support any claim
    about a real model and the run is a failure regardless of what it prints.
    """
    wl = json.loads((OUT / "worklist.json").read_text())
    fs = {f["release"]: f for f in frames()}
    rng = random.Random(20260819)
    got = {"perfect": [], "shifted": [], "noise": []}

    for site in wl["sites"][: args.limit]:
        lons, lats, _ex, _ey = local_grid(site["lat"], site["lng"], CHIP_M, GRID_RES_M)
        chips = {}
        for leg in site["legs"]:
            m = reference_chip(fs[leg["release"]], site["lat"], site["lng"])
            chips[leg["role"]] = sample_reference(m, lons, lats) if m else None
        if any(v is None for v in chips.values()):
            continue
        rb, ra = chips["before"], chips["after"]

        sh = int(15 / GRID_RES_M)
        cases = {
            "perfect": (rb, ra),
            "shifted": (np.roll(rb, sh, axis=1), np.roll(ra, sh, axis=1)),
            "noise": (ndimage.gaussian_filter(np.random.default_rng(1).normal(size=rb.shape), 2.0),
                      ndimage.gaussian_filter(np.random.default_rng(2).normal(size=ra.shape), 2.0)),
        }
        for name, (sb, sa) in cases.items():
            r = score_site(rb, ra, sb, sa, rng)
            if r:
                got[name].append(r["z"])

    if not got["perfect"]:
        print("no cached reference chips — run `plan` then `fetch` first.")
        return 1

    med = {k: float(np.median(v)) if v else float("nan") for k, v in got.items()}
    print(f"\nself-test over {len(got['perfect'])} sites (median z):")
    for k in ("perfect", "shifted", "noise"):
        print(f"   {k:<8} {med[k]:+8.2f}   n={len(got[k])}")

    ok = med["perfect"] > 3.0 and abs(med["noise"]) < 1.5 and med["perfect"] > med["shifted"]
    print("\n   PASS — the statistic separates recovery from invention\n" if ok else
          "\n   FAIL — the statistic cannot support a claim about any model\n")
    return 0 if ok else 1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("plan", help="match Sentinel-2 scenes to Wayback flights")
    p.add_argument("--limit", type=int, default=25)
    p.add_argument("--window-days", type=int, default=WINDOW_DAYS)
    p.set_defaults(fn=cmd_plan)

    p = sub.add_parser("fetch", help="cache Wayback reference chips")
    p.add_argument("--limit", type=int, default=25)
    p.set_defaults(fn=cmd_fetch)

    p = sub.add_parser("selftest", help="prove the statistic works, using the reference alone")
    p.add_argument("--limit", type=int, default=8)
    p.set_defaults(fn=cmd_selftest)

    p = sub.add_parser("score", help="score model output already on disk")
    p.add_argument("--sr-dir", default="data/superres/sr")
    p.add_argument("--rgb", default="4,3,2", help="1-based band indices for R,G,B")
    p.set_defaults(fn=cmd_score)

    args = ap.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    raise SystemExit(main())
