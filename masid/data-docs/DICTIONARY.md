# Data dictionary

<!-- GENERATED FROM contract.yaml BY build_dictionary.py — DO NOT EDIT -->

Every field this project emits: **129 fields across 13 datasets**. Generated from `contract.yaml`, which `validate.py` enforces against the data on every run.

## How to read the origin column

This is the column to read first, and the one a reviewer should press on.

| | | count |
|---|---|---|
| **pub** | **Published.** The value as DPWH or PhilGEPS published it, passed through unchanged. If this is wrong, the government's record is wrong. | 38 |
| *der* | *Derived.* Computed by this project from published values. If this is wrong, **we** are wrong — so the derivation is named. | 73 |
| join | **Joined.** From a third-party dataset — boundaries, flood hazard, waterways, imagery metadata — and attributable to it. | 18 |

Provenance, licences and the reasoning behind each source are in [`../SOURCES.md`](../SOURCES.md). This file describes shape and meaning only.

---

## `boundaries.json`

Municipal polygons, simplified for the browser.

**24 rows** · records at `(root array)` · emitted by `pipeline/build_dataset.py`

| field | type | null | origin | meaning |
|---|---|---|---|---|
| `name` | str | no | join | *geoBoundaries PHL ADM3 (CC BY 3.0 IGO).* |
| `rings` | list | no | join | [[lng, lat], ...] per ring. GeoJSON order, not spoken order. |

## `contractors.json`

Aggregates per contractor name at this office.

**176 rows** · records at `(root array)` · emitted by `pipeline/build_dataset.py`

| field | type | null | origin | meaning |
|---|---|---|---|---|
| `id` | str | no | *der* | Synthetic C-prefixed key. Not a PCAB number. |
| `name` | str | no | **pub** |  |
| `totalProjects` | int | no | *der* |  |
| `activeProjects` | int | no | *der* |  |
| `completedProjects` | int | no | *der* |  |
| `flaggedProjects` | int | no | *der* |  |
| `flagRate` | float | no | *der* |  |
| `totalValue` | float · PHP | no | *der* |  |
| `municipalities` | list | no | *der* |  |
| `years` | list | no | *der* |  |
| `registrationRevoked` | bool | no | **pub** | From DPWH's own [REVOKED] marker in the contractor field. The portal does not publish the revocation DATE, so whether it preceded the award is unknown. |

## `data-quality.json`

The gate's own results, machine-readable. Rendered for humans in QUALITY.md. 19 PASS, 4 WARN, 13 INFO at the current build.

**36 rows** · records at `checks` · emitted by `pipeline/verify_data.py`

| field | type | null | origin | meaning |
|---|---|---|---|---|
| `check` | str | no | *der* |  |
| `level` | str | no | *der* | PASS | WARN | INFO. A FAIL stops the build. |
| `note` | str | no | *der* |  |
| `value` | str | optional | *der* |  |
| `total` | int | optional | *der* |  |
| `violations` | int | optional | *der* |  |
| `rate` | float | optional | *der* |  |

## `documents.json`

Bills of Quantities read by OCR out of scanned contract agreements. Only contracts at or above 35% parse coverage are shipped — the corpus figures for all 1,237 documents are in the `corpus` block, not here.

**101 rows** · records at `contracts` · emitted by `pipeline/documents.py`

| field | type | null | origin | meaning |
|---|---|---|---|---|
| `id` | str | no | **pub** |  |
| `items` | list | no | *der* | Pay items: {code, description, quantity, unit, unitPrice, amount, visibility}. |
| `boqTotal` | float · PHP | no | *der* | Sum of PARSED rows only — not the contract total. |
| `coverage` | float | no | *der* | boqTotal / awardAmount. A BoQ sums to the price by construction, so this is an exact completeness measure. Median 18% corpus-wide; never reaches 90%. |
| `statedTotal` | float · PHP | yes (13) | *der* | The contract price read from the scan. Matched the export on 352 of 362 — the tier's own accuracy test. |
| `awardAmount` | float · PHP | no | **pub** | Carried through for that comparison. |
| `byVisibility` | obj | no | *der* | Value by whether an item survives to be photographed: surface | ground | footprint | buried | inside | gone | none. |
| `hasMeasuredQuantity` | bool | no | *der* | Carries a length or area. True for 209 contracts whose DESCRIPTION states no dimension. |

