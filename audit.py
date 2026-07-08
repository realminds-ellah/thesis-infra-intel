#!/usr/bin/env python3
"""
Clean-project audit for the Bulacan flood-control causal thesis.

Runs the F0-F8 funnel (see README.md) over a cleaned DPWH project list and emits
a tiered audit_report.csv plus the attrition funnel. Every filter enforces one
identification assumption; a project is dropped only when keeping it would break one.

Steps 2-4 (F0-F6) are pure tabular/vector and run offline in seconds.
Steps 5-6 (F7-F8) need Earth Engine; they run ONLY on F6 survivors, so they're cheap.

Usage:
    python audit.py --projects dpwh_bulacan_clean.geojson --criteria criteria.yaml
    # add --no-ee to stop after F6 (the decisive filter) if you haven't set up GEE yet.

Deps: pandas geopandas shapely pyyaml  (+ earthengine-api pysheds for F5/F7/F8)
"""
import argparse, sys
import pandas as pd

# ----------------------------------------------------------------------------- setup
def load_criteria(path):
    import yaml
    with open(path) as f:
        return yaml.safe_load(f)

def load_projects(path):
    """Expect columns: id, lon, lat, cost_php, completion_date, type_raw, length_m.
    Missing values are allowed here — the filters below are what remove them."""
    import geopandas as gpd
    gdf = gpd.read_file(path)
    gdf["completion_date"] = pd.to_datetime(gdf.get("completion_date"), errors="coerce")
    return gdf

class Funnel:
    """Accounts for attrition and prints the collapse so you're never blindsided."""
    def __init__(self, n): self.rows=[("raw", n)]; self.n0=n
    def step(self, name, gdf):
        self.rows.append((name, len(gdf)))
        return gdf
    def report(self):
        print("\n=== ATTRITION FUNNEL ===")
        for name, n in self.rows:
            print(f"  {name:28s} {n:6d}   ({100*n/max(self.n0,1):5.1f}%)")

# ----------------------------------------------------------------- F0-F4 (offline)
def f0_geolocatable(gdf):
    return gdf[gdf.geometry.notna() & gdf.lon.notna() & gdf.lat.notna()].copy()

def f1_attributes(gdf):
    return gdf[gdf.completion_date.notna() & gdf.cost_php.notna() & gdf.type_raw.notna()].copy()

def f2_sar_window(gdf, c):
    s = pd.Timestamp(c["study"]["sar_start"]); e = pd.Timestamp(c["study"]["study_end"])
    pre = pd.DateOffset(months=c["study"]["min_pre_months"])
    post = pd.DateOffset(months=c["study"]["min_post_months"])
    ok = (gdf.completion_date >= s + pre) & (gdf.completion_date <= e - post)
    return gdf[ok].copy()

def f3_scale_floor(gdf, c):
    sc = c["scale_floor"]
    big = (gdf.cost_php.fillna(0) >= sc["min_cost_php"]) | \
          (gdf.get("length_m", pd.Series(0,index=gdf.index)).fillna(0) >= sc["min_length_m"])
    return gdf[big].copy()

def normalize_type(s):
    s = str(s).lower()
    table = {"dike":"dike","levee":"dike","floodwall":"floodwall","flood wall":"floodwall",
             "revetment":"revetment","riprap":"revetment","drainage":"drainage","canal":"drainage",
             "dredging":"dredging","desilting":"dredging","retarding":"retarding_basin",
             "detention":"retarding_basin","slope":"slope_protection","river control":"river_control",
             "flood control":"river_control"}
    for k, v in table.items():
        if k in s: return v
    return "other"

def f4_hydrological(gdf, c):
    gdf["type_norm"] = gdf.type_raw.map(normalize_type)
    return gdf[gdf.type_norm.isin(c["hydrological_types"])].copy()

# ----------------------------------------------------------------- F5-F6 (vector/graph)
def f5_catchment(gdf, c):
    """Snap each project to the MERIT-Hydro stream network and delineate its catchment.
    Fill `catchment_id`, `contrib_km2`. Reject if unsnappable or contributing area too small.

    TODO: implement with pysheds/whitebox on a FABDEM tile, or MERIT flow-accum on GEE:
      - snap point to stream (max snap_max_m)
      - delineate upstream catchment -> polygon + contributing area
    Stub below marks all as passing so the pipeline runs end-to-end on test data."""
    snap = c["catchment"]["snap_max_m"]; minA = c["catchment"]["min_contrib_km2"]
    if "catchment_id" not in gdf:      # <-- replace this stub with real delineation
        gdf["catchment_id"] = range(len(gdf))
        gdf["contrib_km2"]  = minA + 1.0
        print(f"  [F5] STUB — implement MERIT/pysheds delineation (snap={snap}m, minA={minA}km2)")
    return gdf[gdf.contrib_km2 >= minA].copy()

