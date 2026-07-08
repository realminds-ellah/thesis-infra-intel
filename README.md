# Bulacan Flood-Control Thesis — Project Audit

*A BS Mathematics (major in Computer Science) thesis on measuring whether
flood-control projects actually reduce flooding.*

---

## 1. What this thesis is about (in plain words)

The government spends **billions of pesos** on flood-control projects in Bulacan —
dikes, floodwalls, drainage, river dredging. Right now, the only question anyone
asks is *"Was the project finished?"*

This thesis asks a harder and more important question:

> **Did the project actually reduce flooding — and by how much?**

That sounds simple, but it is genuinely hard to answer scientifically, for three reasons:

1. **Projects are built where flooding is already worst.** So if we just compare
   "areas with projects" to "areas without," we're really measuring *where the
   government chose to build*, not whether the building *worked*.
2. **Water moves.** A dike upstream doesn't delete water — it can push the flood
   *downstream* onto someone else. So projects affect each other. You can't judge
   one project in isolation.
3. **We can't easily see flooding.** There's no clean record of "how flooded was
   this barangay each year." We have to *reconstruct* flooding from **satellite
   images**.

The thesis builds a method that handles all three problems and produces, for each
project, an honest estimate: *this project reduced flooding by X%, give or take Y%* —
including whether it made flooding **worse downstream**.

---

## 2. The one research question

> How do you measure the true flood-reduction effect of an individual
> infrastructure project, when (a) projects are built in the riskiest places,
> (b) projects affect each other through the river network, and (c) the flooding
> itself can only be seen from satellites?

Everything in this repo exists to answer that one question rigorously.

---

## 3. What's in this repo

| File | What it does |
|------|--------------|
| `README.md` | This file — the plan and how to use everything |
| `audit.py` | A program that takes the list of DPWH projects and finds which ones are **usable** for the study (the "clean" ones). Run this first. |
| `criteria.yaml` | The exact rules/thresholds the audit uses. **Lock this before looking at any results** (explained below). |
| `power/` | Math simulations that answer *"how many projects do we need before the study is trustworthy?"* Answer: about **30**. |
| `requirements.txt` | The Python packages you need to install |

---

## 4. The big risk we're de-risking first: **do we have enough projects?**

A study is only trustworthy if it has enough data. The `power/` simulations already
answered this:

- If we have **~30 usable projects**, we can reliably detect a realistic
  flood reduction (about a 15–20% drop). ✅
- Below **~20 usable projects**, the study is too weak — we'd have to change the plan. ❌

So the whole thesis hinges on **one number**: *how many usable projects are there
in Bulacan?* The audit (`audit.py`) exists to find that number **now**, in month one,
instead of discovering a problem in month six.

The catch: not every project on the government's list is usable. Many will be thrown
out for good scientific reasons. `audit.py` applies a series of filters — think of it
as a **sieve** — and counts what survives.

---

## 5. The sieve: which projects count as "usable"?

Each filter below removes projects that would *break the science* if we kept them.
The middle column is plain English. The right column is the technical reason (useful
for your thesis defense).

| Filter | In plain words: keep the project only if… | Why (the scientific reason) |
|--------|-------------------------------------------|------------------------------|
| **F0** | …we know **where** it is (has a real location) | You can't study flooding at an unknown place |
| **F1** | …we know its **cost, type, and finish date** | We need the finish date to compare "before vs after" |
| **F2** | …it finished during the **years satellites were watching** (2016–2023), with at least a year of images before and after | We compare satellite flooding before and after the project |
| **F3** | …it's **big enough to matter** (costs ≥ ₱5M, or ≥100 m long) | Tiny projects have effects too small for satellites to detect — the power sims proved this. Including them just adds noise. |
| **F4** | …it's an **actual flood-control structure** (dike, drainage, dredging…), not a building repair | Only real water infrastructure can change flooding |
| **F5** | …we can figure out the **area of land it drains** (its catchment) | We need to know *which* land the project protects |
| **F6** ⚠️ | …**no other project** was built nearby at the same time | If two projects overlap, you can't tell which one caused the change. **This is the filter that removes the most projects.** |
| **F7** | …that area **actually floods** in the satellite record | If it never visibly floods, there's nothing to measure |
| **F8** | …there are **people living downstream** of it | Needed to check if the project pushed flooding onto others |

