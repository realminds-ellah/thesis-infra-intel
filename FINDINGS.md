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
| No Bill of Quantities inside the document | 129 (10.4%) |
| Contract price read and matched against the register | **932 / 962 = 96.9%** |
| **Contracts with no published dimension that DO carry a measured quantity in the paper** | **774 of 1,015 (76%)** |

**Three quarters of the gap closes.** Of the 1,015 contracts whose published
description states no size at all, **774 state one inside the scan**. That is not
a gap in the record; it is a gap in what the record could be read with — and it
is now largely read.

**And the remaining barrier is small.** Only **22 documents (1.8%)** are
genuinely unreadable. A further **129 (10.4%)** contain no Bill of Quantities at
all, which is a fact about those documents rather than a failure of extraction.

Parse completeness is measured exactly rather than estimated, because a Bill of
Quantities sums to the contract price by construction: **median 92% of contract
value**, with **670 of 972 shipped contracts landing between 90% and 102%** —
the band a complete table should occupy. Only **7 (0.7%)** exceed 102%, where a
subtotal row has been swept in.

*Two corrections worth recording, both found by running the corpus rather than a
sample. The first full pass reported 92.3% price accuracy; the mismatches had a
single cause — a printed `4,850,890.09` read back as `4,850,890,09`, so stripping
commas made it exactly a hundred times too big. Deciding the decimal separator by
shape fixed it. The first parser then recovered only a median 18% of each table;
the current one recovers 92%, which moved recovered dimensions from 209 to 774.
**100% accuracy on 30 documents was never wrong — it was uninformative.***

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

## 2. Nearly everything can be checked for existence; almost nothing for quantity

This is the first question anyone asks about the premise: *if some flood control
is not visible from a satellite, is this approach viable at all?*

It is, and the confusion comes from two different questions being asked as one.

### Is the structure there?

Classified by whether the FINISHED work sits where a camera can see it, over all
1,293 contracts:

| | contracts | value | share |
|---|---|---|---|
| **At the surface — a camera can see it** | 542 | ₱30.15 B | **45.5%** |
| Probably at the surface — generic title | 549 | ₱29.72 B | 44.8% |
| Partly — dredging leaves a changed channel | 2 | ₱0.09 B | 0.1% |
| **Definitely buried** — drainage, culverts, pipes | **116** | **₱1.19 B** | **1.8%** |
| Title states no structure type | 84 | ₱5.19 B | 7.8% |

Revetments, bank protection, slope protection, river walls, dikes, pumping
stations and floodgates all sit at the surface. **Only 1.8% of value is work
that is genuinely buried when finished.**

By structure type:

| type | contracts | value |
|---|---|---|
| Flood control structure | 390 | ₱20.16 B |
| Bank protection | 176 | ₱12.39 B |
| Revetment | 183 | ₱7.84 B |
| Slope protection | 101 | ₱5.06 B |
| Flood mitigation structure | 87 | ₱5.02 B |
| Waterway works | 61 | ₱3.72 B |
| Pumping station | 34 | ₱2.16 B |
| River wall | 32 | ₱2.02 B |
| Drainage | 116 | ₱1.19 B |
| Channel works, Dike, Flood gate, Dredging, Riprap | 29 | ₱1.58 B |
| *(not stated in the title)* | 84 | ₱5.19 B |

### Was it built to specification?

Here only **35.1%** is checkable — see §1. Even for a perfectly visible
revetment, most of the cost is excavation that was backfilled, reinforcing steel
cast into concrete, and subbase under the surface course.

### The reconciliation

> **You can nearly always tell whether something is there. You can rarely tell
> whether it is what was paid for.**

That is not a weakness in the method. It is a measured statement of the ceiling
on remote monitoring of infrastructure delivery, and it is stated nowhere else
in the literature with numbers attached.

**It also means the approach addresses the thing the scandal is actually about.**
The 421 ghost projects confirmed nationally in October 2025 were *nothing there*
— and "nothing there" is the 90% case, not the 32.8% one.

### What follows for how this is written up

- The claim is **verifying existence and extent**, not verifying delivery. Every
  tier in this project does what that narrower claim says.
- The invisible share is a **result**, not an apology: 64.9% of contract value
  cannot be verified by any camera at any resolution, which is why the DPWH and
  PhilSA data requests matter more than a better algorithm would.
- The other three tiers — record consistency, procurement red flags, citizen
  reports — exist precisely to reach what imagery cannot. Satellite is one of
  four, and the only one measured to be weak (§6).

### The honest caveat

The **44.8% "probably at the surface"** rests on titles like *"Flood control
structure"*, which is a category rather than a description, and **84 contracts
state no structure type at all**. Treat **45.5% as firm and 90% as an upper
bound.** The classification is by parsed title, not by inspection.

---

## 3. This office awards at exactly 96.00% of the approved budget far more often than the country does

**38.4%** of contracts at Bulacan 1st DEO were awarded at exactly 96.00% of the
approved budget ceiling, against a national rate of **3.9%** — **rank 1 of 48**
district engineering offices compared.

Absent through 2018, then 51% in 2020, and never below 36% since.

A statistical anomaly in a published record. It is not proof of anything, and
the app says so wherever the number appears.

---

## 4. Twelve firms hold half the money

