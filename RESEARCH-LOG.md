# Research Log — every topic explored

*A running index of every thesis direction we've researched, so nothing is lost.
Purely a tracking doc — nothing here is deleted. Status legend:*

🔒 **LOCKED** (in the proposal) · 🛡️ **FALLBACK** · ⭐ **strong candidate** ·
💡 **explored / on the table** · ❌ **set aside** (rejected by me or by the research)

**The mission that ties it together:** *government accountability for the ordinary
taxpayer — expose waste and wrongdoing, protect the citizen.*

---

## The current proposal slate — "The Taxpayer's Watchdog"

| Slot | Topic | Taxpayer's question | Method | Status | File |
|------|-------|--------------------|--------|--------|------|
| 1 | **Satellite ghost-project detector** | *Did they build what I paid for?* | Remote sensing / CV | 🔒 | README, SIGNIFICANCE, FUSION |
| 2 | **COA Watchdog** (LLM audit-doc intelligence) | *What's hidden in reports nobody reads?* | LLM / RAG / knowledge graph | 🔒 | TOPIC-BANK #1 |
| 3 | **GNN cartel exposer** (procurement collusion) | *Who rigged the bidding?* | Graph neural networks | ⭐ chosen | TOPIC-BANK #2 |
| 3-alt | **Spending Efficiency Scorecard** | *Which LGUs waste my money?* | Data Envelopment Analysis | ⭐ strong alt | (PSA #1) |
| Fallback A | **Overpricing Detector** | *Am I being overcharged?* | Price outlier detection | 🛡️ data ✅ | — |
| Fallback B | **Budget Insertion Tracker** | *What got slipped into the budget?* | Anomaly detection on GAA | 🛡️ data ✅ | — |

---

## A. Flood-control / infrastructure accountability

- ⭐🔒 **Satellite ghost-project verifier** — detect declared-but-unbuilt flood-control projects vs COA fraud audits. *(the anchor)*
- ❌ **Causal attribution of flood-control effectiveness** — directed-network interference DiD on SAR flood extent. *(original idea; pivoted away — felt un-exciting)*
- 💡 **Fusion upgrade** — satellite delivery signal × procurement red-flags → audit-priority score. *(FUSION.md; strongest upgrade of Topic 1)*

## B. Governance / procurement / public money

- 🔒 **LLM audit-document intelligence** — red-flag extraction from COA/GAA/PhilGEPS PDFs (Brazil INACIA blueprint).
- ⭐ **GNN procurement-collusion detection** — bid-rigging cartels on PhilGEPS tender–bidder graph.
- 🛡️ **Procurement overpricing detector** — unit-price outliers across contracts. *(fallback; data confirmed)*
- 🛡️ **Budget insertion tracker** — year-over-year anomalies/insertions in GAA. *(fallback; data confirmed)*
- 💡 **Corruption Risk Index + political dynasties** — rebuild the index for the flood era (Davis-Mendoza-Yap framework).
- 💡 **Pork-barrel "allocables" allocation-vs-need** — spatial mismatch of infra money vs population.
- 💡 **SALN "lifestyle liars"** — declared wealth vs visible wealth. *(high data-access risk)*
- 💡 **Agentic LLM triage of Sumbong sa Pangulo complaints** — geolocate/dedupe/cross-reference 12k+ citizen complaints.
- 💡 **VLM citizen-photo verification** of declared works.
- 💡 **Causal ML for public-spending effectiveness** (double ML / causal forests).

## C. PSA OpenStat — accountability & social good (the "Top 10")

1. ⭐ **Public Spending Efficiency Scorecard** — DEA: which LGUs convert budget→outcomes best. *(SDG 16.6)*
2. 💡 **Promise-vs-Delivery SDG Tracker** — trajectory to 2030, off-track alerts. *(SDG 17)*
3. 💡 **Regional Inequality / Convergence Monitor** — are regions converging? *(SDG 10)*
4. 💡 **Real Cost-of-Living Tracker** — regional real purchasing power. *(SDG 8,10)*
5. 💡 **Decent Work Monitor** — is the work actually decent, beyond the unemployment rate? *(SDG 8)*
6. ⭐ **Food-Affordability Early-Warning ("GutomWatch")** — affordability index + change-point early warning. *Data verified (3L/2M/1E). (SDG 2)*
7. 💡 **Health-Access Equity Map** — health service deserts. *(SDG 3)*
8. 💡 **Learning Outcome Gap** — is education budget producing learning? *(SDG 4)*
9. 💡 **Disaster Recovery Effectiveness** — does recovery spending help people recover? *(SDG 1.5,11.5)*
10. 💡 **Digital-Divide Monitor** — is "Digital PH" closing or widening the gap? *(SDG 9,10)*

*Earlier PSA batch also explored:* inflation inequality (the poor's basket), food-price
shock propagation network, energy-poverty index, school-to-work / youth-NEET survival
analysis, regional economic resilience after shocks.

*Set aside:* ❌ **Small-Area Estimation of poverty** (Barangay Vulnerability Targeting
Engine) — strong and math-rich, but rejected.

## D. Disaster & climate

- 💡 **Parametric disaster insurance** — extreme-value theory + copulas + satellite triggers; basis-risk minimization. *(finance × disaster; strong math)*
- ❌ **Evacuation-center siting optimization** — rejected (strong 2024–25 baselines / done before).
- ❌ **Climate-driven dengue early-warning** — rejected (crowded baseline / done before).
- ❌ **SAR post-typhoon damage mapping** — set aside (shares Topic 1's satellite ecosystem).
- 💡 Agent-based evacuation micro-simulation (GAMA/OSM) — noted as a lower-baseline entry point.

## E. Finance

- 💡 **Parametric climate insurance** *(see Disaster — the standout finance idea)*.
- 💡 **Financial inclusion / "banking deserts"** — access-point mapping + facility-location optimization.
- 💡 **LGU fiscal-distress prediction** — BLGF financial-health scorecard.
- 💡 **Remittance dependency & shock resilience** — gravity + resilience metrics.
- 💡 **Digital-payment / e-money adoption inequality** — causal ML.

## F. Emerging-tech topic bank (fully ranked, TOPIC-BANK.md)

LLM audit intelligence · GNN collusion · label-efficient informal-settlement GFM ·
urban-heat GFM · agentic complaint triage · causal-ML spending · VLM photo verification ·
few-shot cropland monitoring · LLM education records · few-shot deforestation/mining.

---

## G. Heat, climate exposure & environment

**Heat index** — *note: PSA has no gridded temperature; heat exposure comes from
satellite/climate data (CHIRTS ✅ free, MODIS LST via GEE, ERA5), fused with PSA/DepEd
for outcomes. Accountability framing: is the government's heat response equitable and
reaching the vulnerable?*

- ⭐ **Heat Vulnerability Index** — *"Mapping Who Bears the Heat"* — exposure × sensitivity
  × adaptive capacity, downscaled below PAGASA station level. Composite index + geospatial. *(SDG 3,11,13)*
- ⭐ **Heat → human harm (causal)** — *"Counting the Cost of Heat"* — distributed-lag causal
  analysis on mortality / hospitalization / learning / labor. Strongest math + accountability. *(SDG 3,8,4)*
- 💡 **School heat & learning loss** — *"Too Hot to Learn"* — heat-driven lost school days
  and their inequities (no-AC schools). *(SDG 4,13)*
- 💡 **Urban Heat Island + greening optimization** — *"Cooling the City Where It Counts"* —
  UHI mapping + optimal cooling/greening allocation per peso. *(SDG 11,13)*

**Environment / natural-resource accountability**

- 💡 **Illegal-extraction detector** — *"Detected but Undeclared"* — few-shot satellite change
  detection of forest clearing / mining scars, cross-checked vs DENR permits → flag
  *unpermitted* extraction ("detected destruction, no authorization"). GFM (frozen → Colab).
  Villain: theft of the public's natural resources. *(SDG 15.1, 15.2)* — ⚠️ shares Topic 1's
  satellite ecosystem, so best standalone rather than paired with the satellite thesis.
- 💡 **Few-shot cropland / farmland-loss monitoring** *(see Topic Bank #8; SDG 2)*.

## Datasets verified LIVE this session

| Dataset | For | Status |
|---------|-----|--------|
| CHIRPS rainfall | flood confounder | ✅ downloaded real Bulacan values |
| CHIRTS-daily (temp + humidity + heat index) | heat-index studies | ✅ live on UCSB server (same as CHIRPS) |
| MODIS LST / ERA5 | heat exposure | 🔑 free via GEE / Copernicus account |
| Hansen Global Forest Change · DENR permits | illegal-extraction detector | 💡 to verify |
| WorldPop PHL | exposure | ✅ 188 MB downloadable |
| Planet NICFI (4.77 m) | satellite optical | ✅ exists, free via GEE signup |
| Sentinel-1 SAR | flood/infra outcome | 🔑 needs free Copernicus/GEE account |
| PSA OpenStat PxWeb API | all PSA topics | ✅ 26 databases, live JSON API |
| Food Security 3L / Prices 2M / Income 1E | GutomWatch (#6) | ✅ tables confirmed |
| BetterGov `gaa` (Hugging Face) | budget tracker | ✅ line-item parquet |
| BetterGov `dpwh-transparency-data` | overpricing/ghost | ✅ pulled real contract row |
| BetterGov `philgeps-data`, `bir-tax-collection`, `open-customs-data`, `senate-bills`, `project-noah-hazard-maps`, `raw-philippine-data` | future accountability studies | ✅ exist on HF |
| DPWH / Sumbong sa Pangulo project list | treatment (Topic 1) | ✅ public — ⚠️ falsified coordinates |
| COA fraud audit reports | ground-truth labels | ✅ public (small N) |

## Deep-research passes run

1. Governance/flood — best thesis problems (25/25 claims confirmed).
2. Disaster + governance — companion topics (evacuation, dengue, pork, collusion).
3. Emerging-tech Top 10 — LLM/GNN/GFM topic bank (22/22 claims confirmed).

## Repo file map

`README` · `SIGNIFICANCE` (Topic 1) · `FUSION` (Topic 1 upgrade) · `IDEAS` (first pass) ·
`TOPIC-BANK` (emerging-tech top 10) · `RESEARCH-LOG` (this file) · `criteria.yaml` ·
`audit.py` · `power/` (de-risking) · **`FINDINGS`** (what the built system measured) ·
`DEMO-SCRIPT` (5-minute walkthrough) · **`AI-LAYER`** (AI architecture and its limits) · `masid/` (the app) · `masid/SOURCES` (every dataset and its limits).

---

## Findings from the built system

Recorded in **`FINDINGS.md`**, measured rather than asserted. The one that most
changes the thesis argument:

**83% of flood-control contracts publish no dimension of any kind.** 1,069 of
1,293 state no length, area or volume — only 186 of them contain a digit at all,
and six length formats plus the detail export's `components` array were tested
before concluding it. You cannot tell from the public record whether a ₱96
million contract built fifty metres or two kilometres.

This is upstream of every other limitation in the project: no dimension means no
quantity to check imagery against, no unit-cost comparison, and no way to tell a
repair from a major work at the same price. Together with the 102 contracts that
publish no coordinate, most of this register cannot be checked against the ground
even in principle — which is a direct answer to *why* delivery monitoring needs
the DPWH and PhilSA data requests rather than a cleverer method.
