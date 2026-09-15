# Thesis Topic Bank — Top 10 (emerging-tech)

*Ranked candidate topics to pair with the locked satellite ghost-project verifier
(Topic 1). Output of a fact-checked deep-research pass (22 claims confirmed, 0 refuted).
Every topic's novelty comes from an emerging method applied to a real, urgent Philippine
problem on free/open data, solo-feasible in ~1 year.*

**Honest scope note:** the verified evidence concentrated in **governance** and
**urban/climate**, because that's where the emerging methods have proven precedents AND
the PH has open data. Health/education/agriculture topics below are **constructed by
analogy** (no verified precedent) — flagged accordingly. Confidence:
🟢 verified precedent · 🟡 method-verified, PH application untested · 🟠 constructed/unproven.

---

## Ranked table

| # | Topic | Domain | Emerging method | Compute | SDG | Conf |
|---|-------|--------|-----------------|---------|-----|------|
| 1 | LLM audit-document intelligence (COA/GAA/PhilGEPS PDFs) | Governance | LLM / RAG / knowledge graph | 🟢 Colab | 16.5, 16.6 | 🟢 |
| 2 | GNN procurement-collusion detection (PhilGEPS graph) | Governance | Graph neural nets | 🟢 Colab | 16.5, 12.7 | 🟢 |
| 3 | Label-efficient informal-settlement mapping | Urban/climate | Geospatial foundation model | 🟡 GFM flag | 11.1 | 🟢 |
| 4 | Urban-heat / land-surface-temperature mapping | Climate/health | Foundation-model fusion | 🟡 GFM flag | 11, 13, 3 | 🟡 |
| 5 | Agentic LLM triage of Sumbong sa Pangulo complaints+photos | Civic/governance | Agentic LLM + multimodal | 🟢 Colab | 16.7 | 🟡 |
| 6 | Causal ML for public-spending effectiveness | Governance/econ | Double ML / causal forests | 🟢 Colab | 16.6, 10 | 🟡 |
| 7 | VLM citizen-photo verification of declared works | Governance | Vision-language model | 🟡 | 16.6 | 🟡 |
| 8 | Few-shot cropland / farmland-loss monitoring | Agriculture | Geospatial foundation model | 🟡 GFM flag | 2.4, 2.3 | 🟠 |
| 9 | LLM intelligence over DepEd / education-spending records | Education | LLM / document AI | 🟢 Colab | 4.1 | 🟠 |
| 10 | Few-shot deforestation / illegal-mining change detection | Environment | Geospatial foundation model | 🟡 GFM flag | 15.1, 15.2 | 🟠 |

---

## The three strong ones (🟢)

### #1 — LLM audit-document intelligence
- **Problem:** auto-extract corruption red-flags from the thousands of pages of COA
  audit reports / budget PDFs no human reads end-to-end.
