# Findings from the public record — Bulacan 1st DEO

Things the data said that we did not go looking for. Each one is measured from
the shipped datasets and reproducible from `masid/pipeline/`.

Every finding here is a statement about **what the record contains or contradicts**,
never about what anyone did. That wording is deliberate and load-bearing.

---

## 1. Most contracts publish no dimension at all

**1,069 of 1,293 flood-control contracts (83%) state no size of any kind** — no
length, no area, no volume.

You cannot tell from the public record whether a ₱96 million contract built
fifty metres of revetment or two kilometres of it.

*How this was established, because "the parser missed it" is the obvious first
suspicion and was ruled out:*

- Of the 1,069 with no parsed length, only **186 contain a digit at all**.
- Six length formats were tested against them — `STA 0+000 to STA 0+780`,
  `L=780`, `780 l.m.`, `780 m`, `K002+850`, and the word *length*. **Zero matches.**
- The `components` array in the DPWH detail export carries chainage for some
  contracts in a different format (`Sta. 03+480 to Sta. 03+740`). Adding it
  recovers **11 contracts**.

A typical description in full: *"CONSTRUCTION OF REVETMENT AT TIBAGUIN,
HAGONOY, BULACAN"*.

**Why it matters.** This is the reason delivery cannot be verified from the
public record, and it is upstream of every other limitation in this project.
Without a dimension there is no quantity to check imagery against, no basis for
a unit-cost comparison across contracts, and no way to distinguish a modest
repair from a major work at the same price. It sits beside the 102 contracts
that publish no coordinate: together, most of this register cannot be checked
against the ground even in principle.

**Scope corridors are limited by this, not by the method.** 219 corridors were
built — the ceiling is 220, because that is how many contracts state a length.

### What the documents turned out to hold — the whole corpus, read

The dimensions are not missing from the record. They are published in a form
nothing could read. All **1,237 contract agreements** were fetched, rasterised at
300 dpi and OCR'd (`pipeline/documents.py`, 43 minutes, ordinary `tesseract` —
no vision model and no API key).

| | |
|---|---|
| Documents attempted | 1,237 |
| Genuinely unreadable — no text, or fetch failed | **22 (1.8%)** |
| Yielded a parsable Bill of Quantities | **1,086 (88%)** |
| Published **without** a Bill of Quantities | **129 (10%)** |
| Text recovered but the table defeated the parser | **0** |
| Contract price read and matched against the register | **932 / 962 = 96.9%** |
| **Contracts with no published dimension that DO carry a measured quantity in the paper** | **777 of 1,015 (77%)** |

Two things follow, and they pull in opposite directions.

**The information exists, and there is far more of it than the register admits.**
More than three quarters of the contracts whose description states no size do
state one inside the scan. That is not a gap in the record; it is a gap in what
the record can be read with.

**The remaining barrier is not technical.** Of the 151 documents that yield no
table, 129 contain **no Bill of Quantities at all** — and that is a fact about
what DPWH publishes, not a limit of the reader. Those documents run to four or
five pages, well inside the eight this pipeline rasterises, so nothing was
truncated: for roughly one contract in ten, the published contract agreement
simply does not include the priced schedule of work.

Parse completeness now runs at a **median of 92% of contract value**, with the
75th through 95th percentiles at 100%. That is the honest measure, since a Bill
of Quantities sums to the contract price by construction — and it is measured
without ever telling the parser the target. On 24CC0400 the recovered rows total
₱209,473,417.04 against a published award of ₱209,524,421.80, a gap of 0.02%.

*Two corrections worth recording, both found by inspecting mismatches rather
than by adding capability.*

*The first full run reported 92.3% price accuracy. A printed `4,850,890.09` was
OCR'd as `4,850,890,09`, so stripping commas made it exactly a hundred times too
big. Deciding the decimal separator by shape rather than by character took
accuracy to 97.2% and raised the BoQ yield from 330 to 419.*

*The 796 documents filed for months under "the table defeated the parser" were
never defeated by their tables. The number pattern permitted a space inside a
number — a concession to OCR splitting a thousands group — and that also let a
number swallow the whitespace between two columns, so `102.60 meter 2,785.80
285,823.08` was read as a quantity, a price of 278,580,285.82 and an amount of
3.08. The arithmetic check then correctly rejected a row that was only ever
misread. Removing the space and letting the arithmetic choose the columns
instead of guessing them from whitespace took the yield from 419 to 1,086. The
scans had been readable the whole time; no model was needed, and the assumption
that one was needed went untested for months.*

