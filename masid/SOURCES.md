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

### How it is presented

A browsable workbench rather than a view that only worked if you arrived already
carrying a selection. The 200 assessed contracts are listed and filterable by
verdict; selecting one shows three panels side by side:

| | |
|---|---|
| **Before** | NDVI composite from the year running up to construction |
| **After** | NDVI composite from the year after it was due to finish |
| **Today** | live Esri high-resolution imagery at the same coordinate |

The first two are what the detector measured. **The third is the check on it.**
If the pipeline reports no change and current imagery plainly shows a concrete
revetment, that is the detector failing — and it should be visible rather than
buried in a recall statistic. Equally, if the pipeline is silent and the ground
looks empty, a reader can see that for themselves instead of taking a σ value on
trust.

The validation result is pinned above all of it and cannot be scrolled past.

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

## Citizen reports

A feed, with two mechanisms and an honest account of what each is worth.

**Live capture only.** The camera opens in the page and a frame is taken from the
live stream; there is no file picker, so a photo saved from elsewhere cannot be
attached. Each capture records its time and, where permitted, the device's own
GPS fix — which is then compared against the coordinate DPWH published, and shown
as "taken 40 m from the published coordinate" or "taken 2,100 m from it".

*This raises the bar; it does not close the door.* A determined person can feed a
virtual camera device. It stops the easy case — attaching an old or borrowed
photo — and nothing beyond that. Anything consequential still needs a human to
verify it.

**"Masid" votes.** Readers mark reports worth attention and the feed sorts by it.
*Votes measure attention, not truth.* A widely shared wrong report will outrank an
accurate one nobody saw, and any public vote can be brigaded. The count is
presented as what it is — how many people looked and agreed — never as a
verification status.

**Sorting.** Newest, furthest from the coordinate, most masid, most discussed,
biggest contract. Only one of those is a measurement: *furthest from the
coordinate* ranks by the gap between where the reporter's device says they stood
and where DPWH says the project is — a number neither party chose. A report taken
3 km from the published point deserves attention whether or not anyone upvoted
it. The vote and comment orderings are offered because people expect them, and
labelled so a busy thread is not mistaken for a verified one.

**Progress.** Every report shows where it has got to — Submitted, Under review,
Queued for inspection, Validated on site or Not confirmed, Closed — with a
five-step strip, who moved it and when.

Without this a feed is a wall of photographs and nothing distinguishes a report
that was checked and confirmed from one nobody has opened.

**Only official roles can move a report along.** A citizen cannot mark their own
report validated; that would make the badge worthless the day the tool became
popular. The public sees the state and who set it, and the control is replaced by
a line saying who can change it.

*Validated* and *Not confirmed* are both outcomes, not judgements on the reporter.
Plenty of honest reports are not confirmed — a coordinate can be wrong without the
structure being missing — and the wording avoids implying bad faith.

**Discussion.** Reports carry comment threads, flat with a single level of reply.
Deeper nesting is where threads stop being read, and on a register naming real
companies an argument buried four levels down is worse than none.

Commenters are shown by **role, not username** — resident, district engineer,
field inspector — because whether a remark comes from someone who lives beside
the site or someone who signed the contract changes how it should be weighed, and
the app already knows which is signed in.

**Prototype.** There is no server. Reports live in the browser's localStorage and
go nowhere. A real deployment needs submission, moderation, an audit trail and a
takedown route — which matters more once threads exist, because they name real
companies; none of that exists here, and the banner on the page says so
rather than letting anyone believe they have filed something.

## Relationship to BetterGov.ph

