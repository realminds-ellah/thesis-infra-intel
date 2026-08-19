# Methods — why each number is the number it is

Every threshold in this project is a choice, and a choice someone can disagree
with. This is the page that says what was chosen and why, so a reviewer can
argue with the reasoning instead of guessing at it.

The rule underneath all of it: **a threshold decides who gets looked at, never
who is guilty.** Every output is a queue, and every queue is an ordering of a
published record — not a prediction about the ground.

---

## Severity weights and the triage threshold

Flags carry a severity, and severities are summed:

| severity | weight | used for |
|---|---|---|
| high | 3 | the coordinate cannot be checked at all, or plainly contradicts the description |
| medium | 2 | a real discrepancy with an innocent explanation available |
| low | 1 | within tolerance, or a formatting artefact |

`auditScore` and `procurementScore` are those sums. A contract counts as high on
a side at **≥ 3**.

Three is deliberate: it is reached by **one high-severity check**, or by **three
low ones**. Anything higher would have required two independent serious problems
before a contract entered the queue, which for a register this size means an
empty queue. Anything lower makes a single formatting artefact enough.

The threshold is a **dial on queue length, not a claim about truth.** Moving it
moves how many contracts an inspector is asked to look at.

## Why the two signals are crossed at all

Fusion is only worth doing if the two sides are not measuring the same thing.
Across all 1,293 contracts the records score and the procurement score correlate
at **r = −0.26**. They are not proxies for each other — if anything they lean
apart — so "high on both" (**17 contracts**) is a genuinely narrower set rather
than the same contracts counted twice.

That figure is **computed at build time** (`SIGNAL_CORRELATION` in
`src/app/data/index.ts`), not written down. It used to be hardcoded in two
places, as `+0.05` and `−0.12`, and both were wrong. A number that justifies a
method should not be a number anyone can retype.

## Boundary tolerance — 300 m

The check that separates *"the coordinate contradicts the description"* from
*"the coordinate is near a boundary"*.

When a published coordinate falls in a different municipality than the
description names, the distance to the named municipality's boundary is
measured. Within **300 m** it is `BOUNDARY_ADJACENT`, severity **low**, worded
*"likely cartographic"*. Beyond it, `MUNI_MISMATCH`, severity **high**, with the
distance stated in the flag text.

300 m is generous on purpose. Municipal boundaries in the geoBoundaries ADM3 set
are themselves approximations, and a revetment legitimately sits **on** a
boundary — that is often exactly where a river is. A tighter tolerance would
manufacture high-severity flags out of cartography.

## Contractor concentration — 15× and 8×

`AWARD_CONCENTRATION` fires when a contractor's share of everything this office
awarded exceeds a multiple of an equal split among all identified contractors.

- **≥ 15×** an equal share → medium
- **≥ 8×** → low
- below → no flag

Expressed as a multiple rather than a percentage so it does not need retuning
when the number of contractors changes. It describes **concentration at one
office**, which has innocent explanations — few firms are qualified for
large flood-control work — and the flag text says so.

## The 96.00% finding

A bid is flagged when `awardAmount / abc` lands on a **whole percentage** of the
approved budget. Severity is **medium** when that percentage is exactly 96.00
and **low** otherwise.

The reason 96.00 is singled out is not a hunch, it is the national comparison:

| | this office | nationally |
|---|---|---|
| awarded at exactly 96.00% of the ceiling | **38.4%** | **3.9%** |
| awarded at any whole percentage | — | 26.5% |

Ranked against the **197 offices** with at least 30 priced contracts,
Bulacan 1st DEO is **first**, and the second-placed office is at 17.7% — less
than half. `pipeline/national.py` computes that over **34,080 contracts across
216 offices**, and the baseline is computed **before** narrowing, so the
comparison cannot be an artefact of the slice.

A statistical anomaly in a published record. Whole-percentage bids have innocent
explanations — an estimating convention, a template, a rounding rule — and the
interface says so wherever the number appears. **It is a reason to ask, and this
project cannot tell you the answer.**

## Rankability — 30 contracts

An office needs **≥ 30 priced contracts** to receive a rank. A 100% rate over
three contracts is not evidence of anything.

Offices below the line are **listed and labelled, never dropped.** Removing them
would quietly flatter the ranking by deleting its noisiest members rather than
describing them.

---

## The satellite tier, and why it is reported as a failure

### The design

Sentinel-2 L2A, 10 m per pixel. For each site, a median NDVI/NDBI composite from
the year before construction and the year after it was due to finish, sampled at
**30, 90 and 150 m** radii. Construction should read as vegetation down and
built surface up.

### The calibration, which is the part that matters

