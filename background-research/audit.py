#!/usr/bin/env python3
"""
Feasibility audit for the ghost-detection thesis (angle A).

Two jobs:
  1. APPLICATION SET  — filter the DPWH project list down to the projects that can
     actually be checked from space (right type, big enough, imagery exists).
  2. VALIDATION LABELS — count how many confirmed-ghost + confirmed-real labels you
     have, and compare to the targets the power analysis says you need.

The study is VALIDATION-limited, not data-limited: the application set is large, but
your accuracy claim is only as strong as your labels. This script tells you both
numbers and gives a GO / NEED-MORE-LABELS verdict.

Usage:
    python audit.py --projects dpwh_bulacan_clean.geojson --labels coa_confirmed.csv
    # --no-ee stops before the imagery-availability check (F5) if GEE isn't set up yet.

Deps: pandas geopandas pyyaml  (+ earthengine-api for F5)
"""
import argparse, sys
import pandas as pd

def load_criteria(path):
    import yaml
    with open(path) as f: return yaml.safe_load(f)

def load_projects(path):
    """Columns: id, lon, lat, cost_php, completion_date, type_raw, length_m, area_m2(optional)."""
    import geopandas as gpd
    gdf = gpd.read_file(path)
    gdf["completion_date"] = pd.to_datetime(gdf.get("completion_date"), errors="coerce")
    return gdf

class Funnel:
    def __init__(self, n): self.rows=[("raw project list", n)]; self.n0=n
    def step(self, name, gdf): self.rows.append((name, len(gdf))); return gdf
    def report(self):
        print("\n=== APPLICATION-SET FUNNEL (projects checkable from space) ===")
        for name, n in self.rows:
            print(f"  {name:34s} {n:6d}   ({100*n/max(self.n0,1):5.1f}%)")

# ---------------------------------------------------------------- F0-F4 (offline)
def f0_has_location(gdf):
    # keep even if the coordinate is wrong: it's the seed for a search (radius in criteria)
    return gdf[gdf.geometry.notna() & gdf.lon.notna() & gdf.lat.notna()].copy()

def f1_attributes(gdf):
    return gdf[gdf.completion_date.notna() & gdf.cost_php.notna() & gdf.type_raw.notna()].copy()

def f2_imagery_window(gdf, c):
    w = c["imagery_window"]
    s = pd.Timestamp(w["start"]); e = pd.Timestamp(w["end"])
    pre = pd.DateOffset(months=w["min_pre_months"]); post = pd.DateOffset(months=w["min_post_months"])
    ok = (gdf.completion_date >= s + pre) & (gdf.completion_date <= e - post)
    return gdf[ok].copy()

def normalize_type(s):
    s = str(s).lower()
    table = {"dike":"dike","levee":"dike","revetment":"revetment","riprap":"revetment",
             "dredg":"dredging","desilt":"dredging","retard":"retarding_basin","detention":"retarding_basin",
             "slope":"slope_protection","river control":"river_control","flood control":"river_control",
             "floodwall":"floodwall","flood wall":"floodwall","drainage":"drainage","culvert":"drainage"}
    for k, v in table.items():
        if k in s: return v
    return "other"

def f3_verifiable_type(gdf, c):
    gdf["type_norm"] = gdf.type_raw.map(normalize_type)
    keep = gdf[gdf.type_norm.isin(c["verifiable_types"])].copy()
    blind = gdf[~gdf.type_norm.isin(c["verifiable_types"])]
    print(f"  [F3] {len(blind)} projects are NOT satellite-verifiable "
          f"(thin/small types) -> report as accountability blind spot")
    return keep

def f4_footprint(gdf, c):
    f = c["footprint_floor"]
    length = gdf.get("length_m", pd.Series(0, index=gdf.index)).fillna(0)
    area   = gdf.get("area_m2",  pd.Series(0, index=gdf.index)).fillna(0)
    return gdf[(length >= f["min_length_m"]) | (area >= f["min_area_m2"])].copy()

