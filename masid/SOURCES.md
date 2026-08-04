# Sources and limits

Every number in this build traces to one of the datasets below. Nothing is
simulated, estimated, or carried over from the design mock. Where the public
record has no value, the interface says so rather than showing a plausible one.

Dataset built **3 August 2026** from records last updated 22 January 2026.

## Verification

`pipeline/verify_data.py` gates every other pipeline and must pass before they
run. It exists because this project shipped one tier built on an unchecked
assumption about a column's meaning, and a whole screen built on a claim that was
false.

- **Cross-export** — the flat and detail BetterGov exports agree on *every* shared
  field across all 1,293 contracts: budget, amountPaid, progress, status,
  contractor, latitude, longitude, infraYear. Detail is a strict superset (201
  extra contracts, no duplicate ids).
- **Structure** — every contract has ≥1 bidder and at most one winner; `abc` is
  positive on 100%; `awardAmount ≤ abc` on 100%; the bid ratio is inside 0.5–1.0
  on 100%; advertisement ≤ bid deadline ≤ award date, and start ≤ completion, on
  100%.
- **Reachability** — sampled document URLs resolve (12/12).
- **Primary source** — contract `22CC0095`'s published Notice of Award states
  *"Forty Three Million Two Hundred Seventy Six Thousand Four Hundred Twenty Eight
  Pesos and 28/100 (P43,276,428.28)"*; the row's `awardAmount` is `43276428.28`.
  Exact to the centavo, with contractor and municipality also matching. One spot
  check is not a guarantee, but it is the difference between trusting a mirror and
  having tested it.

Known warnings, none blocking: 26 contracts have no winner flagged (they are the
26 with a null contractor), 9.2% of bidder entries lack a PCAB id, and one
contract has an award date after its start date.

---

## 1. DPWH infrastructure transparency records