## `hazard.json`

Each coordinate against the UP NOAH 100-year modelled flood extent.

**1,293 rows** · records at `results` · emitted by `pipeline/hazard.py`

| field | type | null | origin | meaning |
|---|---|---|---|---|
| `id` | str | no | **pub** |  |
| `hazard` | str | yes (102) | join | *UP NOAH.* high | medium | low. Null where no coordinate is published. |
| `level` | int | yes (102) | join | NOAH's Var: 1 low, 2 medium, 3 high. |
| `metresToHazard` | int · m | yes (984) | *der* | Only for points OUTSIDE the modelled extent. Read it with the distance: 306 sit within a kilometre, which is where a revetment belongs. |

## `meta.json`

Coverage counters and source attribution shown in the interface.

**2 rows** · records at `sources` · emitted by `pipeline/build_dataset.py`

| field | type | null | origin | meaning |
|---|---|---|---|---|
| `name` | str | no | *der* |  |
| `publisher` | str | no | *der* |  |
| `url` | str | no | *der* |  |
| `license` | str | no | *der* |  |
| `provides` | str | no | *der* |  |
| `rowsUpstream` | int | yes | *der* |  |

## `national.json`

Every district engineering office in the country on the same procurement indicators, so "rank 1 of 197" is a table rather than a claim. PROCUREMENT ONLY — the records-side checks need municipal geometry this project ships for Bulacan alone.

**216 rows** · records at `offices` · emitted by `pipeline/national.py`

| field | type | null | origin | meaning |
|---|---|---|---|---|
| `office` | str | no | **pub** |  |
| `region` | str | no | **pub** |  |
| `contracts` | int | no | *der* |  |
| `value` | float · PHP | no | *der* |  |
| `contractors` | int | no | *der* | Distinct contractor names. Names, not entities — see LIMITATIONS.md. |
| `withRatio` | int | no | *der* | Contracts with both abc and awardAmount, so a ratio exists. |
| `at96` | int | no | *der* |  |
| `at96Rate` | float | no | *der* | at96 / withRatio. |
| `wholePctRate` | float | no | *der* | Any whole percentage, not only 96. |
| `singleBidderRate` | float | no | *der* |  |
| `coordRate` | float | no | *der* |  |
| `rankable` | bool | no | *der* | withRatio >= 30. Below that a rate is noise; such offices are listed and labelled, never dropped. |
| `rankAt96` | int | yes (19) | *der* | Null for offices that are not rankable. |

## `procurement.json`

Bidding record per contract, with red flags benchmarked against a national baseline computed BEFORE narrowing to this office.

**1,293 rows** · records at `results` · emitted by `pipeline/procurement.py`

| field | type | null | origin | meaning |
|---|---|---|---|---|
| `id` | str | no | **pub** |  |
| `abc` | float · PHP | no | **pub** |  |
| `awardAmount` | float · PHP | yes (19) | **pub** |  |
| `bidRatio` | float | yes (19) | *der* | awardAmount / abc. The 96.00% finding is this field. |
| `bidders` | int | no | **pub** |  |
| `bidderList` | list | no | **pub** | Names and PCAB ids where published. |
| `winnerPcab` | str | yes (128) | **pub** | PCAB registration number. 9.2% of bidder entries lack one. |
| `advertisementDate` | str | no | **pub** |  |
| `dateOfAward` | str | yes (187) | **pub** |  |
| `bidWindowDays` | int · days | no | *der* | Advertisement to bid deadline. SHORT_BID_WINDOW fires below this office's 5th percentile. |
| `documents` | obj | no | **pub** | URLs by type. programOfWork and engineeringDesign are null for ALL 1,293. |
| `procurementFlags` | list | no | *der* | Six checks; see METHODS.md. |
| `procurementScore` | int | no | *der* | Severity-weighted, same weights as auditScore. |
| `valueShare` | float | yes (26) | *der* | This contractor's share of all award value at this office. |

## `projects.json`

One row per flood-control contract at Bulacan 1st DEO, 2016-2025. The spine of the project: every other dataset joins to this on `id`.

**1,293 rows** · records at `(root array)` · emitted by `pipeline/build_dataset.py`

