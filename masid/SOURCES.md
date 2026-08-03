# Sources and limits

Every number in this build traces to one of the datasets below. Nothing is
simulated, estimated, or carried over from the design mock. Where the public
record has no value, the interface says so rather than showing a plausible one.

Dataset built **3 August 2026** from records last updated 22 January 2026.

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

## 3. PhilGEPS award records

| | |
|---|---|
| **Dataset** | [`bettergovph/philgeps-data`](https://huggingface.co/datasets/bettergovph/philgeps-data) |
| **Licence** | CC0-1.0 |
| **Size** | 5,481,161 award rows, 2000–2025 (`philgeps.parquet`, 492 MB) |
| **Slice** | 6,503 awards to Bulacan 1st DEO after dedup — ₱109.64 B, 537 contractors |

### The join, and why the planned key does not work

`FUSION.md` proposed `contractId` ↔ PhilGEPS contract reference as the primary
key. **That key does not exist in practice.** `contract_no` is null on **99.9%**
of PhilGEPS rows, and where present it is free text in no consistent format —
`CB2024-047`, `I30`, `24112023`, `CS-01-2025-04(A)`. The primary strategy is dead
on arrival, which is exactly the thing `FUSION.md` said to find out in month one.

The fallback works well enough to build on. Normalised contractor name plus
contract amount, over 1,293 contracts:

| Match | Count | Share |
|---|---|---|
| exact amount + contractor | 435 | 33.6% |
| within 0.5% + contractor | 31 | 2.4% |
| contractor only (no amount agreement) | 541 | 41.8% |
| no award from that contractor at this office | 286 | 22.1% |

**36.0% usable amount-level join.** Entity resolution is lossy by design:
parenthetical content is dropped (`([REVOKED] 39196)`, `(FORMERLY:…)`) and
generic corporate vocabulary is stripped, so two genuinely different firms
differing only in those words will collide. Every match additionally has to agree
on the contract amount before it is used for anything.

Also note PhilGEPS bulk data repeats award rows verbatim — 7,126 rows collapse to
6,503. Left in, every concentration figure would be wrong by the duplication rate.

### What is not derivable, and is therefore absent

`FUSION.md`'s Signal A wanted single-bidder awards, bidder counts and the
bid-to-ABC ratio. **PhilGEPS publishes no bidder data and no approved-budget
column**, so none of those are implemented. They are absent rather than
approximated.

One substitute was tempting and is deliberately not used. The ratio of PhilGEPS
award to DPWH budget sits at exactly 1.0000 on 43% of comparable contracts, which
reads like winning at precisely the approved budget — a classic red flag. But
DPWH's `budget` column has mixed semantics: on many records it plainly *is* the
awarded amount, in which case a ratio of 1.0 is the same number appearing twice,
not an absence of competition. The two cannot be told apart from these sources,
so the ratio is reported only as records disagreeing about a contract's value.

### What is implemented

- **`AWARD_CONCENTRATION`** — a contractor's share of everything this district
  office has awarded, across all categories. Measured in **multiples of an equal
  split** rather than as an absolute share: with 537 contractors an equal split
  is 0.19%, so a flat "8% is high" threshold (which an earlier pass used) flags
  nobody. Medium at 10×, high at 20×. Top of the book: WAWAO 6.10%, TOPNOTCH
  CATALYST 5.92%, SYMS 5.62%.
- **`NO_PHILGEPS_AWARD`** — no award to this contractor from this office. PhilGEPS
  coverage of DPWH is incomplete, so this is a gap in the record, not a finding.
- **`VALUE_DISAGREEMENT`** — no award from the contractor comes within 0.5% of the
  DPWH value.

### The fusion

The two signals are **measurably independent**: across all 1,293 contracts the
records score and the procurement score correlate at **r = −0.12**. Neither is a
proxy for the other, which is the entire justification for fusing them — "high on
both" is genuinely narrower than either list alone.

| Quadrant | Contracts | Value |
|---|---|---|
| **Records and procurement both** | **16** | **₱831.1 M** |
| Records only | 142 | ₱3.9 B |
| Procurement only | 264 | ₱17.7 B |
| Neither | 871 | ₱45.3 B |

**This is an ordering, not a prediction.** `FUSION.md`'s validation plan — "our
score placed 18 of 21 COA-confirmed ghosts in the top decile" — cannot be run:
the ICI turned its findings over to the DOJ and the Ombudsman rather than
publishing an itemised list, so there is no public ground truth to rank against.
Nothing here has been shown to rank confirmed cases highly. It ranks contracts by
how much the public record disagrees with itself, which is a triage aid.

Unlike the imagery tier, this one is not *known to be broken* — it is simply
unvalidated, and the distinction matters.

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

## What is deliberately absent

The consolidated data request asks DPWH for five categories. Two arrived free.
The rest are genuinely not public, and the interface leaves them empty:

| Request | Status |
|---|---|
| **1A** Procurement & contract | ✅ Loaded, minus variation orders and procurement method |
| **1B** Geographic | ⚠️ Point coordinates only. **No project polygons, footprints or alignment geometry are published anywhere public.** |
| **1C** Engineering & design | ❌ No drawings, cross-sections, bills of quantities or as-builts |
| **1D** Progress monitoring | ❌ No inspection or acceptance reports. `reportCount` is non-zero on only 4 of 1,293 records |
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