### How much of a contract any camera can check

Every pay item was classified by whether it survives to be photographed, across
all 1,086 contracts read:

| share of read value | |
|---|---|
| **0.2%** | visible from above or from beside it |
| **34.9%** | outline visible only — structural concrete, where thickness and volume are not |
| **64.9%** | **invisible to any camera** — excavation and embankment backfilled (58.7%), reinforcing steel cast in (4.6%) |

**This is not a resolution limit and no satellite fixes it.** Two thirds of what
is paid for is underneath or inside the finished structure. Remote monitoring of
flood-control delivery can establish *existence and footprint* and cannot
establish *quantity* — which is a finding about the ceiling on this whole
approach, not a shortcoming of any one method.

---

## 2. This office awards at exactly 96.00% of the approved budget far more often than the country does

**38.4%** of contracts at Bulacan 1st DEO were awarded at exactly 96.00% of the
approved budget ceiling, against a national rate of **3.9%** — **rank 1 of 48**
district engineering offices compared.

Absent through 2018, then 51% in 2020, and never below 36% since.

A statistical anomaly in a published record. It is not proof of anything, and
the app says so wherever the number appears.

---

## 3. Twelve firms hold half the money

**12 of 176 contractors** account for half of the **₱67.7 billion** awarded.
**8 firms carry a registration DPWH's own export marks `[REVOKED]`**, across
₱4.92 billion of contracts. The portal does not publish the revocation date, so
whether it preceded or followed each award has to be established separately.

---

## 4. The high-resolution imagery archive has a five-and-a-half-year hole over the spending surge

Esri publishes 28 archived versions of its imagery that return something over
Bulacan. Reading the acquisition metadata, those 28 are republications of **six
actual photographs** — the 5 October 2019 flight alone appears in twelve of them.

The real flights: 2010-02-08 · 2014-05-27 · 2018-05-23 · 2019-05-10 ·
2019-10-05 · **2025-04-07**.

**The 2022, 2023 and 2024 contracts — the largest by value in the whole register —
were awarded, built and completed without one high-resolution photograph being
taken over them.**

Of the 962 contracts carrying both a start and end date: 136 (14%) have a flight
during construction, 826 (86%) have a clean before-and-after pair, 0 have neither.

---

## 5. The automated satellite tier does not work, and this was measured

Sentinel-2 NDVI/NDBI change detection fires on **6 of 102** flagged contracts and
**3 of 39** seeded controls — statistically indistinguishable. It has no measured
ability to tell a flagged contract from an ordinary one.

At 10 m per pixel, one pixel is wider than most structures in this register. A
statistic ablation (`pipeline/evaluate.py`) across disc-mean/tail/core/patch ×
1.0–2.5σ never exceeds 26% recall.

Reported as a null result rather than presented as a detector.

---

## 6. The two audit signals are not proxies for each other

Records-side score and procurement-side score correlate at **r = −0.26** across
all 1,293 contracts. If anything they lean apart, so "high on both" (**17
contracts**) is a genuinely narrower set rather than the same contracts counted
twice.

*Note: this figure was previously hardcoded in two places with two different
wrong values (+0.05 and −0.12). It is computed at build time now.*

---

## 7. Flood-control coordinates are not always near water

Of the 219 scope corridors, **34 were derived from a mapped watercourse more
than 100 m from the published coordinate**. One example: contract `22CC0095`,
described as a revetment along the Guiguinto River, matched an unnamed stream
**279 m away**, and already carried a "coordinate contradicts description" flag.

A flood-control coordinate that far from any mapped channel is a fact about that
coordinate, whatever shape is drawn over it.

---

## Reproducing these

```bash
cd masid
python3 pipeline/verify_data.py     # gate — must pass first
python3 pipeline/build_dataset.py   # register + consistency checks
python3 pipeline/procurement.py     # bidding, national baseline
python3 pipeline/satellite.py       # Sentinel-2 tier + its self-validation
python3 pipeline/evaluate.py        # statistic ablation
python3 pipeline/hazard.py          # UP NOAH flood hazard join
python3 pipeline/wayback.py         # dated imagery archive
python3 pipeline/scope.py           # scope corridors from OSM waterways
```
