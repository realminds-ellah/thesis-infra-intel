> ## ⚠️ Superseded — this is the original proposal, kept as written
>
> This document is the **background-research phase** of the thesis, written
> 9–10 July 2026 before any data had been acquired. It proposed satellite-only
> ghost-project detection. It is kept unedited because the thesis's own argument
> depends on showing what was assumed before measurement and what survived it.
>
> **Three claims on this page have since been measured and did not hold:**
>
> | Claimed here | What was measured |
> |---|---|
> | Free satellite imagery can detect these structures | Sentinel-2 at 10 m does not discriminate — 5.9% vs 7.7%, Fisher p = 1.00 |
> | The recorded locations are falsified | All 9 COA-named contracts geocode to the municipality their description names, at **zero** offset |
> | ~21 COA-confirmed cases exist to validate against | 9 matched to contract IDs from three filings; the records tier flags **none** of them |
>
> For the current state of the project, see [`../README.md`](../README.md).
> For what was measured, see [`../FINDINGS.md`](../FINDINGS.md).

---

# Auditing Flood-Control Projects from Space

*A BS Mathematics (major in Computer Science) thesis: using free satellites to
check whether declared flood-control projects were actually built.*

---

## 1. What this thesis is about (in plain words)

In 2025, the Philippines' Commission on Audit (COA) discovered that many
"100% complete" flood-control projects in Bulacan were **ghost projects** —
paid for, but never built, or built in the wrong place. COA found these by hand,
sending inspection teams to a few dozen sites, *"supported by satellite imagery."*

This thesis asks:

> **Can we detect ghost and mismatched flood-control projects automatically,
> from free satellite images — and check hundreds of projects instead of a few dozen?**

In short: COA verified ~21 projects manually. This thesis builds a method to do
what they did, **automatically and at scale**, and proves it works by checking that
it catches the same ghosts COA already confirmed.

> **Why this matters, who uses it, and what can be built from it:** see
> [`SIGNIFICANCE.md`](SIGNIFICANCE.md).
> **Alternative thesis ideas (ranked) & the recommended upgrade:** see
> [`IDEAS.md`](IDEAS.md) and [`FUSION.md`](FUSION.md).
> **Top-10 emerging-tech topic bank (for the 3-topic panel proposal):** see
> [`TOPIC-BANK.md`](TOPIC-BANK.md).
> **Every topic we've explored (running index, nothing deleted):** see
> [`RESEARCH-LOG.md`](RESEARCH-LOG.md).
> **All thesis titles in one place:** see [`TITLES.md`](TITLES.md).

---

## 2. Why this is scientifically hard (not just "look at pictures")

Three real problems make this a genuine research contribution, not a homework CNN:

1. **The locations are lies.** The government's coordinates for these projects were
   *deliberately falsified* to hide problems. So you can't just look at the declared
   point — you have to **search the surrounding area** for whether any matching
   structure exists. → a detection-under-*wrong-location* problem.