A raw difference means nothing without knowing how much a patch of Bulacan
moves on its own. So each site is scored against **its own surroundings**: 160
same-radius discs dropped at random in that site's **300–600 m annulus**, giving
an empirical null. A site is flagged when it passes **−2σ NDVI and +2σ NDBI**
against that local distribution.

Two corrections were needed to make even this honest:

- An earlier version compared a **mean over ~28 pixels** against a
  **single-pixel spread**, which understates z by √N and inflated everything.
- `hash()` is salted per process in Python, so the "random" discs were not
  reproducible between runs. Replaced with `zlib.crc32`.

### The result

| | detections | rate |
|---|---|---|
| flagged contracts | 6 / 102 | **5.9%** |
| seeded controls | 3 / 39 | **7.7%** |

**Statistically indistinguishable — and the control rate is higher.** The tier
has no measured ability to tell a flagged contract from an ordinary one.

Note what this does *not* require: it needs **no assumption about whether
flagged records are ghosts.** Firing on 7.7% of ordinary completed contracts —
projects that were, in the main, actually built — is a recall failure on its own
terms.

### Ruling out the obvious objection

The natural response is *"you picked the wrong statistic."* `pipeline/evaluate.py`
tests disc-mean, tail, core and patch statistics across **1.0–2.5σ**. Recall
never exceeds **26%**. It is not the statistic.

The cause is physical: **at 10 m per pixel, one pixel is wider than most
structures in this register.** A two-metre revetment cannot produce a signal.

### What follows

The verdicts are shown, labelled as carrying no evidential weight, and
**excluded from every score in the project**. Letting them raise `auditScore`
would launder a null result into a ranking.

---

## Scope corridors — an inference, and labelled as one

The register publishes a point and, for 220 contracts, a length. It never
publishes a **direction**. Drawing a line in a chosen direction would invent the
one fact the shape appears to assert.

Flood control follows a watercourse, so the direction is **looked up** rather
than guessed: the point is projected onto the nearest OpenStreetMap channel
within **500 m**, half the stated length is walked along it each way, and the
result is buffered by **18 m** either side (up to 40 m for long works).

The honesty control is `metresToWaterway`, emitted per corridor:

- a corridor derived from a channel **7 m** from the point is a strong claim
- **34 corridors** were derived from a channel more than **100 m** away, and the
  interface flags those in red

A flood-control coordinate 300 m from any mapped water is a fact about that
coordinate whatever shape is drawn over it.

---

## Document OCR — an evaluation that costs nothing

The contract price is written **inside** each scan and is **already held** in the
structured export. So every document carries its own test, with no annotation:

extract a field we already know → compare → report the match rate.

| | |
|---|---|
| documents attempted | 1,237 |
| yielded a parsable Bill of Quantities | 419 |
| price read | 362 |
| **matched the export within one peso** | **352 — 97.2%** |

### The bug that number found

The first full run reported **92.3%**. Inspecting the mismatches showed a single
cause: a printed `4,850,890.09` comes back from OCR as `4,850,890,09`, so
stripping commas made it **exactly a hundred times too big**. Four of six visible
mismatches were that, to the centavo.

Deciding the decimal separator by **shape** — two digits after the last
separator means it is the decimal, whichever glyph OCR chose — took accuracy to
97.2% and raised the yield from 330 to 419.

**This is the argument for running a corpus before trusting a sample.** 100% on
30 documents was not wrong; it was uninformative.

### Coverage is exact, not estimated

A Bill of Quantities sums to the contract price by construction, so
`parsed rows ÷ price` **is** the completeness. Median **18%**, best **86%**,
never 90%. The app therefore ships only contracts at or above **35%** coverage
and states the figure on each one.

---

## Visibility classification

Every pay item is sorted by whether it survives to be photographed, **by DPWH
pay-item code** rather than by description — OCR truncates descriptions across
columns ("Piles, Driven" for "Prestressed Concrete Piles, Driven"), and the code
is a national standard that survives intact.

| bucket | meaning |
|---|---|
| surface | at the surface when finished — pavement, markings, gratings |
| ground | visible only from beside it — floodgates, culvert outlets |
| footprint | outline visible from above; thickness and volume are not |
| buried | under ground or under a surface course |
| inside | cast into the concrete |
| gone | the item is removal; nothing remains |

Across the 419 contracts read: **0.1% directly visible, 32.7% footprint only,
67.1% invisible to any camera.**

That last figure is a limit of **the work**, not of the method. No satellite,
drone or street-level pass sees rebar inside a beam.

---

*Sources and licences: [`../SOURCES.md`](../SOURCES.md).
Field-level definitions: [`DICTIONARY.md`](DICTIONARY.md).
Known limits with magnitudes: [`LIMITATIONS.md`](LIMITATIONS.md).*