| field | type | null | origin | meaning |
|---|---|---|---|---|
| `id` | str | no | **pub** | DPWH contractId, e.g. 23CC0269. The join key everywhere. |
| `name` | str | no | *der* | Title-cased description, for display only. |
| `description` | str | no | **pub** | DPWH's own contract description, verbatim and uppercase. |
| `contractor` | str | no | **pub** | As published, including DPWH's own [REVOKED] marker where present. |
| `districtOffice` | str | no | **pub** |  |
| `municipality` | str | no | *der* | declaredMunicipality, falling back to geocodedMunicipality, then 'Unspecified'. |
| `declaredMunicipality` | str | yes (14) | *der* | Parsed out of the description text. Null when the description names no municipality. |
| `geocodedMunicipality` | str | yes (111) | join | *geoBoundaries PHL ADM3.* Point-in-polygon on the published coordinate. Null when there is no coordinate, or it falls outside every boundary. |
| `barangay` | str | yes (529) | *der* | Parsed from the description. Not a validated administrative code. |
| `lat` | float · degrees WGS84 | yes (102) | **pub** |  |
| `lng` | float · degrees WGS84 | yes (102) | **pub** |  |
| `offsetMetres` | int · m | yes (116) | *der* | Distance from the published coordinate to the boundary of the municipality the description names. Drives BOUNDARY_ADJACENT vs MUNI_MISMATCH. |
| `budget` | float · PHP | no | **pub** | AMBIGUOUS UPSTREAM. Matches abc on 52.7% of rows and awardAmount on 45.3% — reliably neither. Prefer abc or awardAmount; see QUALITY.md. |
| `abc` | float · PHP | no | **pub** | Approved Budget for the Contract — the ceiling. |
| `awardAmount` | float · PHP | yes (19) | **pub** | What it was awarded for. Null where PhilGEPS published no award. |
| `amountPaid` | float · PHP | no | **pub** | Disbursement is NOT published; this is what the export carries and is frequently zero. |
| `completion` | float · percent | no | **pub** | DPWH-REPORTED progress. Never an observation of the site. |
| `dpwhStatus` | str | no | **pub** | Completed | On-Going | For Procurement | Not Yet Started. |
| `status` | str | no | *der* | Lifecycle stage only: completed | ongoing | proposed | terminated. Deliberately excludes 'flagged', which is a condition, not a stage. |
| `startDate` | str | yes (68) | **pub** | ISO date. Notice to Proceed. |
| `endDate` | str | yes (331) | **pub** | ISO date. Contractual completion, not actual. |
| `infraYear` | int | no | **pub** | Funding year. |
| `fundingSource` | str | no | **pub** |  |
| `auditFlags` | list | no | *der* | Objects of {code, severity, detail}. Ten checks; see METHODS.md. |
| `auditScore` | int | no | *der* | Severity-weighted sum of auditFlags: high=3, medium=2, low=1. |
| `overdue` | bool | no | *der* | Past endDate and not reported complete. |
| `stalled` | bool | no | *der* | Started, but reported progress has not moved off a low value. |
| `siteRebuilds` | int | no | *der* | Other contracts sharing this exact coordinate. Not proof of duplication. |
| `structureType` | str | yes (84) | *der* | Parsed from the description — Revetment, Slope protection, Drainage, and so on. |
| `lengthMetres` | int · m | yes (1,069) | *der* | From chainage in the description. NULL FOR 83% — the central finding; see FINDINGS.md §1. |
| `stationFrom` | str | yes (1,069) | *der* | Chainage, e.g. 3+480. |
| `stationTo` | str | yes (1,069) | *der* |  |
| `bidderCount` | int | no | join | *PhilGEPS.* |
| `docCount` | int | no | join | *PhilGEPS.* Published documents attached to this contract. |
| `hasPhotos` | bool | no | **pub** |  |
| `photoCount` | int | no | **pub** |  |
| `hasSatelliteImage` | bool | no | **pub** | DPWH's own flag. Unrelated to this project's satellite tier. |
| `reportCount` | int | no | **pub** | DPWH's count, not MASID citizen reports. |

## `satellite.json`

