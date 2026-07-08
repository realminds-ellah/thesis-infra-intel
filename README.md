# Bulacan Flood-Control — Clean-Project Audit

**Purpose.** Determine your *real* N: how many DPWH flood-control projects in Bulacan
survive the filters needed for a defensible causal estimate. This is the month-one
kill-or-continue test. If clean-N (direct) < 20, stop and re-scope the estimand
BEFORE writing any method.

Every filter below enforces one identification assumption. A project fails the audit
exactly when keeping it would break a causal assumption — not for bureaucratic reasons.

---

## The eligibility checklist (each criterion → the assumption it protects)

| # | Filter | Keep if… | Protects |
|---|--------|----------|----------|
| F0 | **Geolocatable** | Has coordinates, or a location string that resolves to a point ≤500 m error | Any spatial analysis at all |
| F1 | **Attributes present** | Completion date + cost + type all known (not blank/"ongoing") | Treatment timing; scale floor |
| F2 | **SAR window** | Completed in `[2016-07, study_end − 12mo]`; ≥12 mo of Sentinel-1 coverage both pre and post | No-anticipation; pre-trend estimability; measurement window |
| F3 | **Scale floor** | cost ≥ ₱5M **OR** structure length ≥ 100 m **OR** protected area ≥ threshold | **Effect-size floor** — power analysis proved marginal projects (τ≈−0.03) are statistically invisible; excluding them is honest, not cherry-picking |
| F4 | **Hydrological type** | dike / floodwall / revetment / drainage / dredging / retarding basin / slope protection — NOT "rehab of building", pure riprap <50 m, signage | Effect must have a plausible hydrological footprint |
| F5 | **Delineable catchment** | Point snaps to a MERIT-Hydro stream ≤500 m; contributing area computable | Exposure mapping `g_i(D)` is constructable |
| F6 | **Isolation (SUTVA)** ⚠️ | **No other qualifying project** completed in the same catchment (or within flow-distance D up/down-stream) during `[pre_start, post_end]` | **Partial-interference / SUTVA** — the killer filter. Co-located projects contaminate each other's counterfactual |
| F7 | **Outcome observability** | Affected area shows ≥1 detectable open-water flood event in the SAR record (not 100% canopy/building-obscured) | Latent outcome is actually measurable by SAR |
| F8 | **Downstream density** (spillover subsample) | ≥1 populated barangay (WorldPop > thr) within downstream flow-distance D | **Spillover power** — from power analysis, the novel estimand is driven by # downstream-exposed units, not N_t |

**Tiering of survivors:**
- **Tier A** — passes F0–F8 → usable for BOTH direct and spillover estimands.
- **Tier B** — passes F0–F7, fails F8 → direct effect only.
- **Tier C** — passes F0–F5 but borderline on F6/F7 → sensitivity analyses only, not headline.
- **Excluded** — fails any of F0–F5.

---

## Expected attrition funnel (plan for brutal shrinkage)

These are planning estimates — replace with your real counts. The point is to
*expect* the collapse so you're not blindsided.

```
Raw DPWH Bulacan flood-control line items      ~800–2000   (100%)
  └─ F0 geolocatable                            ~70%
  └─ F1 attributes present                      ~60%
  └─ F2 SAR window                              ~45%
  └─ F3 scale floor (drops the culverts)        ~30%
  └─ F4 hydrological type                       ~25%
  └─ F5 delineable catchment                    ~22%
  └─ F6 ISOLATION  ← biggest cut                ~8–12%    ← clean-N (direct)
  └─ F7 observable outcome                       ~7–10%
  └─ F8 downstream-dense                         ~4–7%    ← clean-N (spillover)
```

**Decision gates (from the power table):**
- clean-N(direct) ≥ 30 and SAR noise moderate → **GO**, direct effect is well-powered.
- clean-N(direct) 20–30 → **GO but pre-register** a size-stratified analysis; expect wide CIs.
- clean-N(direct) < 20 → **STOP.** Re-scope: aggregate to sub-basin level, or switch to
  a single well-instrumented mega-project as a synthetic-control case study.
- clean-N(spillover) < ~40 downstream-exposed units → treat spillover as exploratory,
  not confirmatory; concentrate the study on ONE downstream-dense sub-basin to boost it.

---

## Query plan (data sources & how to pull them)

**Backbone: Google Earth Engine (GEE) Python API** — free, hosts SAR + rainfall + DEM +
population at scale. Plus `geopandas` for vector filtering, `pysheds`/`whitebox` for local
catchment delineation.

| Layer | Source | Access |
|-------|--------|--------|
| **Treatment** (projects, cost, completion, type) | DPWH Flood-Control map / Sumbong-sa-Pangulo flood DB; PhilGEPS contract awards; COA reports | Scrape/download → CSV/GeoJSON. This is your rate-limiting, manual-cleanup step |
| **Outcome** (flood extent) | Sentinel-1 SAR GRD | GEE `COPERNICUS/S1_GRD` |
| **Rainfall confounder** | CHIRPS daily; GPM IMERG | GEE `UCSB-CHG/CHIRPS/DAILY`, `NASA/GPM_L3/IMERG_V07` |
| **Flow DAG / exposure weights** | MERIT Hydro (flow accum + direction) | GEE `MERIT/Hydro/v1_0_1`; local delineation on FABDEM via `pysheds` |
| **DEM** | FABDEM (bare-earth) / SRTM | `projects/sat-io/open-datasets/FABDEM`; `USGS/SRTMGL1_003` |
| **Exposure / population** | WorldPop, Meta HRSL | GEE `WorldPop/GP/100m/pop` |
| **Permanent water mask** (avoid false floods) | JRC Global Surface Water | GEE `JRC/GSW1_4/GlobalSurfaceWater` |
| **Vulnerability** | CBMS, PSA barangay poverty | Manual download |

**Order of operations (do NOT reorder — cheap filters first):**
1. Pull & clean the DPWH list → dataframe with `(id, lon, lat, cost, completion_date, type, length)`.
2. Apply F0–F4 in pandas (pure tabular, no cloud calls) — this alone drops ~75%.
3. For survivors only: snap to MERIT stream, delineate catchment (F5).
4. **F6 isolation** = self-join survivors on catchment/flow-distance × time window. Cheap, decisive.
5. For F6 survivors only: pull SAR + rainfall time series per catchment (F7). Expensive — that's why it's last.
6. F8 downstream-density from WorldPop along the flow DAG.
7. Emit `audit_report.csv` with per-project tier + the funnel counts.

Run `audit.py` to execute steps 2–7 on your cleaned list. Tune thresholds in `criteria.yaml`.