**12 of 176 contractors** account for half of the **₱67.7 billion** awarded.
**8 firms carry a registration DPWH's own export marks `[REVOKED]`**, across
₱4.92 billion of contracts. The portal does not publish the revocation date, so
whether it preceded or followed each award has to be established separately.

---

## 5. The high-resolution imagery archive has a five-and-a-half-year hole over the spending surge

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

## 6. The automated satellite tier does not work, and this was measured

Sentinel-2 NDVI/NDBI change detection fires on **6 of 102** flagged contracts and
**3 of 39** seeded controls — statistically indistinguishable. It has no measured
ability to tell a flagged contract from an ordinary one.

At 10 m per pixel, one pixel is wider than most structures in this register. A
statistic ablation (`pipeline/evaluate.py`) across disc-mean/tail/core/patch ×
1.0–2.5σ never exceeds 26% recall.

Reported as a null result rather than presented as a detector.

---

## 7. The two audit signals are not proxies for each other

Records-side score and procurement-side score correlate at **r = −0.26** across
all 1,293 contracts. If anything they lean apart, so "high on both" (**17
contracts**) is a genuinely narrower set rather than the same contracts counted
twice.

*Note: this figure was previously hardcoded in two places with two different
wrong values (+0.05 and −0.12). It is computed at build time now.*

---

## 8. Flood-control coordinates are not always near water

Of the 219 scope corridors, **34 were derived from a mapped watercourse more
than 100 m from the published coordinate**. One example: contract `22CC0095`,
described as a revetment along the Guiguinto River, matched an unnamed stream
**279 m away**, and already carried a "coordinate contradicts description" flag.

A flood-control coordinate that far from any mapped channel is a fact about that
coordinate, whatever shape is drawn over it.

---

## 9. The money went where the model says it floods — and the one signal that says otherwise is measuring its own coordinates

`pipeline/hazard_triage.py` reads the UP NOAH 100-year flood hazard join across
the register for the first time, and crosses it with the 2×2 triage.

### Allocation

| band | contracts | share | value | share |
|---|---|---|---|---|
| high | 596 | 50.0% | ₱35.13 B | 53.2% |
| medium | 210 | 17.6% | ₱11.25 B | 17.0% |
| low | 76 | 6.4% | ₱3.69 B | 5.6% |
| just outside | 306 | 25.7% | ₱15.75 B | 23.9% |
| **far outside (>1 km)** | **3** | **0.3%** | ₱0.21 B | 0.3% |

**74.1% of contracts and ₱50.07 B — 75.8% of value — sit inside the modelled
extent, and only three contracts in the entire register are more than a
kilometre from any modelled flood.** This is a reassuring result and it is
reported as one. Allocation broadly tracks modelled hazard; a revetment belongs
at the *edge* of a flood zone, so "just outside" is where one is often supposed
to be.

### Association, and the confound that explains it

| band | n | records-flagged | procurement-flagged |
|---|---|---|---|
| high | 596 | 1.8% | 28.2% |
| medium | 210 | 2.9% | 33.3% |
| low | 76 | 7.9% | 30.3% |
| outside | 309 | **10.7%** | 23.9% |
| all | 1,191 | 4.7% | 28.1% |

The **records** signal differs sharply across hazard bands (χ² = 38.82, 3 df,
p < 0.0001), rising monotonically as hazard falls. The **procurement** signal
does not (χ² = 5.66, 3 df, p = 0.13). The both-flagged list is 52.9% outside the
extent against 25.6% for everything else (Fisher exact, odds ratio 3.28,
p = 0.021).

**That records association is almost certainly an artefact, and the test for it
is in the script.** A contract lands outside the modelled extent for two very
different reasons: it was built outside a flood zone, or its coordinate is
wrong. Coordinate error is *an input to the records score*, so the two are not
independent by construction — and the data agrees:

| offset from the declared municipality | >0 m | >1 km | >5 km |
|---|---|---|---|
| inside the extent | 5.2% | 2.1% | 1.3% |
| outside the extent | **13.4%** | 4.3% | 1.6% |

Coordinates outside the modelled extent are 2.6× more likely to be displaced
from the municipality their own contract names (Mann-Whitney, p = 1.1 × 10⁻⁶).
The records signal is not telling us flood control was built where it does not
flood; it is telling us those coordinates are unreliable, which is what it was
built to say.

**The meaningful result here is therefore the negative one.** The procurement
signal — which never touches coordinates — shows **no** association with flood
hazard. There is no evidence in this register that procurement-suspicious
contracts were sited where flooding is not modelled.

### What this analysis structurally cannot see

**102 contracts have no published coordinate, and all 102 are records-flagged**
— publishing no coordinate *is* a records inconsistency. So the excluded set is
the most records-suspicious part of the register, and every records figure above
rests on 56 of the 158 records-flagged contracts. That is not a random slice and
no amount of testing repairs it.

Hazard is terrain and rainfall; the triage is paperwork. Neither is evidence
about whether a structure was delivered.

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
python3 pipeline/hazard_triage.py   # hazard x 2x2 triage, and the confound test
python3 pipeline/wayback.py         # dated imagery archive
python3 pipeline/scope.py           # scope corridors from OSM waterways
python3 pipeline/documents.py --all # scanned contract agreements -> Bill of Quantities
```