| | |
|---|---|
| **Dataset** | [`bettergovph/dpwh-transparency-data`](https://huggingface.co/datasets/bettergovph/dpwh-transparency-data) (HuggingFace) |
| **Publisher** | [BetterGov.ph](https://bettergov.ph), a volunteer civic-tech project |
| **Upstream** | Scrape of the DPWH transparency portal, <https://infrastructure.dpwh.gov.ph/> |
| **Licence** | CC0-1.0 (public domain dedication) |
| **Size** | 248,220 project records nationwide, all infrastructure categories |
| **File** | `dpwh_transparency_data.parquet`, 24 MB |

**Fields used:** `contractId`, `description`, `category`, `status`, `budget`,
`amountPaid`, `progress`, `location.province`, `location.region`, `contractor`,
`startDate`, `completionDate`, `infraYear`, `sourceOfFunds`, `latitude`,
`longitude`, `hasSatelliteImage`, `reportCount`.

**Slice loaded:** `category` contains "Flood" **and** `location.province` is
`Bulacan 1st DEO` → **1,293 records, 2016–2025, ₱67.75 B awarded, 176
contractors.**

This is a third-party mirror, not a DPWH release. It should be treated as
faithful-but-unofficial: good enough to build and reason on, not good enough to
cite as the government's own position in a published finding. Re-verify any
individual record against the portal before it appears in the thesis.

## 2. Sentinel-2 L2A imagery

| | |
|---|---|
| **Data** | Sentinel-2 L2A Cloud-Optimised GeoTIFFs, AWS Open Data (`s3://sentinel-cogs/`) |
| **Index** | [Element 84 Earth Search STAC v1](https://earth-search.aws.element84.com/v1) |
| **Producer** | Copernicus Sentinel data, ESA |
| **Auth** | **None.** Public STAC, anonymous HTTPS reads. No account, no API key, no GEE signup |
| **Resolution** | 10 m (B04 red, B08 NIR); 20 m (B11 SWIR, SCL scene classification) |
| **Bands used** | `red`, `nir`, `swir16`, `scl` |

This is what replaces the PhilSA request in section 2 of the consolidated data
request. It does not match the ≤ 5 m the request asks for, and it is not
Diwata-2 or NovaSAR-1 — but it is free, it is archived back to 2017, and it
required no correspondence with anyone.

### Method

For each contract, two periods are composited from up to 3 scenes below 35%
cloud:

- **before** — the 12 months ending at the contract start date
- **after** — the 12 months beginning at the completion date

Each period is a per-pixel median across scenes, with cloud, shadow and cirrus
masked using the L2A scene classification band (SCL classes 0, 1, 3, 8, 9, 10).

Two indices are then measured in concentric samples at **30 m, 90 m and 150 m**
around the published coordinate:

| Index | Formula | Direction under construction |
|---|---|---|
| NDVI | (NIR − Red) / (NIR + Red) | **down** — vegetation is removed |
| NDBI | (SWIR − NIR) / (SWIR + NIR) | **up** — concrete and bare fill appear |

NDBI rather than a plain brightness average, because clearing vegetation lowers
NIR at the same time as it raises red — a red+NIR mean can sit flat over an
obvious new structure. SWIR separates built surfaces from vegetation cleanly.

**Calibration is per site, against a bootstrap null.** The obvious null — the
spread of individual control pixels — is wrong, and wrong in the direction that
hides everything. Each reading is a *mean over ~28 pixels* at 30 m, and the
sampling spread of a mean is far tighter than the spread of single pixels;
comparing one against the other understates the z-score by up to √N. A first
pass made exactly this error and returned 1 detection in 200 records.

Dividing by √N would be the textbook fix and is also wrong here, because
satellite pixels are spatially autocorrelated and the effective N is smaller. So
the null is empirical: **160 discs of the same radius are dropped at random in
the site's own 300–600 m annulus**, and the real disc is ranked against them.
Autocorrelation, seasonality and terrain are inside the null by construction.

A record counts as construction-consistent only when NDVI ≤ −2σ **and** NDBI ≥
+2σ at the same radius.

**The 150 m radius is not arbitrary.** GIST (Yale, April 2026) found the most
common detection distance from the contracted coordinate to be ~150 m, matching
the site displacement COA documented in Bulacan. Sampling three radii lets
displacement be distinguished from absence instead of confused with it.

### Verdicts

| Verdict | Means |
|---|---|
| `change-at-point` | Construction-consistent change at the published coordinate |
| `change-offset` | Nothing at the coordinate, but construction-consistent change within 150 m — the displacement pattern |
| `no-change-signal` | Nothing rises above local variation at any radius |
| `not-assessable` | Cloud or missing imagery leaves too little clear ground to compare |

### Measured result: the detector does not work at this resolution

**This is the most important finding in the satellite tier, and it is negative.**

The seeded control sample exists to measure the method against itself. Across 200
assessed records:

| Group | Assessed | Detections | Rate | Median σ (NDVI, 30 m) |
|---|---|---|---|---|
| Flagged records | 102 | 6 | **5.9%** | −0.40 |
| Seeded controls | 39 | 3 | **7.7%** | −0.33 |

Controls detect **slightly more often than flagged records**. Fisher exact,
two-sided: **p = 1.00**. There is no evidence the detector can distinguish a
record with a bad coordinate from an ordinary one.

**Therefore no individual verdict carries evidential weight about its contract**,
and the interface says so — in a red banner above every assessment, and in the
note attached to each verdict.

### The cause is the sensor, not the estimator — tested, not asserted

An earlier version of this document blamed **dilution**: a revetment is metres
wide, a 30 m disc holds ~28 pixels of floodplain, so averaging buries the
structure. That was a hypothesis, and `pipeline/evaluate.py` tests it by swapping
the statistic and changing nothing else.

**Recall on presumed-built contracts** (completed, unflagged — projects that were
in the main actually built). This metric assumes nothing about whether flagged
records are ghosts, which is the very thing the thesis is trying to establish:

| Statistic | What it does | 1.0σ | 1.5σ | 2.0σ | 2.5σ |
|---|---|---|---|---|---|
| `disc-mean` | mean over the whole disc | 25.6% | 15.4% | 12.8% | 0.0% |
| `tail` | mean of the most-changed fifth | 23.1% | 15.4% | **15.4%** | 10.3% |
| `core` | the 3×3 touching the coordinate | 25.0% | 16.7% | 8.3% | 8.3% |
| `patch` | most-changed 3×3 anywhere in the disc | 20.5% | 20.5% | 10.3% | 7.7% |

At 1.0σ roughly a sixth of null discs fire by chance *per index*, so the left
column is close to noise. Even there, no statistic exceeds 26%.

**The dilution hypothesis is wrong.** Concentrating the measurement on the
most-changed 3×3 patch — the shape a small structure actually makes — does not
rescue recall. If dilution were the binding constraint, `patch` and `tail` would
have pulled clear of `disc-mean`. They do not.

What remains is the sensor and the setting. Many of these structures sit on
riverbanks that were already bare, so there is no vegetation to lose; the
surrounding floodplain swings between rice cycles by more than the structure
changes; and a two-metre revetment is small even against a 30 m patch. **No
choice of estimator or threshold recovers this.** The next lever is resolution or
different physics, not more statistics.

**What would plausibly fix it**

- **3 m PlanetScope** via Planet Education & Research — ~11× the pixels on target,
  and the single highest-value change available for free.
- **Sentinel-1 SAR coherence** rather than optical indices. New concrete changes
  interferometric coherence sharply and does not care about cloud or crop cycle.
- **Linear-feature statistics** instead of disc means — sample along the
  waterway rather than averaging a circle over it.
- **Sub-metre imagery** (Esri Wayback, Google Earth Pro history) for adjudicating
  individual cases, which is how COA established its Bulacan findings.

### What a "no change signal" result never meant anyway

Even had the detector validated, `no-change-signal` would not be "not built."
A repair to an existing structure, or any work on ground that was already bare,
produces no signal. Cloud cover over Bulacan is heavy enough that 59 of 200
records could not be assessed at all.

### Coverage is partial by design

The tier runs on an **audit-priority subset**: the highest-scoring flagged
records plus a **seeded random control sample** of unflagged ones. The control
sample is the point — without it, "flagged records show no signal" would be
circular, since the same records were selected for having bad coordinates.
Coverage figures are carried in `satellite.json` and shown in the interface;
records outside the subset display as "not assessed" rather than as anything
else. `--limit` extends it, and results cache per scene.

## 3. DPWH full detail export — bidding and documents

| | |
|---|---|
| **File** | `dpwh_transparency_data_all_details.parquet` (115 MB) in the same HuggingFace dataset |
| **Rows** | 248,421 contracts |
| **Licence** | CC0-1.0 |

**An earlier version of this document was wrong about what is public.** It read the
flat 24 MB export, which drops fifteen columns, and concluded that bidder counts,
the approved budget, the procurement timeline and contract documents were
unpublished. All four are in the detail file, at effectively full coverage for
this office:

| Field | Coverage | Earlier claim |
|---|---|---|
| `bidders[]` with PCAB ids | **100%** — median 3, max 27 | *"PhilGEPS publishes no bidder data"* |
| `abc` (approved budget) | **100%** | *"no approved-budget column"* |
| `awardAmount` | 94.1% | — |
| `advertisementDate` → `dateOfAward` | 100% / 85.5% | *"bid-window timing not derivable"* |
| `contractAgreement`, `noticeOfAward`, `noticeToProceed`, `advertisement` | **94–96%** | *"DPWH publishes no contract documents"* |
| `programOfWork`, `engineeringDesign` | **0%** | genuine gap, unchanged |

Documents are served from `dcs.infrawatch.ph`. A sampled dozen were confirmed to
resolve, returning real PDFs and ZIPs of 50 KB–2.1 MB.

### `budget` is ambiguous, and that is measured

DPWH's `budget` column matches `abc` on **55.1%** of contracts and `awardAmount`
on **42.7%**. It is reliably neither. Nothing downstream compares amounts using
`budget`; `abc` and `awardAmount` are used explicitly.

This also explains the earlier PhilGEPS join. It matched PhilGEPS `contract_amount`
— an award — against DPWH `budget`, which is the award only 43% of the time. The
36% join rate was capped by a semantics mismatch, not only by entity resolution.

### The finding: bids landing on whole percentages

At Bulacan 1st DEO, **38.4% of flood-control contracts are awarded at exactly
96.00% of the approved budget**, and **57.8%** land on some whole percentage.

| | This office | National flood control |
|---|---|---|
| award at exactly 96.00% of ABC | **38.4%** | 4.1% |
| award at any whole % of ABC | **57.8%** | 27.0% |
| single-bidder | 3.9% | 9.0% |

Across the 43 district offices with 200+ flood-control contracts, **Bulacan 1st
DEO ranks 1st**, at more than double the second-placed office (Ilocos Norte 1st
DEO, 18.3%). Competitive bids do not concentrate on round percentages of a figure
the bidder is not supposed to know exactly.

This is a statistical anomaly benchmarked against a national base rate. It is not
proof of collusion, and the interface says so on every flag. Note also that this
office is *better* than the national rate on single-bidder awards — the anomaly is
specific, not a general accusation.

### Implemented indicators

`SINGLE_BIDDER` (50), `TWO_BIDDERS` (299), `BID_AT_ROUND_PERCENT` (703),
`AWARD_CONCENTRATION` (366, by PCAB registration number rather than by name),
`SHORT_BID_WINDOW` (42, below the office's own 5th percentile of 20 days),
`NO_DOCUMENTS_PUBLISHED` (7).

### PhilGEPS

`bettergovph/philgeps-data` (CC0, 5.48 M award rows) is retained in
`pipeline/procurement_philgeps.py` as an independent corroboration of award
amounts. It is no longer the path to any of the above. Its `contract_no` is null
on 99.9% of rows, so the `contractId` join `FUSION.md` planned never existed.

## 4. Philippine municipal boundaries

| | |
|---|---|
| **Dataset** | [geoBoundaries](https://www.geoboundaries.org/) gbOpen `PHL ADM3` |
| **Upstream** | NAMRIA / Philippine Statistics Authority / OCHA Philippines |
| **Licence** | CC BY 3.0 IGO |
| **Used for** | Reverse-geocoding every published coordinate, and drawing the map |

24 of 24 Bulacan LGUs matched by name. The map draws these polygons directly, so
the boundaries shown are the same ones the flags were computed against.

---

## Filtering

The register is filtered by faceted multi-select, not by dropdowns. Four
principles, each of which the previous sidebar broke:

- **Every facet is multi-select.** A single-select municipality dropdown forces a
  choice between Calumpit and Hagonoy when the question usually spans several.
- **Every option carries a live count**, computed against all *other* active
  filters with its own facet excluded. Without the exclusion, selecting one status
  drops every other status to zero and the panel stops informing.
- **Delivery states, not just paperwork status.** DPWH's five status values
  describe documents. `overdue` (256), `stalled` (125), `rebuilt at the same site`
  (142) and `completed with nothing disbursed` (962) describe the ground.
- **State lives in the URL.** A filtered view is a shareable link, which is the
  point of a public register.

### "Completed but damaged"

There is no such field in any public dataset, and inventing one would be a guess.
The closest honest proxy is **recurrence**: work carried out again at the same
coordinate in a *later* year. A flood-control structure that has to be redone is
one that failed, was washed out, or was never there. 142 contracts sit on sites
rebuilt in a later year, and 117 of those already carry a records flag.

Same-year repeats are excluded — those are normally phases of one job rather than
a rebuild.

### The amount filter

The old control was a single handle over a hard-coded ₱5M–₱100M. That silently
excluded the **twelve largest contracts in the register — ₱1.66 B, 3% of all
value** — which is precisely the tail an auditor cares about. It also filtered on
`budget`, the column verification showed to be the approved budget on 55% of rows
and the award on 43%.

It is now a dual-handle range over `awardAmount`, bounded by the real data
(₱950K–₱209.5M), with the distribution drawn behind it.

## What is deliberately absent

The consolidated data request asks DPWH for five categories. Two arrived free.
The rest are genuinely not public, and the interface leaves them empty:

| Request | Status |
|---|---|
| **1A** Procurement & contract | ✅ Loaded in full, including bidders, PCAB ids, approved budget and the procurement timeline |
| **1B** Geographic | ⚠️ Point coordinates only. **No project polygons, footprints or alignment geometry are published anywhere public.** |
| **1C** Engineering & design | ⚠️ `programOfWork` and `engineeringDesign` empty on all 1,293 — but the invitation-to-bid ZIP (94.1%) typically contains the bill of quantities and plans |
| **1D** Progress monitoring | ⚠️ No inspection or acceptance reports, but 39.5% of contracts carry geotagged photos (866 images) and the notice to proceed is published on 95.7% |
| **1E** Financial | ❌ **`amountPaid` is 0 on all 962 completed records.** The portal publishes awarded amounts, not disbursement |
| **2** PhilSA imagery | ⚠️ Diwata-2 / NovaSAR-1 remain unavailable, but the request's *purpose* is now served by free Sentinel-2 at 10 m — see source 2 above |

The dashboard shows no disbursement series for exactly this reason. Inventing
one would reproduce, in miniature, the problem the project exists to study.

### Still worth requesting

Sentinel-2 covers the request's "10 m acceptable for broad change detection"
tier and is already implemented. What it does not cover:

- **≤ 5 m structure-level verification.** Planet NICFI, which supplied free
  4.77 m imagery, **ended January 2025**; Norway cancelled the next phase in
  September 2025. The live free route is **Planet Education & Research** — 3 m
  PlanetScope, 3,000 km²/month with a university email. Bulacan 1st DEO fits
  inside that quota. This is the single highest-value addition.
- **Wet-season SAR.** Sentinel-1 (10 m) substitutes for NovaSAR-1 and sees
  through cloud, which is what limits the optical tier here. Check acquisition
  density over Bulacan before committing.
- **Sub-metre for adjudicating individual cases.** Esri Wayback and Google Earth
  Pro history are free and are what a human labelling pass should use.

---

## What the flags mean

**The flags in this build are consistency checks on published records. They are
not satellite verification, and they are not findings of fraud.** No imagery has
been analysed. A flag means the public record disagrees with itself or with
official boundary data — a reason to look, not a conclusion.

310 of 1,293 records (24%) trip at least one check:

| Check | Count | What it tests | Severity |
|---|---|---|---|
| `CONTRACTOR_REVOKED` | 110 | DPWH's own contractor field carries a `[REVOKED]` registration marker | medium |
| `MISSING_COORDS` | 102 | No latitude/longitude published, so the site cannot be located at all | high |
| `COORD_DUPLICATE` | 41 | Two or more contracts share one exact coordinate | medium |
| `MUNI_MISMATCH` | 37 | The description names one municipality; the coordinate falls in another, beyond boundary tolerance | high |
| `BOUNDARY_ADJACENT` | 33 | Same as above but within 300 m of the named municipality — treated as cartographic, not substantive | low |
| `UNLOCATABLE_COORD` | 9 | Coordinate falls outside every municipal polygon in the region | high |
| `OUTSIDE_PROVINCE` | 7 | Coordinate falls outside Bulacan entirely | high |
| `STATUS_PROGRESS_CONFLICT` | 0 | Marked Completed with progress below 100% | medium |
| `DATE_ANOMALY` | 0 | Completion date precedes start date | low |

`CONTRACTOR_REVOKED` covers **110 contracts worth ₱4.92 B across 8 firms**. This
is not an inference — the portal itself writes the marker into the contractor
name, e.g. `ST. TIMOTHY CONSTRUCTION CORPORATION ([REVOKED] 39196)`. It is also
the only contractor-standing data in any public source, PCAB and GPPB
blacklisting being unpublished.

**It does not mean the award was improper.** The portal publishes no revocation
date, so the revocation may well postdate the contract — which is what happens
when a firm is sanctioned after its work. The flag says "check the dates", and
the interface says so in those words.

`MUNI_MISMATCH` is the substantive one. It works because the DPWH description
states the site in prose — "… AT BARANGAY PANDUCOT, CALUMPIT, BULACAN" —
independently of the lat/lng field. Comparing two independent claims is the whole
method; comparing a coordinate to itself would prove nothing.

### Choices that make the flags conservative

Three decisions in `pipeline/build_dataset.py` deliberately under-flag rather
than over-flag, because the cost of a false accusation against a named public
official or contractor is not symmetric with the cost of a miss:

1. **300 m boundary tolerance.** A point just over a boundary line is
   `BOUNDARY_ADJACENT` (low), not `MUNI_MISMATCH` (high). Without this, 565
   records flagged instead of 37 — almost all of them river-adjacent projects
   sitting on municipal lines.
2. **"BULACAN" is never read as a municipality.** geoBoundaries spells the
   municipality of Bulakan "Bulacan", identical to the province that ends nearly
   every description. Rather than guess, the parser drops the ambiguous spelling
   and accepts only "BULAKAN". Genuine Bulakan projects spelled the other way
   yield no declared municipality and are simply not checked.
3. **The district's service area is derived, not assumed.** The 14 municipalities
   the 1st DEO is treated as serving come from its own project descriptions, not
   from the legislative district boundary.

### The status field

`status` is the DPWH status, except that a flagged record displays as "Flagged
for Review" so the flag is visible in every list and on the map. DPWH's own
string is preserved untouched in `dpwhStatus` and shown on the detail panel. This
is why 796 records show "Completed" while the KPI reports 962 marked complete —
the difference is flagged records displaying their flag.

---

## Prior art

**GIST — Ghost Infrastructure Spectral Tracker** (Yale environmental data science
capstone, April 2026) applies Sentinel-2 change detection to this same 248k
dataset, validated against the same COA Bulacan fraud audits.
<https://github.com/tdfrago/yale-environmental-data-science-capstone>

Its headline result — that the dominant signal is construction detectable ~150 m
from the contracted coordinate, i.e. site displacement rather than outright
non-construction — is directly relevant, and it independently corroborates the
premise behind `MUNI_MISMATCH` here. Read it before writing the satellite tier.

## Rebuilding

```bash
python3 pipeline/build_dataset.py   # ~30 s once sources are cached
npm run dev
```

Source files cache to `data/` (untracked; 24 MB parquet + 532 MB boundary
GeoJSON) and are downloaded once. Regenerated outputs land in `src/app/data/`.
