# Limitations — every one, with its measured size

A limitations section that says "the data may be incomplete" tells a reviewer
nothing. Each row below carries a **number**, so the reader can judge how much it
matters rather than take a hedge on trust.

Ordered by how much they constrain what this project can claim.

---

## The record itself

| # | limitation | size | consequence |
|---|---|---|---|
| 1 | **No dimension published** | **1,069 of 1,293 (83%)** | No quantity for imagery to be checked against. Upstream of everything else. Only 186 of them contain a digit at all; six length formats and the detail export's `components` array were tested before concluding it. |
| 2 | **No coordinate published** | **102 (7.9%)** | Cannot be located, so no imagery, hazard join or corridor is possible for them at all. |
| 3 | **Disbursement not published** | **all 1,293** | `amountPaid` is frequently zero. The project can compare award to ceiling, never award to what was actually paid. |
| 4 | **Program of Work never published** | **0 of 1,237** | The document that would carry designed quantities is absent for every contract. Quantities had to come from contract agreements instead. |
| 5 | **`budget` column is ambiguous** | matches `abc` 52.7%, `awardAmount` 45.3% | Reliably neither. The interface reads `abc` and `awardAmount` explicitly. An earlier version filtered on `budget` and silently excluded the twelve largest contracts. |
| 6 | **Revocation dates not published** | 8 firms, ₱4.92 B | DPWH marks a registration `[REVOKED]` but never says when. Whether it preceded or followed an award cannot be established from the record. |
| 7 | **Contractors identified by name** | 176 names | Not by PCAB entity. `winnerPcab` is null on 128 contracts, and 9.2% of bidder entries carry no PCAB id, so a firm trading under two spellings counts twice. |
| 8 | **Source is a mirror, not a release** | — | Data comes from BetterGov's scrape of the DPWH portal. Verified against a published Notice of Award to the centavo, but *faithful-but-unofficial*: good enough to reason on, not to cite as the government's own position. |

## What imagery can and cannot settle

| # | limitation | size | consequence |
|---|---|---|---|
| 9 | **Most of a contract is invisible to any camera** | **67.1% of read value** | Excavation backfilled, reinforcing steel cast in, subbase under the surface course. **Not a resolution limit** — remote monitoring can establish existence and footprint, never quantity. |
| 10 | **High-resolution archive has a 5½-year hole** | Oct 2019 → Apr 2025 | The 2022–24 contracts, the largest by value, were awarded, built and completed with **no** high-resolution photograph taken over them. Only 6 distinct flights exist since 2010. |
| 11 | **Sentinel-2 tier does not discriminate** | 5.9% flagged vs 7.7% control | No measured ability to tell a flagged contract from an ordinary one. Excluded from every score. See [`METHODS.md`](METHODS.md). |
| 12 | **Cloud** | **59 of 200** assessed sites | Unreadable in the wet season. This is the case for SAR, which is a pending PhilSA request. |
| 13 | **Positional accuracy ±8.47 m** | — | Imagery cannot judge the alignment of a two-metre revetment. |
| 14 | **Imagery resolution ceiling** | `MaxMapLevel 19`, zoom 20 returns 404 | 0.3 m per pixel is the finest that exists. A 1 m drainage line is 3 pixels and effectively invisible. |
| 15 | **Ground-level coverage unknown** | not measurable without a key | Street-level imagery follows roads; these sites are riverbanks. Both Street View metadata and the Mapillary API refuse unauthenticated requests, so coverage could not be measured. |

## Derived layers

| # | limitation | size | consequence |
|---|---|---|---|
| 16 | **Scope corridors are an inference** | 219 built, 220 possible | Direction comes from OpenStreetMap, not from DPWH. The work may be on one bank; the corridor covers both, because which bank is not published either. |
| 17 | **Corridors from distant channels** | **34 over 100 m away** | May follow the wrong watercourse. `metresToWaterway` is emitted per corridor and flagged in the interface. |
| 18 | **Corridors truncated** | 16 contracts | The mapped channel ran out before the stated length; `coveredMetres` records what was actually drawn. |
| 19 | **Geocoding resolves to municipality only** | — | No barangay layer ships, so `barangay` is parsed from description text and is not a validated administrative code. |
| 20 | **Boundary geometry is itself approximate** | — | Why the tolerance is a generous 300 m; a tighter one would manufacture flags out of cartography. |

## Document extraction

| # | limitation | size | consequence |
|---|---|---|---|
| 21 | **Table parsing is incomplete** | median **18%** of value, best 86%, never 90% | Only 101 of 1,237 contracts reach the 35% threshold to be displayed, and each states its own coverage. The tables are the obstacle, not the scans. |
| 22 | **Two thirds of documents defeat the parser** | **796 of 1,237 (64%)** | They give up text and no parsable rows. Only **22 (1.8%)** are genuinely unreadable. |
| 23 | **OCR price accuracy is not perfect** | **352 of 362 (97.2%)** | Measured, not assumed. The 10 misses are unexplained and should not be treated as zero. |
| 24 | **Descriptions truncate across columns** | — | Which is why visibility is classified by DPWH **pay-item code**, not by the OCR'd wording. |

## Scope and comparison

| # | limitation | size | consequence |
|---|---|---|---|
| 25 | **One district office** | 1 of 216 | Findings are about Bulacan 1st DEO. The Nationwide screen compares **procurement indicators only**. |
| 26 | **National comparison excludes record checks** | — | Those need municipal polygon geometry, which ships for Bulacan alone. Claiming a national records score without it would be inventing one. |
| 27 | **No ground truth to validate any ranking** | — | The ICI referred its findings to the DOJ and Ombudsman rather than publishing an itemised list. **This is why the triage is always called an ordering and never a prediction**, and why no model in this project may output a fraud score. |
| 28 | **Data is a snapshot** | records to Jan 2026 | No refresh path. A stale ₱67.7 B quietly becomes wrong. |

## The prototype boundary

| # | limitation | consequence |
|---|---|---|
| 29 | **No server** | Citizen reports and imagery reviews live in one browser and reach nobody. Export before relying on them. |
| 30 | **No accounts** | The login screen is decorative; any role can be selected. Deletion is ownership by browser, not moderation. |
| 31 | **No audit trail on moderation** | A deployed version naming contractors needs soft deletes, a reason and a record of who acted. |
| 32 | **Right of reply is a stub** | Real, visible, and it goes nowhere — the panel says so rather than pretending to file something. |

---

## The two that most constrain the thesis

**#1 and #9 together.** Most contracts publish no dimension, and most of what is
paid for is physically invisible once built. Those are not shortcomings of this
method — they are **the ceiling on remote verification of infrastructure
delivery**, and they are the strongest reason the DPWH and PhilSA data requests
matter more than a cleverer algorithm.

---

*Figures here are recomputed by the pipelines and cross-checked against
[`QUALITY.md`](QUALITY.md) and [`../../FINDINGS.md`](../../FINDINGS.md).*