Sentinel-2 change detection. THIS TIER DOES NOT DISCRIMINATE — it fires on flagged records and seeded controls at statistically indistinguishable rates, and every consumer must present its verdicts as context, never as evidence. See METHODS.md.

**200 rows** · records at `results` · emitted by `pipeline/satellite.py`

| field | type | null | origin | meaning |
|---|---|---|---|---|
| `id` | str | no | **pub** |  |
| `verdict` | str | no | *der* | change-at-point | change-offset | no-change-signal | not-assessable. CARRIES NO EVIDENTIAL WEIGHT. |
| `detail` | str | no | *der* | Prose written to prevent a verdict being read as a finding. |
| `confidence` | str | no | *der* |  |
| `flagged` | bool | no | *der* | Whether this site was in the flagged group for the validation split. |
| `cloudFreeFraction` | float | no | *der* |  |
| `rings` | obj | no | *der* | Per-radius 30/90/150 m stats: dNdvi, zNdvi, dNdbi, zNdbi, nullDiscs. |
| `control` | obj | no | *der* | Bootstrap null: 160 same-radius discs from the site's own 300-600 m annulus. |
| `chips` | obj | no | *der* | before/after NDVI composites as data URIs. False-colour science images — never re-tinted by the theme. |
| `scenesBefore` | list | no | join | *Sentinel-2 L2A.* |
| `scenesAfter` | list | no | join | *Sentinel-2 L2A.* |

## `scope.json`

The ground a contract claims to cover, as a corridor along the nearest watercourse. AN INFERENCE — the register publishes a point and a length but no direction; the direction comes from OpenStreetMap.

**219 rows** · records at `corridors` · emitted by `pipeline/scope.py`

| field | type | null | origin | meaning |
|---|---|---|---|---|
| `id` | str | no | **pub** |  |
| `lengthMetres` | int · m | no | *der* | The contract's stated length. |
| `coveredMetres` | int · m | no | *der* | What was actually drawn. Less than lengthMetres where the mapped channel ran out (16 contracts). |
| `metresToWaterway` | int · m | no | *der* | THE STRENGTH OF THE CLAIM. 34 corridors were derived from a channel more than 100 m away and are flagged in the interface. |
| `waterwayName` | str | yes (82) | join | *OpenStreetMap (ODbL).* |
| `waterwayClass` | str | no | join | river | stream | canal | drain. |
| `ring` | list | no | *der* | [[lng, lat], ...] polygon exterior. |

## `stat-comparison.json`

Statistic ablation for the imagery tier — disc-mean/tail/core/patch across 1.0-2.5 sigma. Summary object with no record array. Recall never exceeds 26%, which is what closed the question of whether a different statistic would have rescued the tier.

emitted by `pipeline/evaluate.py`

*Summary object — no per-record contract.*

## `wayback.json`

Distinct high-resolution flights over Bulacan. Esri publishes 28 archived versions that return imagery here; reading the acquisition metadata collapses them to SIX actual photographs.

**6 rows** · records at `frames` · emitted by `pipeline/wayback.py`

| field | type | null | origin | meaning |
|---|---|---|---|---|
| `release` | int | no | join | *Esri Wayback.* |
| `published` | str | no | join | When Esri published the version. NOT when the photograph was taken. |
| `flown` | str | no | join | SRC_DATE — the actual acquisition date. This is the one to caption with. |
| `resolutionMetres` | float · m | no | join | SRC_RES. Esri returns this as a STRING; coerced to float at the pipeline boundary. |
| `accuracyMetres` | float · m | no | join | SRC_ACC positional accuracy. Also string-typed upstream. |
| `provider` | str | no | join | e.g. Vivid Advanced. |
| `republishedAs` | int | no | *der* | How many Esri releases carry this same flight. The 2019-10-05 flight appears in twelve. |
| `tileUrl` | str | no | join | Template. Tiles are served live and never redistributed by this project. |

---

## Joins

`projects.json` on `id` is referenced by `procurement.json`, `hazard.json`, `scope.json`, `satellite.json`, `documents.json`.

`validate.py` checks every one of those ids exists in the parent, so a dataset cannot quietly describe a contract that is not in the register.

---

*Generated 2026-08-19 from `contract.yaml` v1. Regenerate with `python3 data-docs/build_dictionary.py`.*
