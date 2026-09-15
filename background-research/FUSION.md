# The Fusion Upgrade — procurement red-flags × satellite delivery

*The strongest version of this thesis. Keeps the satellite verifier as the spine and
adds the money trail as a second, independent sensor.*

---

## The idea in one line

> For every flood-control project, compute **two independent suspicion signals** — one
> from the procurement record (was the *money* handled suspiciously?) and one from
> satellites (was the *structure* actually built?) — and fuse them into a single
> **audit-priority score** that tells oversight which projects to investigate first.

---

## Why this is the strongest version

- **It fills the exact gap no dataset alone can.** Procurement data stops at the award
  and never sees delivery; satellites see delivery but not the money. Fusing them
  closes the "declared-vs-actual" loop — the core question of the whole scandal.
- **The fusion is the novel part.** Procurement network analysis is established;
  satellite change detection is established. **Joining the two has not been done.**
  That join is your contribution, and it's the part reviewers reward.
- **It's a strict upgrade, not a restart.** The satellite half is the pipeline this
  repo already specs. You're bolting a second signal onto work you've already scoped.

---

## The two signals

### Signal A — procurement red-flags (from PhilGEPS + DPWH)
Per-project / per-contractor indicators, each a known corruption red-flag:
- single-bidder award / very few bidders
- contractor award concentration (share of district budget)
- price-per-meter or cost-per-unit outlier vs peers
- repeat awards to the same contractor by the same district office
- award value bunching just under approval thresholds
- speed anomalies (implausibly short bid-to-award or construction windows)

→ combine into an interpretable **red-flag score** (template: Westerski et al.'s
48-indicator interpretable severity score, validated on ~216k transactions —
[Wiley 2021](https://www.researchgate.net/publication/350174051_Explainable_anomaly_detection_for_procurement_fraud_identification_-lessons_from_practical_deployments)).

### Signal B — satellite delivery (the existing pipeline)
Per-project **existence score**: optical change (NICFI) + SAR coherence (Sentinel-1)
before/after the construction window. *This is what `audit.py` + the detector already build.*

### The fusion
The interesting projects are **high on both**: financially suspicious AND no structure
on satellite. Options, simplest first:
- **Rank fusion** — rank by A, rank by B, combine (e.g. max/mean of ranks). No training, robust to small N.
- **Calibrated logistic** — if labels allow, fit `P(ghost) = f(A, B)` on COA-confirmed cases (held-out validation).
- **2×2 quadrant triage** — the operational output COA wants: "suspicious money + no structure" = investigate now.

---

## The make-or-break: joining the two datasets ✅ feasible

Both sides carry the keys, so the join is buildable (confirmed):

| Join strategy | Key | Reliability |
|---------------|-----|-------------|
| **Primary** | `contractId` (DPWH transparency data) ↔ PhilGEPS award contract reference | High where present |
| **Fallback** | `contractor` name ↔ PhilGEPS merchant name (fuzzy / entity resolution) | Medium — needs name cleaning |
| **Corroboration** | location + value + date triangulation | Confirms ambiguous matches |

The DPWH transparency dataset exposes `contractId, contractor, budget, amountPaid,
progress, location, startDate, completionDate, sourceOfFunds`
([Hugging Face](https://huggingface.co/datasets/bettergovph/dpwh-transparency-data),
[BetterGov sources](https://visualizations.bettergov.ph/sources)); PhilGEPS provides
contract awards + contractor registration (2000–2025).

> ⚠️ **The one real sub-project risk:** contractor-name **entity resolution**
> ("Wawao Builders" vs "Wawao Builders Inc." vs "Wawao Construction"). Budget a
> couple of weeks for name normalization + fuzzy matching. This is tractable, but
> don't underestimate it — it's the piece most likely to eat time.

---

## Datasets

| Need | Source | Free? |
|------|--------|-------|
| Projects (id, contractor, value, progress, location, dates) | DPWH transparency portal / BetterGov / Sumbong sa Pangulo | ✅ |
| Procurement awards + bidders + merchant registry | PhilGEPS bulk data (2000–2025) | ✅ (award stage only — no execution) |
| Satellite delivery signal | Sentinel-1/2, Planet NICFI | ✅ (one GEE signup) |
| Ground-truth labels | COA fraud audit reports (~confirmed ghosts) | ✅ (small N → validation set) |

---

## Feasibility & risk

- **Award-stage-only PhilGEPS** — you can't see contract execution. *That's fine:*
  Signal B (satellite) is precisely what supplies the execution/delivery view. The two
  are complementary by design.
- **Small labels** — same as before: use COA cases as a held-out validation set, keep
  the model simple (rank fusion / calibrated logistic), report confidence intervals.
- **Entity resolution** — the main time sink (see warning above).
- **Scope guard unchanged** — output is *"suspicious money + no detectable structure →
  recommend inspection,"* never "fraud."

---

## Validation

Same discipline as the satellite-only thesis: the fusion score must **rank COA's
confirmed ghost projects near the top** before it's trusted. "Our audit-priority score
placed 18 of 21 COA-confirmed ghosts in the top decile" is the headline result.

---

## Next concrete step

Build the **join prototype**: pull the DPWH transparency table + a PhilGEPS award slice
for Bulacan, attempt the `contractId` join, measure the match rate, and fall back to
contractor-name resolution for the rest. The match rate tells us immediately whether
the fusion is a clean thesis or an entity-resolution slog — the same "find out in
month one" discipline we used for N and power.

*See [`IDEAS.md`](IDEAS.md) for how this ranks against the alternatives, and
[`README.md`](README.md) for the satellite half.*
