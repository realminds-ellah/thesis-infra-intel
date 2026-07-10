# Thesis Idea Bank — ranked

*Output of a fact-checked deep-research pass (15 sources, 60 claims extracted,
25 verified, 25 confirmed, 0 refuted). Ranked by impact × feasibility × novelty
for a solo BS Math/CS thesis on free public data, at the disaster-resilience ×
governance intersection.*

---

## The strategic insight that frames everything

> **Philippine procurement data (PhilGEPS) stops at the contract award. It never
> records whether the project was actually delivered.**
> ([Web Foundation OCDS note](https://labs.webfoundation.org/wp-content/uploads/2015/09/OCDS-Philippines-Research-Note.pdf))

Anyone can analyze *who won* the contracts. Almost no one can check whether the
concrete exists. That "declared-vs-actual" gap is the whole thesis space — and free
satellites are the only open way to fill it. Every idea below is stronger the closer
it sits to that gap.

---

## Ranked table

| # | Idea | Impact | Feasibility | Novelty | Verdict |
|---|------|--------|-------------|---------|---------|
| 1 | Satellite ghost-project verifier | High | High | High | **Your current thesis — validated as #1** |
| 4 | **Fusion: procurement red-flags × satellite** | **Highest** | Med-High | **Highest** | **The upgrade to aim for** (see `FUSION.md`) |
| 2 | Procurement collusion network | High | High | Medium | Strong, but method is established |
| 5 | Citizen-complaint NLP | Medium | High | Med-High | Sleeper; untouched corpus |
| 3 | Corruption Risk Index + dynasties | Medium | Medium | Low | Replication on new data |

---

## The ideas

### 🥇 #1 — Satellite "declared-vs-actual" ghost verifier *(current thesis)*
- **Problem:** detect which "100% complete" flood-control projects physically don't exist, from free satellites.
- **Contribution:** multi-sensor change detection (optical + SAR coherence) turning COA's manual per-project check into a scalable screening pipeline.
- **Data:** Sentinel-1/2, Planet NICFI (free); DPWH/Sumbong project list; COA fraud reports as labels.
- **Novelty:** COA *proved the method works* — "technical inspections, historical satellite imagery, and fraud audit procedures" ([GMA](https://www.gmanetwork.com/news/topstories/nation/967908/coa-fraud-audit-reports-filed-bulacan-flood-control-projects-p297m/story/), [Inquirer](https://newsinfo.inquirer.net/2148019/coa-flags-p297m-bulacan-flood-works-as-ghost-relocated-projects)) — but **no open, reproducible, scalable pipeline exists.**
- **What kills it:** small labeled N; resolution (10 m Sentinel / 4.7 m NICFI) vs narrow dikes. *Both pressure-tested — survivable.*
- **Who uses it:** COA, Ombudsman, DPWH, journalists, funders.

### 💡 #4 — Fusion: procurement red-flags × satellite delivery *(the strongest version)*
- **Problem:** rank projects that are BOTH financially suspicious AND show no structure on satellite → an audit-priority score.
- **Contribution:** the *fusion itself* — joining the money trail to the satellite record. Nobody has done it.
- **Why highest:** fills the exact blind spot no dataset alone can; it's #1 with a second sensor. **Full spec in [`FUSION.md`](FUSION.md).**

### 🥈 #2 — Procurement collusion / anomaly network (PhilGEPS + DPWH)
- **Problem:** find bid-rigging and contractor cartels in the flood-control awards.
- **Contribution:** bipartite contractor–project graph; centrality, community detection, single-bidder & co-bidding cartel signals.
- **The hook:** **15 of 2,409 contractors captured ~₱100 B** (~20% of the flood budget) ([BusinessWorld](https://www.bworldonline.com/top-stories/2025/11/17/712461/philippines-now-turns-to-technology-after-flood-control-projects-vanish/)). PIDS names bid-rigging red-flag detection as *unmet* PH research ([PIDS](https://www.pids.gov.ph/publication/discussion-papers/the-evolution-of-reforms-and-the-state-of-competition-in-public-procurement-in-the-philippines)).
- **What caps it:** network fraud detection is *established* ([Springer 2024](https://link.springer.com/chapter/10.1007/978-981-97-2977-7_23)); novelty must come from a new metric or the scandal framing. PhilGEPS can't see delivery.

### 💡 #5 — Citizen-complaint NLP (sleeper)
- **Problem:** mine the 12,000+ Sumbong sa Pangulo citizen complaints — geolocate, triage, and cross-reference against the project database (do complaints cluster on the ghost projects?).
- **Novelty:** untouched text corpus; disaster-adjacent. Lighter, but nobody's done it.

### 🥉 #3 — Corruption Risk Index for the flood era + dynasties
- **Problem:** which provinces show the strongest corruption-risk signal, and is it driven by political dynasties?
- **Basis:** [Davis, Mendoza & Yap (Economics of Governance, 2024)](https://link.springer.com/article/10.1007/s10101-023-00306-4) built exactly this index and linked it to dynasty concentration. You'd rebuild on 2022–2025 flood contracts.
- **What caps it:** it's a *replication on new data* — least novel; dynasty data needs manual assembly.

---

## Honest note on the disaster-resilience side

The disaster-*pure* ideas are weaker. "Another flood/disease prediction model" is
saturated. The uniquely-Philippine, un-mined, high-urgency open data all sits on the
**governance** side — the scandal, COA audits, PhilGEPS, the 9,855-project database
(₱545.6 B, July 2022–May 2025). Disaster resilience enters most powerfully *through*
the flood-control accountability lens — exactly where this repo already is.

---

## The N reality check (constrains all of them)

Officially fraud-labeled ground truth is small — ~421 tagged "ghost" nationally,
batches of ~4 in COA reports, ~14 fully forensically confirmed at one stage. This
**kills any large-N supervised-ML ambition** and pushes every idea toward **anomaly
detection / weak supervision / COA-as-held-out-validation** — the design this repo
already uses. Cite scandal figures as *dated snapshots*, not fixed facts (counts and
peso totals shift with each COA batch).

---

## Recommendation

Don't abandon #1 — **upgrade it to #4.** Keep the satellite verifier as the spine, add
procurement red-flags as a second signal, output an audit-priority score. It absorbs
the best of #2, fills the gap the research says is the real contribution, and the
fusion is the novel part reviewers reward. See [`FUSION.md`](FUSION.md).

---

*Sources: [BusinessWorld](https://www.bworldonline.com/top-stories/2025/11/17/712461/philippines-now-turns-to-technology-after-flood-control-projects-vanish/) ·
[GMA](https://www.gmanetwork.com/news/topstories/nation/967908/coa-fraud-audit-reports-filed-bulacan-flood-control-projects-p297m/story/) ·
[Inquirer](https://newsinfo.inquirer.net/2148019/coa-flags-p297m-bulacan-flood-works-as-ghost-relocated-projects) ·
[PIDS](https://www.pids.gov.ph/publication/discussion-papers/the-evolution-of-reforms-and-the-state-of-competition-in-public-procurement-in-the-philippines) ·
[Springer network 2024](https://link.springer.com/chapter/10.1007/978-981-97-2977-7_23) ·
[Economics of Governance 2024](https://link.springer.com/article/10.1007/s10101-023-00306-4) ·
[Web Foundation OCDS](https://labs.webfoundation.org/wp-content/uploads/2015/09/OCDS-Philippines-Research-Note.pdf) ·
[Westerski et al. 2021](https://www.researchgate.net/publication/350174051_Explainable_anomaly_detection_for_procurement_fraud_identification_-lessons_from_practical_deployments)*