**Projects are then sorted into tiers:**
- **Tier A** — passes everything → can study both the local effect *and* the downstream effect. Best.
- **Tier B** — passes F0–F7 → local effect only.
- **Tier C** — borderline → used only for extra robustness checks, not the main result.
- **Excluded** — fails a basic filter.

---

## 6. What to expect: the list will shrink a LOT

Don't panic when it does — this is normal and *correct*. Planning estimate:

```
Government's raw Bulacan project list     ~800–2000 projects   (100%)
  after "we know where it is"                    ~70%
  after "we know cost/type/date"                 ~60%
  after "satellites were watching"               ~45%
  after "big enough to matter"                   ~30%
  after "it's real flood infrastructure"         ~25%
  after "we can map its catchment"               ~22%
  after "no overlapping projects"  ← biggest cut  8–12%   ← THIS is our usable count
  after "the area actually floods"                7–10%
  after "people live downstream"                  4–7%    ← usable for downstream study
```

**What the final number means for the thesis:**

| Usable projects | Verdict |
|-----------------|---------|
| **30 or more** | 🟢 **Go.** Strong enough to trust. |
| **20–30** | 🟡 **Go, but carefully** — wider error bars, mention it as a limitation. |
| **Under 20** | 🔴 **Stop and change the plan** — e.g. study whole river basins instead of individual projects, or do a deep single-project case study. |

---

## 7. Where the data comes from (all free)

You do **not** need Bulacan to hand you secret files. Everything is public:

| What we need | Source | Free? | Status |
|--------------|--------|-------|--------|
| **The projects** (location, cost, date) | DPWH "Sumbong sa Pangulo" flood-control list; mirrors on Kaggle & BetterGovPH | Yes | ✅ exists — ⚠️ but locations are known to be inaccurate, so each one must be checked |
| **The flooding** (the thing we measure) | Sentinel-1 satellite radar — sees through clouds, works in storms | Yes | 🔑 needs one free Copernicus/Google Earth Engine signup |
| **The rainfall** (to be fair to projects — was it a dry year or a storm?) | CHIRPS satellite rainfall | Yes | ✅ **already tested — downloads and works** |
| **The rivers** (to know which way water flows) | MERIT Hydro / FABDEM elevation maps | Yes | ✅ open |
| **The people** (who's affected) | WorldPop population maps | Yes | ✅ **tested — downloads** |

> ⚠️ **Important honest warning about the project data:** The government's location
> coordinates for these projects have been reported as *deliberately wrong* (to hide
> problem projects). So before trusting any project's location, we must double-check
> it against satellite imagery. This is annoying — but it's also part of the thesis
> story: *the accountability data is so unreliable that satellites are needed just to
> verify where the money went.*

---

## 8. How to actually run the audit

```bash
# 1. install the tools
pip install -r requirements.txt

# 2. put the cleaned government project list here as:
#    dpwh_bulacan_clean.geojson
#    (columns: id, lon, lat, cost_php, completion_date, type_raw, length_m)

# 3. run the sieve
python audit.py --projects dpwh_bulacan_clean.geojson

# it prints the shrinking funnel, the final usable count,
# and a GO / CAUTION / STOP verdict.
```

The satellite-dependent filters (F5, F7, F8) are marked as "TODO / stub" in the code —
those get filled in once the Google Earth Engine account is set up. Filters F0–F6
(including the all-important F6) already work today with no account.

---

## 9. Mini-glossary (so no term is scary)

- **Catchment** — the area of land whose rainwater drains toward one point. A flood
  project protects (or affects) its catchment.
- **Confounder** — something that messes up a comparison. Here: rainfall. A project
  might look great just because it didn't rain much — the study must correct for that.
- **Spillover / downstream effect** — when helping one place harms another, because
  the water just moves. A key thing this thesis measures.
- **Power (statistical)** — how likely your study is to detect a real effect if one
  exists. Low power = you might miss a real result. That's what `power/` checks.
- **Pre-register** — write down your rules (`criteria.yaml`) *before* seeing results,
  so no one can accuse you of tweaking the rules to get the answer you wanted.
- **Sentinel-1 / SAR** — a radar satellite. Because it's radar, not a camera, it sees
  the ground even through thick storm clouds — perfect for mapping floods during typhoons.

---

*Repo: `realminds-ellah/thesis-infra-intel` · thesis project, work in progress.*