# ---------------------------------------------------------------- F5 (Earth Engine)
def f5_imagery_available(gdf, c, ee_ready):
    """Keep projects with usable, cloud-free NICFI/Sentinel before AND after the
    construction window, within search_radius_m of the (unreliable) declared point.

    TODO with earthengine-api:
      - box = point.buffer(search_radius_m)
      - NICFI monthly mosaics pre/post; reject if cloud > max_cloud_pct
      - confirm Sentinel-1 pairs exist for coherence
    Stub passes everything so the offline funnel runs end-to-end."""
    if not ee_ready:
        print("  [F5] SKIPPED (no --ee). Survivors = application-set upper bound.")
        return gdf
    print("  [F5] STUB — implement NICFI/Sentinel availability + cloud check")
    return gdf

# ---------------------------------------------------------------- validation labels
def label_report(labels_path, c):
    print("\n=== VALIDATION LABELS (what makes the accuracy claim believable) ===")
    v = c["validation_targets"]; need = c["decision"]["go_total_labels"]
    if not labels_path:
        print("  No --labels file. Start with COA's ~21 confirmed ghosts, then self-verify"
              f" on high-res imagery to reach {v['min_ghost_labels']} ghost + {v['min_legit_labels']} real.")
        return
    lab = pd.read_csv(labels_path)          # columns: id, label in {ghost, legit}, source
    ng = (lab.label == "ghost").sum(); nl = (lab.label == "legit").sum()
    print(f"  confirmed ghost: {ng:3d}  (target {v['min_ghost_labels']}, strong {v['strong_labels_each']})")
    print(f"  confirmed real : {nl:3d}  (target {v['min_legit_labels']}, strong {v['strong_labels_each']})")
    total = ng + nl
    print("\n=== DECISION ===")
    if ng >= v["strong_labels_each"] and nl >= v["strong_labels_each"]:
        print(f"  {total} labels -> STRONG. Tight accuracy claim available.")
    elif total >= need and ng >= v["min_ghost_labels"] and nl >= v["min_legit_labels"]:
        print(f"  {total} labels -> GO. AUC 95% CI half-width < 0.10 (publishable-tight).")
    else:
        gap_g = max(0, v["min_ghost_labels"]-ng); gap_l = max(0, v["min_legit_labels"]-nl)
        print(f"  {total} labels -> NEED MORE. Self-verify +{gap_g} ghost, +{gap_l} real on high-res imagery"
              f" (a weekend of eyeballing).")

# ---------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--projects", required=True)
    ap.add_argument("--labels", default=None, help="CSV: id,label(ghost|legit),source")
    ap.add_argument("--criteria", default="criteria.yaml")
    ap.add_argument("--ee", action="store_true", help="run F5 imagery check (needs Earth Engine)")
    ap.add_argument("--out", default="application_set.csv")
    args = ap.parse_args()

    c = load_criteria(args.criteria)
    gdf = load_projects(args.projects)
    fn = Funnel(len(gdf))
    gdf = fn.step("F0 has location",       f0_has_location(gdf))
    gdf = fn.step("F1 attributes",         f1_attributes(gdf))
    gdf = fn.step("F2 imagery window",     f2_imagery_window(gdf, c))
    gdf = fn.step("F3 verifiable type",    f3_verifiable_type(gdf, c))
    gdf = fn.step("F4 footprint big enough", f4_footprint(gdf, c))
    gdf = fn.step("F5 imagery available",  f5_imagery_available(gdf, c, args.ee))
    fn.report()

    label_report(args.labels, c)

    gdf.drop(columns="geometry", errors="ignore").to_csv(args.out, index=False)
    print(f"\nWrote application set -> {args.out}  ({len(gdf)} projects to score)")

if __name__ == "__main__":
    sys.exit(main())