2. **Almost no labeled examples.** Only ~21 projects are officially confirmed as
   ghosts. You can't train a big AI model on 21 examples. → you need **anomaly
   detection with calibrated confidence** ("this project is 80% likely a ghost,
   give or take"), not naive machine learning.
3. **The structures are small.** Free satellites see the ground at ~5–10 meters per
   pixel. A dike is visible; a thin floodwall may not be. → **small-target detection**,
   and honestly deciding *which* project types are even checkable.

The thesis handles all three and outputs, per project, an **"existence score with
error bars,"** validated against COA's confirmed cases.

---

## 3. The one research question

> Can we verify whether declared public infrastructure physically exists, from free
> multi-sensor satellite data, when (a) the recorded locations are falsified,
> (b) there are almost no labeled examples, and (c) the structures are near the
> limit of what the satellite can see?

---

## 4. How the detector works (the idea in one picture)

For each project we compare **before** vs **after** its construction window, using
two independent satellite signals:

| Signal | What it is | What it tells us |
|--------|-----------|------------------|
| **Optical change** | Planet NICFI (free, 4.77 m) — before/after photos | Did a visible structure *appear*? |
| **Radar disturbance** | Sentinel-1 radar "coherence" (free) | Was the ground *physically disturbed* by construction — even if clouds blocked the photo? |

A real project shows **both** signals. A ghost project shows **neither** — despite
being marked "100% complete." Fusing the two signals into one calibrated score is
the core contribution.

> ⚠️ **The rule we never break:** the output is always *"no detectable structure
> consistent with the declared project"* — **never** the word "fraud." A blank
> satellite could mean a ghost, OR a small legit structure, OR cloud cover. We flag
> for investigation; we do not accuse. This protects you legally and scientifically.

---

## 5. The thing we're de-risking first: **do we have enough labels?**

A detector is only believable if we can *prove* it's accurate. Proving accuracy needs
labeled examples: projects we know for sure are ghosts, and projects we know for sure
are real. The `power/` simulations already worked out how many we need:

| Labeled examples | How trustworthy the accuracy claim is |
|------------------|----------------------------------------|
| 21 (COA's cases only) | Too few — the error bars are too wide to headline |
| **60 total** (30 ghost + 30 real) | 🟢 **Publishable-tight** |
| 80 of each | Strong |

**The good news — and why this thesis is safer than most:** we can *make our own
labels*. COA gives us ~21 confirmed ghosts for free. We add the rest by **eyeballing
projects on free high-resolution imagery** (Google Earth / Esri Wayback) and marking
the obvious ones — "structure clearly there" (real) or "obviously empty" (ghost).
Labeling ~60–160 projects is a weekend of work, not a research program.

Unlike a study where the data amount is fixed, here **we control the bottleneck.**

---

## 6. Which projects can we actually check? (the sieve)

Not every project is checkable from space. `audit.py` filters the government's list
down to the **verifiable set** we run the detector on. Each filter has a plain reason.

| Filter | Keep the project only if… | Why |
|--------|---------------------------|-----|
| **F0** | …it has a declared location (even a wrong one — we use it as a starting point to search around) | Need a place to start looking |
| **F1** | …we know its type, cost, and construction dates | Need the dates to compare before vs after |
| **F2** | …it was built during **2016–2025**, so satellites have before-and-after images | The whole method is before/after comparison |
| **F3** | …it's a **big-footprint type** (dike, dredging, revetment, retarding basin) — not a thin floodwall or culvert | Small structures are invisible at 5–10 m; checking them would give false "ghost" alarms |
| **F4** | …its declared size is **big enough to see** (e.g. ≥100 m long) | Same reason — must exceed the satellite's resolution |
| **F5** | …usable **cloud-free** before/after images actually exist for its area | Can't compare images that don't exist |

Projects that pass = your **application set** (the ones you score, likely hundreds).
Separately, `audit.py` counts your **validation labels** (COA + self-verified) and
tells you if you've hit the 60/80-label targets.

> Projects that *fail* F3/F4 aren't wasted — **"which projects are impossible to
> verify from space" is itself a finding**: it maps the accountability blind spots.

---

## 7. Where the data comes from (all free)

| What we need | Source | Free? | Status |
|--------------|--------|-------|--------|
| **The projects** (location, cost, type, dates) | DPWH "Sumbong sa Pangulo" list; Kaggle & BetterGovPH mirrors | Yes | ✅ exists — locations falsified, so we search near them |
| **Ground truth** (confirmed ghosts) | COA fraud audit reports (~21 Bulacan cases, growing) | Yes | ✅ public |
| **Optical before/after** | Planet NICFI, 4.77 m, monthly 2015–2025 | Yes | 🔑 free, via Google Earth Engine signup |
| **Radar disturbance** | Sentinel-1 (Copernicus) | Yes | 🔑 same free signup |
| **Self-labeling imagery** | Google Earth / Esri Wayback high-res | Yes | ✅ browser, no signup |

---

## 8. How to run the audit

```bash
pip install -r requirements.txt

# put the cleaned government project list here as dpwh_bulacan_clean.geojson
#   (columns: id, lon, lat, cost_php, completion_date, type_raw, length_m)

python audit.py --projects dpwh_bulacan_clean.geojson --labels coa_confirmed.csv
# prints: the verifiable application-set size, your current label count,
#         and a GO / NEED-MORE-LABELS verdict against the 60/80 targets.
```

---

## 9. Mini-glossary

- **Ghost project** — a project reported as built and fully paid for, that was never
  actually built (or built elsewhere).
- **Optical imagery** — normal satellite "photos" (visible light). Blocked by clouds.
- **Radar / SAR coherence** — radar bounces off the ground and works through clouds.
  If the ground was dug up and built on, the radar signal "decorrelates" — a
  fingerprint of construction activity.
- **Change detection** — comparing before and after images to see what appeared.
- **Anomaly detection** — finding the odd ones out when you have very few labeled
  examples (which is our situation).
- **Recall** — of all the real ghosts, what fraction did the detector catch?
- **AUC** — a single 0–1 score for how well the detector separates ghosts from real
  projects (1.0 = perfect, 0.5 = coin flip).
- **Calibrated confidence** — the detector says "80% likely a ghost" and it's right
  ~80% of the time. Honest uncertainty, not a blind yes/no.

---

*Repo: `realminds-ellah/thesis-infra-intel` · thesis project, work in progress.*