- **Method:** OCR → RAG → LLM information-extraction → red-flag knowledge graph.
- **Data:** COA Annual Audit Reports, GAA/DBM budget docs, PhilGEPS records (all public PDFs).
- **Novelty:** Brazil built exactly this into its **national audit court** (INACIA:
  OCR + RAG + agent reasoning — [arXiv 2401.05273](https://arxiv.org/pdf/2401.05273)),
  and a PH paper already codified **42 procurement weaknesses in 6 categories** from COA
  reports 2012–2022 ([ResearchGate 391046088](https://www.researchgate.net/publication/391046088))
  — a ready red-flag ontology. **Nobody has built this on PH documents.**
- **Kill-risk:** scanned-PDF parsing is fiddly (manageable); INACIA is a prototype, and
  the 42-weakness study is descriptive — you must build the *detector*.
- **Compute:** Colab / hosted-LLM inference. No finetuning.
- **Who uses it:** COA, Ombudsman, journalists, oversight NGOs.
- **SDG:** 16.5 (reduce corruption), 16.6 (accountable institutions).

### #2 — GNN procurement-collusion detection
- **Problem:** find bid-rigging cartels in PhilGEPS tenders.
- **Method:** graph neural nets (GAT / R-GCN) on the tender–bidder graph; collusion as
  node classification so message-passing surfaces distributed cartels invisible to
  per-tender tabular analysis.
- **Data:** open.philgeps.gov.ph (bids/awards/merchants); PCC 4-form bid-rigging taxonomy
  ([phcc.gov.ph](https://www.phcc.gov.ph/enforcement/bid-rigging-what-it-is-and-how-to-detect)) for labels.
- **Novelty:** GAT hits **91% accuracy** on tender–bidder graphs
  ([arXiv 2507.12369](https://arxiv.org/pdf/2507.12369)); a CNN version works on just **a
  few hundred labeled graphs** ([arXiv 2104.11142](https://arxiv.org/abs/2104.11142)) —
  label-efficient. The 2025 field review says these methods are *"rarely run on live
  systems"* and *"public datasets are scarce"*
  ([EPJ Data Science](https://link.springer.com/article/10.1140/epjds/s13688-025-00569-3)).
  **Never applied to PhilGEPS.**
- **Kill-risk (verify first):** collusion labels are scarce; and PhilGEPS may publish only
  winning bids, not the full per-tender bid distribution the method needs.
- **Compute:** light.
- **SDG:** 16.5, 12.7 (transparent public procurement).

### #3 — Label-efficient informal-settlement mapping
- **Problem:** track slum growth and disaster exposure where no reliable up-to-date map exists.
- **Method:** geospatial foundation model, few-shot / self-supervised (frozen backbone).
- **Data:** Sentinel-2 / Planet NICFI, WorldPop, OSM.
- **Novelty:** label-efficient slum mapping (SLUM-i) matches full supervision at a **30%
  label budget** ([arXiv 2602.04525](https://arxiv.org/pdf/2602.04525)) — validated on
  Pakistani/Indian/African cities, **never the Philippines**. Clean gap; **outside
  anti-corruption**.
- **Kill-risk (honest):** foundation models **don't always beat a plain UNet**
  ([PANGAEA benchmark](https://arxiv.org/pdf/2412.04204)) — you MUST frame it as a
  *label-scarcity* problem, where the GFM edge is real, or the method choice is indefensible.
- **Compute:** fine with the model **frozen**; full finetuning may exceed a student GPU
  budget (the bank's main compute flag).
- **SDG:** 11.1 (adequate housing, upgrade slums).

---

## Topics 4–10 (brief)

- **#4 Urban-heat mapping** — foundation-model land-surface-temperature for PH cities; heat
  is deadly and understudied ([Frontiers 2026.1770260](https://www.frontiersin.org/journals/environmental-science/articles/10.3389/fenvs.2026.1770260/full)). SDG 11/13/3. GFM compute flag.
- **#5 Agentic complaint triage** — LLM agents geolocate, deduplicate, cluster the 12,000+
  Sumbong sa Pangulo complaints + photos and cross-reference them to the project database.
  Civic-tech novelty; Colab-runnable. SDG 16.7.
- **#6 Causal ML for spending effectiveness** — double/debiased ML or causal forests to
  estimate heterogeneous effects of budget allocations on outcomes. Distinct method. SDG 16.6/10.
- **#7 VLM citizen-photo verification** — vision-language fusion of citizen photos + geotags
  + project text. Overlaps Topic 1's accountability/imagery, so lower priority. SDG 16.6.
- **#8 Few-shot cropland monitoring** 🟠 — foundation-model crop/farmland-loss mapping for
  rice self-sufficiency. Agriculture spread; no verified precedent. SDG 2.4/2.3.
- **#9 LLM education-records intelligence** 🟠 — document AI over DepEd / education-spending
  records. Education spread; unproven. SDG 4.1.
- **#10 Few-shot deforestation / illegal-mining detection** 🟠 — GFM change detection on
  DENR/forestry targets. Environment spread. SDG 15.1/15.2.

---

## Recommended pairing (with the locked satellite topic)

**Propose Topic 1 (satellite) + #1 (LLM audit intelligence) + #3 (informal-settlement GFM).**

| | Topic 1 (locked) | Topic 2 = #1 | Topic 3 = #3 |
|---|---|---|---|
| Domain | Infra accountability | Governance / text | Urban-climate |
| Method | Satellite CV | LLM / RAG | Foundation-model vision |
| Data | SAR imagery | Government PDFs | Optical imagery |
| Adviser | Remote sensing | NLP / data science | GeoAI |
| SDG | 16.5 / 9.1 | 16.6 | 11.1 |

Three domains, three methods, three datasets, three advisers, and #3 sits **outside
anti-corruption** — maximum panel range, all Colab-affordable if the GFM stays frozen.

**Swap option:** replace #1 with **#2 (GNN collusion)** for maximum method novelty — but
then two of three topics are governance, narrowing range. Choose *range* (#1) or
*method dazzle* (#2).

---

## Before you write these up — verify two data hinges (month-one discipline)

1. **Does PhilGEPS expose ALL bids per tender, or only winners?** Decides #2 (and the
   fusion idea in `FUSION.md`).
2. **Are COA audit reports bulk-downloadable as parseable PDFs?** Decides #1.

Both are cheap to check and either result redirects a topic before you invest in it.

---

*See [`IDEAS.md`](IDEAS.md) for the first idea pass, [`FUSION.md`](FUSION.md) for the
satellite-topic upgrade, and [`README.md`](README.md) for Topic 1's method.*