[bettergov.ph/flood-control-projects/map](https://bettergov.ph/flood-control-projects/map)
already publishes a national flood-control register — Leaflet map with marker
clustering, filters on year, region, province, type of work and district office,
charts by year/region/work-type/contractor, a sortable table and CSV export. The
code is [`bettergovph/bettergov`](https://github.com/bettergovph/bettergov),
released **CC0**.

MASID is not a second register and should not try to be one. BetterGov plots what
the portal says; this audits it. The division:

**Adopted from them, because they got it right**

- **Leaflet with real tiles, marker clustering and popups.** The map here was a
  hand-drawn SVG of Bulacan: the zoom buttons did nothing, 1,189 dots overlapped
  into a smear, and there was no ground under them. Theirs was simply better.
- *Projects by year* — extended below with the columns their data cannot produce
- Infrastructure-year filter
- CSV export of the filtered set, with the derived columns included

**Added on top of their map**

- **A satellite basemap** (Esri World Imagery). Being able to see the ground
  under a contract is the premise of the whole project — a coordinate sitting in
  open water, in the middle of a subdivision, or on a bank with nothing on it is
  legible at a glance in a way no amount of tabular flagging achieves.
- **The municipal boundaries the coordinate checks run against**, drawn as an
  overlay, so a "location doesn't match the description" flag can be seen rather
  than taken on trust.
- **Cluster bubbles coloured by contents, not by count.** leaflet.markercluster
  ships green/yellow/orange bubbles keyed to how many markers they hold — green
  under 10, orange above 100. Those are the same three hues the dots use for
  something else entirely, so a green bubble read as "clean" when it only meant
  "small". Each bubble now shows the share of contracts inside it that are
  flagged for review, on the same traffic light: green 0%, yellow under 25%,
  orange under 50%, red above. The bubble shows only the count — a second line of
  8 px text inside a 32 px circle is not readable at map scale, so the exact
  share is on hover instead.
- The view fits the 2nd–98th percentile of coordinates, not all of them. Three
  contracts sit tens of kilometres outside Bulacan — which is the point of the
  location checks — and fitting to those zooms the map out to Batangas and makes
  the other 1,188 unreadable.

**What this adds that a register cannot**

| | |
|---|---|
| Coordinate integrity | 37 contracts whose coordinate contradicts their own description; 102 with none at all. A register plots coordinates; it does not test them |
| Bidding red flags | the 96.00% cluster, single-bidder, bid-window, ABC ratio — none derivable from the flat export they index |
| Flood-hazard join | whether the flood control is where the flooding is |
| Rebuild recurrence | 142 contracts on sites built again in a later year |
| Contract documents | 1,286 contracts indexed to their published PDFs |
| Satellite delivery | the imagery tier, including its measured failure |
| Data verification | a gate that must pass before any of the above is generated |

### Year comparison

The reason this earns its place rather than duplicating theirs:

| year | projects | value ₱B | flagged | at 96.00% | 1 bidder |
|---|---|---|---|---|---|
| 2016 | 25 | 0.40 | 68% | **0%** | 0% |
| 2018 | 98 | 2.53 | 33% | **0%** | 12% |
| 2019 | 79 | 2.03 | 35% | **3%** | 8% |
| 2020 | 70 | 2.27 | 24% | **51%** | 19% |
| 2022 | 127 | 5.02 | 19% | **59%** | 2% |
| 2024 | 313 | 23.29 | 14% | **50%** | 0% |

**The round-number bidding pattern has a start date.** Absent through 2018, 3% in
2019, then 51% in 2020 and never below 36% since. Only a yearly view shows that,
and only with a bid-to-ABC ratio computed per contract.

Shown as two charts, not one with two axes: value and percentage do not share a
scale, and a dual-axis chart can be made to show any relationship its author
wants.

## Filtering

Faceted multi-select, with live counts computed against all *other* active
filters — so selecting one option never zeroes every other option and leaves the
panel silent.

### Plain language, not internal codes

Every option is written the way someone outside DPWH would say it. `MUNI_MISMATCH`
reads "Location doesn't match the written description"; `BID_AT_ROUND_PERCENT`
reads "Winning bid was a suspiciously round number"; `SINGLE_BIDDER` reads "Only
one company bid". Records-tier and procurement-tier flags are merged into one
list, because which pipeline produced a flag matters to the method and not at all
to a resident asking what is wrong with the project outside their house.

### Stage and condition are separate, and that is not cosmetic

An earlier version put `flagged for review` in the same list as `completed`,
`ongoing` and so on. It is not a lifecycle stage — it is a condition a contract
can carry at any stage — and treating it as one hid **245 completed contracts
inside "flagged"**. The app reported 717 completed where DPWH reports 962, and no
filter could recover them.

Status is now the stage DPWH itself reports and nothing else:

```
Finished        962      A defective structure is still a finished one.
Being built     263      A flagged contract is still at whatever stage it is at.
Not started yet  68      962 + 263 + 68 = 1,293, the whole register.
Cancelled         0
```

Everything else — late, rebuilt, unlocatable, single-bidder — lives in the
conditions, where a contract can carry several at once or none.

This is also why **"completed but defective" is not offered as a status.** It
would repeat exactly the same mistake: tag a project defective and it drops out
of the completed count, and you could never ask "how many finished projects are
defective?" because the answer would be zero by construction. There is also no
public dataset that records defects. The closest honest signal is *"same spot was
built again later"* (142 contracts), shown as the inference it is. COA's
published fraud audit reports do name specific Bulacan 1st DEO contracts as ghost
or relocated — extracting those would give a recorded field rather than an
inference, and is the obvious next step.

### The map sidebar is the original design's, kept simple

Six controls: municipality, status, contractor, awarded amount, layers, summary.
An intermediate version grew to ten collapsible groups, six concern chips and a
preset row — comprehensive, and far too much for the screen most people will
actually use.

What was kept from that version is the correctness, not the controls:

- Status counts are DPWH's own stages, so they add to the register.
- The amount slider reads `awardAmount` and runs to the real maximum
  (₱210M), not a hard-coded ₱100M ceiling over an ambiguous column.
- Counts are live against the other filters.
- Layer toggles now actually drive the map rather than decorating the panel.

**"Only ones with a problem" counts the records checks, not the bidding ones.**
Including procurement flags takes it from 310 to 1,123 — 87% of the register —
because round-number bids alone are 709 and contractor concentration another 366.
A switch that selects seven contracts in eight is not a filter. Bidding patterns
are still shown on every contract's detail panel, where they belong: they
describe how a contract was bought, not the structure.

### Field inspection brief

Everything else here is built for reading at a desk. An inspector needs something
else, so any contract can be printed as a one-page brief:

- **Where to go** — coordinates as tap-through links to Google Maps and Waze, plus
  the figures written out for a handheld GPS, the barangay the contract names, and
  the flood hazard at that spot.
- **What should be there** — structure type, chainage limits and length pulled off
  the contract title, so the question becomes specific: *is there 780 m of
  revetment between STA 0+000 and STA 0+780* rather than *is it built*. Parsed for
  1,209 of 1,293 contracts (type), 764 (barangay) and 224 (chainage).
- **Know before you go** — every flag, so an inspector learns the coordinate is
  disputed before driving to it rather than after.
- **What to check** — a checklist that adapts to what the contract actually
  states, ending with "if nothing is found, note what IS at the location".
- **Findings** — printed fields, because a brief that cannot be written on comes
  back empty.

The satellite verdict appears with an explicit instruction not to let it shape
what is looked for on site, since the tier has no measured discriminative power.

### Clicking a project

Opens a satellite view of the site itself, not a diagram of it. The panel map was
a hand-drawn SVG — a grey rectangle, boundary lines, small dots — which told you
a contract had neighbours and nothing about the place. It now opens on Esri
imagery at zoom 16 with a 30 m ring on the published coordinate, so the question
people actually have when they click a flood-control contract — *is there
anything there?* — can be answered by looking.

Alongside it, a sentence rather than a table:

> A flood-control contract worth ₱47.0 million in Balagtas, awarded to M.C.J.
> Valenzuela Construction Enterprises under the 2022 programme. DPWH reports it
> finished on 24 September 2022. 3 companies bid for it.

Nothing in that sentence is new — every field is elsewhere on the panel. The
point is a form a person can take in. The full contract description sits behind a
disclosure, and **who else bid** is listed with PCAB numbers, which DPWH publishes
and nothing else in this project had surfaced.



### The panel changes with the role

The six roles do different jobs, and one panel serving all of them serves none
well. Each role gets its own group order, its own quick questions, and its own
default map colouring:

| Role | Opens on | Map colours by |
|---|---|---|
| Public | Where is it? · Is it finished? · What might be wrong? | Anything wrong |
| LGU coordinator | Where is it? · Is it finished? · Flood-prone? | Delivery concern |
| Field inspector | **Can it be found on a map?** · Is it finished? · Where is it? | Delivery concern |
| DPWH engineer | Is it finished? · Where is it? · How much? | Delivery concern |
| DPWH admin | Where · Finished · What's wrong (full register) | Anything wrong |
| PSA analyst | **Satellite imagery** · Can it be found on a map? · Where | Flood risk |

Two rules hold throughout:

- **Roles change what is shown first, never what is available.** Every group
  remains reachable under "More filters". Hiding public spending data from
  someone because of their job title is the opposite of the point.
- **Nobody sees a different number.** Counts, flags and totals are identical for
  every role; only the arrangement and the wording change.

### State lives in the URL

A filtered view is a shareable link. A transparency finding that cannot be sent
to someone else is not much of a finding.

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

## Map colour

Markers use a **traffic light** — green, amber, orange, red — chosen because on a
public accountability map that vocabulary is understood instantly and by
everyone, and that legibility is the product.

The cost is real and is paid rather than ignored.

**Red and green cannot be separated on the protan axis.** A dozen traffic-light
candidates were run through a validator against the map's real surface
(`#f2f2f0`) and against *all* pairs — on a map any two categories can end up
adjacent. Every candidate that still looked like a traffic light scored between
ΔE 1.6 and 7.5. The set shipped is the best of them:

```
#046b04  #f7c948  #e8722c  #c0272d
CVD ΔE 7.5 (protan) · tritan 14.1 · normal-vision 16.9 · contrast WARN
```

7.5 sits in the band the method permits **only with secondary encoding**. So the
secondary encoding is not decoration here — it is what makes the palette legal:

**Every mark also carries a shape** — circle, square, triangle, diamond, cross —
and the legend draws that shape beside its label and count. A viewer who cannot
separate the hues reads the silhouette instead and loses nothing.

Award amount keeps a single-hue sequential ramp (`#6da7ec #3987e5 #256abf
#104281`, all checks pass). Magnitude is not a traffic light: a large contract is
not "bad".

The basemap was desaturated to neutral greys — it was a saturated blue that both
competed with the data and pushed the ramp's light end below the contrast floor
against it. Marker drop-shadows were removed: at this density several hundred
merged into a grey smear, and the 2 px surface ring is enough.

## Flood hazard

| | |
|---|---|
| **Dataset** | `bettergovph/project-noah-hazard-maps` → `Flood/100yr/Bulacan.zip` |
| **Upstream** | UP NOAH (Nationwide Operational Assessment of Hazards) |
| **CRS** | GCS_WGS_1984 — same datum as the DPWH coordinates, no reprojection |
| **Geometry** | 261,710 polygon parts; `Var` 1 low / 2 medium / 3 high |

For a flood-control register this is the question the money is meant to answer,
and until now nothing here asked it. Every coordinate is tested against the
modelled 100-year extent; those outside get the distance to the nearest hazard
polygon.

| At the published coordinate | Contracts | |
|---|---|---|
| High hazard | 596 | 46.1% |
| Medium | 210 | 16.2% |
| Low | 76 | 5.9% |
| Outside, within 1 km | 306 | 23.7% |
| **Over 1 km from any flood zone** | **3** | 0.2% |
| No coordinate | 102 | 7.9% |

**The distance measure is what makes this honest.** Without it the headline would
read "309 contracts sit outside any modelled flood zone" — 24%, and misleading.
A revetment or floodwall *belongs* at the edge of a flood zone; 306 of those 309
are within a kilometre, which is exactly where you would expect them.

Only 3 are genuinely far out (median 26.7 km, max 75.8 km) — **and all three
already carry a coordinate flag** (`UNLOCATABLE_COORD` or `OUTSIDE_PROVINCE`).
So this tier corroborates the records tier rather than finding anything new,
which is a more useful result than a fourth independent signal: two methods that
disagree about geography would be a problem, and they agree.

NOAH models fluvial flooding and does not claim to cover every drainage or
coastal mechanism, so "outside the model" is never on its own a finding.

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

---

## 5. OpenStreetMap waterways

| | |
|---|---|
| **Dataset** | `waterway=river\|stream\|canal\|drain` over 14.65–15.10 N, 120.60–121.10 E |
| **Access** | Overpass API — `overpass.kumi.systems`, falling back to `overpass-api.de` and `overpass.private.coffee` |
| **Licence** | ODbL 1.0 — © OpenStreetMap contributors |
| **Size** | 5,062 channels, 101,206 vertices |
| **Pipeline** | `pipeline/scope.py` → `src/app/data/scope.json` (218 KB) |

**What it is used for.** The register publishes one point per contract and, for
some, a stated length — but never a direction. Flood-control work follows a
watercourse, so the direction can be looked up rather than guessed: each
contract's point is projected onto the nearest mapped channel, half the stated
length is walked along it in each direction, and that stretch is buffered into a
corridor.

**Fields shipped:** geometry only, plus the matched channel's `name` and
`waterway` class. No other OSM tags are carried.

**Coverage:** 219 corridors, the ceiling being the 220 contracts that state a
length. 15 distinct channels across 12 municipalities — Angat River 63,
unnamed river 48, Balagtas River 33, unnamed stream 33, Santa Maria River 17,
Guiguinto River 10, Tabang River 7, and nine others with one each.

**This is an inference and the app labels it as one.** Three specific limits,
all disclosed in the interface:

- The work may be on **one bank**; the corridor covers both, because which bank
  is not published either.
- The **nearest** channel may not be the one the contract names. The channel's
  name and the distance to it are both shown so a reader can check that against
  the description themselves — and **34 corridors were derived from a channel
  more than 100 m away**, which the panel flags in red.
- Where the mapped channel runs out, the corridor is **truncated** and says so.
  This affected 16 contracts.

Where no channel is within 500 m, or the contract states no length, **no polygon
is drawn** — the panel reads "Stated extent — not published" rather than showing
a shape the record cannot support.

---

## 6. Esri World Imagery Wayback

| | |
|---|---|
| **Catalogue** | `config.maptiles.arcgis.com/waybackconfig.json` — 196 dated releases, 2014-02 → present |
| **Tiles** | `wayback.maptiles.arcgis.com/.../MapServer/tile/{release}/{z}/{row}/{col}` |
| **Metadata** | per-release metadata layer, queried by point for flight date, resolution, accuracy, provider |
| **Attribution** | Imagery © Esri, Maxar, Earthstar Geographics |
| **Pipeline** | `pipeline/wayback.py` → `src/app/data/wayback.json` |

Tiles are **served live to the browser and never redistributed** by this project.
Anything published beyond research should be checked against Esri's current terms.

**How a version is found.** Requesting a tile for release *N* returns `301`
redirecting to whichever release actually holds imagery for that tile; most of
the 196 have never re-flown Bulacan. Following the redirects collapses them to
28 — and reading the acquisition metadata collapses those 28 to **six actual
photographs**. See FINDINGS.md §5.

**Resolution ceiling:** the metadata reports `MaxMapLevel 19` and zoom 20 returns
HTTP 404. Native sampling is 0.3 m/px. Positional accuracy at the sampled point
is ±8.47 m.

---

# Considered and not used, and why

A panel's first question about a Philippine remote-sensing thesis is why it does
not use Philippine satellites. The short answer is that this build was
constrained to sources anyone can re-download without permission, and the
national assets are not among them. The longer answer is below, with what was
actually tested.

## PhilSA — Diwata, Maya, MULA

**Not used. Access is by formal request, and that request is pending.**

Checked on 18 August 2026:

| Endpoint | Result |
|---|---|
| `philsa.gov.ph` | HTTP 200 — an ordinary website |
| `spacedata.philsa.gov.ph` | HTTP 200 — an ordinary website |
| `spacedata.philsa.gov.ph/api`, `/stac`, `/catalog`, `/collections` | **HTTP 404 — no machine-readable catalogue** |
| `data.philsa.gov.ph`, `pedro.asti.dost.gov.ph` | did not resolve |

Against the Sentinel-2 path this project does use:

| Endpoint | Result |
|---|---|
| `earth-search.aws.element84.com/v1/collections` | HTTP 200, **9 open collections, anonymous, no signup** |

That difference is the whole reason. `pipeline/satellite.py` can walk 200 sites
unattended, and any reader can re-run it and get the same answer. PhilSA imagery
requires a bilateral grant, so "we did not use PhilSA" and "we are waiting on
PhilSA" are the same sentence.

**Three further reasons it would not have rescued this tier even with access:**

1. **Diwata is a tasked telescope, not a sweeper.** Diwata-1 deorbited around
   2020; Diwata-2 points at targets on request rather than systematically
   imaging the country on a schedule. There is therefore very unlikely to be a
   repeat archive over 1,293 Bulacan coordinates on the dates these contracts
   were built. Sentinel-2's value here was never resolution — it is that it
   images everywhere every ~5 days, unasked.
2. **Resolution would not fix the null result.** Diwata's high-precision
   telescope is roughly 3 m and MULA is specified around 5 m. Better than
   Sentinel-2's 10 m, but a 2 m revetment is still a pixel or two. What actually
   lets a person read a structure is the 0.3 m in §6, and nothing in the
   national fleet is near that.
3. **Reproducibility.** Every dataset in this build can be re-downloaded by a
   panel, a journalist or a rival researcher with no one's permission. A finding
   resting on a data grant cannot be independently checked, which is a reason to
   build the public-data version first regardless of access.

*Mission specifications above are from public descriptions and should be
confirmed with PhilSA directly; the endpoint results are what was tested.*

**What PhilSA would genuinely unlock — and it is not resolution.**

- **Tasking.** Imagery acquired *on request, inside a contract's construction
  window*. This is the only fix for FINDINGS.md §5: the 2022–2024 surge was
  awarded, built and completed with no high-resolution photograph taken over it.
  No open-data source can solve that, because open satellites image on their own
  schedule and the moment has passed.
- **SAR.** Cloud penetration. 59 of the 200 assessed sites are unreadable
  because of wet-season cloud over Bulacan.

## Google Maps and Street View imagery

**Used only as out-links and as the keyless classic embed; never as data.**

- **Historical imagery is exposed by no API.** The "see more dates" slider in
  Street View, and the time slider in Google Earth, are features of Google's own
  interfaces. `StreetViewService` returns the current panorama and its
  `imageDate` and offers no way to enumerate older ones. A year-by-year
  comparison therefore cannot be rebuilt in this app at any price.
- **Every Maps Platform key requires a billing-enabled project**, including the
  Embed API whose basic usage is not charged. A public static site would be
  shipping a spendable credential to every visitor.
- **The tiles cannot be embedded outside Google's own services** under the Maps
  Platform terms, which is why the archived-imagery strip runs on Esri Wayback:
  Esri publishes its past versions as addressable tile layers precisely so third
  parties can use them with attribution.

The classic `maps.google.com/maps?q=…&output=embed` endpoint predates Maps
Platform, needs no key and bills nothing, so it is used for the map and Street
View panes — Google's own viewer, inside an iframe, with a link out to the date
control that cannot be drawn here.

## Planet / PlanetScope

**Not used.** 3–5 m daily imagery would materially improve cadence over
Sentinel-2, and the NICFI programme has covered tropical regions including the
Philippines. It needs registration, its access terms have changed over time, and
its licence restricts redistribution — so a result built on it is not
reproducible by a reader in the way the rest of this build is. Worth revisiting
through Planet's education and research programme as a *supplement*, not a
foundation.

## Maxar Open Data

**Not used systematically.** Genuinely free and genuinely sub-metre, but released
only around specific disaster events rather than continuously. Worth checking
per typhoon that hits Bulacan — an event release covering a flood-control site
shortly after a storm would be the single most useful frame this project could
obtain — but it cannot be planned around.

## COA audit reports

**Not used, and this is the most consequential omission.** Only an audit finding
turns "built more than once" from an inference into a recorded fact. The
Independent Commission for Infrastructure turned its findings over to the DOJ
and the Ombudsman rather than publishing an itemised list, so there is no public
ground truth to validate any ranking in this project against — which is why the
Audit-Priority Triage is described everywhere as an ordering and never as a
prediction.