def f6_isolation(gdf, c):
    """SUTVA filter. Drop any project that shares its hydrological neighborhood
    (same catchment OR within flow_distance_km up/downstream) with another qualifying
    project whose window overlaps. This is the decisive cut — expect the big collapse here."""
    pre = pd.DateOffset(months=c["study"]["min_pre_months"])
    post = pd.DateOffset(months=c["study"]["min_post_months"])
    keep = []
    for i, r in gdf.iterrows():
        lo, hi = r.completion_date - pre, r.completion_date + post
        # neighbors = same catchment (extend with a flow-distance graph query for full rigor)
        nbrs = gdf[(gdf.catchment_id == r.catchment_id) & (gdf.id != r.id)]
        contaminated = (
            (nbrs.completion_date >= lo) & (nbrs.completion_date <= hi)
        ).any()
        if not contaminated:
            keep.append(i)
    return gdf.loc[keep].copy()

# ----------------------------------------------------------------- F7-F8 (Earth Engine)
def f7_observability(gdf, c, ee_ready):
    """Keep only catchments where SAR actually detects open-water flooding at least once
    (else the outcome is latent-and-unmeasurable there). Requires GEE.

    TODO: for each catchment, build Sentinel-1 VV series, mask JRC permanent water,
    threshold at sar_water_db_threshold, count distinct flood events > min_flood_events."""
    if not ee_ready:
        print("  [F7] SKIPPED (no --ee). Survivors so far = clean-N(direct) upper bound.")
        gdf["flood_events"] = pd.NA
        return gdf
    # ... ee.ImageCollection('COPERNICUS/S1_GRD') per catchment ...
    print("  [F7] STUB — implement Sentinel-1 flood-event counting")
    return gdf

def f8_downstream(gdf, c, ee_ready):
    """Flag the spillover subsample: catchments with populated barangays downstream."""
    if not ee_ready:
        gdf["downstream_pop"] = pd.NA
        gdf["tier"] = "B_or_A_unknown"
        return gdf
    # ... WorldPop head-count within downstream flow-distance along MERIT DAG ...
    print("  [F8] STUB — implement WorldPop downstream head-count")
    return gdf

def assign_tiers(gdf, c):
    def tier(r):
        if pd.notna(r.get("downstream_pop")) and r.downstream_pop >= c["downstream"]["min_pop"] \
           and pd.notna(r.get("flood_events")) and r.flood_events >= c["observability"]["min_flood_events"]:
            return "A"
        if pd.notna(r.get("flood_events")) and r.flood_events >= c["observability"]["min_flood_events"]:
            return "B"
        return "C"
    gdf["tier"] = gdf.apply(tier, axis=1)
    return gdf

# ----------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--projects", required=True)
    ap.add_argument("--criteria", default="criteria.yaml")
    ap.add_argument("--ee", action="store_true", help="run F7/F8 (needs Earth Engine auth)")
    ap.add_argument("--out", default="audit_report.csv")
    args = ap.parse_args()

    c = load_criteria(args.criteria)
    gdf = load_projects(args.projects)
    fn = Funnel(len(gdf))

    gdf = fn.step("F0 geolocatable", f0_geolocatable(gdf))
    gdf = fn.step("F1 attributes",   f1_attributes(gdf))
    gdf = fn.step("F2 SAR window",   f2_sar_window(gdf, c))
    gdf = fn.step("F3 scale floor",  f3_scale_floor(gdf, c))
    gdf = fn.step("F4 hydrological", f4_hydrological(gdf, c))
    gdf = fn.step("F5 catchment",    f5_catchment(gdf, c))
    gdf = fn.step("F6 ISOLATION",    f6_isolation(gdf, c))   # <-- decisive cut
    clean_direct = len(gdf)

    gdf = fn.step("F7 observable",   f7_observability(gdf, c, args.ee))
    gdf = fn.step("F8 downstream",   f8_downstream(gdf, c, args.ee))
    if args.ee:
        gdf = assign_tiers(gdf, c)

    fn.report()

    # ---- decision gate (mirrors the power table) ----
    g = c["decision_gates"]
    print("\n=== DECISION ===")
    print(f"  clean-N(direct, pre-F7) = {clean_direct}")
    if clean_direct >= g["go_direct"]:
        print(f"  >= {g['go_direct']}  → GO. Direct effect is well-powered.")
    elif clean_direct >= g["caution_direct"]:
        print(f"  {g['caution_direct']}-{g['go_direct']}  → GO WITH CAUTION. Pre-register size-stratified analysis; expect wide CIs.")
    else:
        print(f"  < {g['caution_direct']}  → STOP & RE-SCOPE (aggregate to sub-basin, or single-project synthetic control).")
    if args.ee and "tier" in gdf:
        nA = (gdf.tier == "A").sum()
        print(f"  clean-N(spillover, Tier A) = {nA}  "
              f"({'ok' if nA >= g['go_spillover'] else 'exploratory only — concentrate on one downstream-dense sub-basin'})")

    gdf.drop(columns="geometry", errors="ignore").to_csv(args.out, index=False)
    print(f"\nWrote {args.out}")

if __name__ == "__main__":
    sys.exit(main())
