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
`DEMO-SCRIPT` (5-minute walkthrough) · related work is at the end of this file · **`AI-LAYER`** (AI architecture and its limits) · `masid/` (the app) · `masid/SOURCES` (every dataset and its limits).

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

---

## Related work — who else is doing this, and what is left over

Searched August 2026. Ordered by closeness to what MASID actually does.
**The short version: everyone here does one of the three tiers. Nobody found
does all three over the same contracts, and nobody publishes a tier that
failed.**

### 1. Same data, same country — the one to distinguish ourselves from

- **BetterGov.ph — Flood Control Projects**
  <https://bettergov.ph/flood-control-projects> ·
  [map](https://bettergov.ph/flood-control-projects/map) ·
  [table](https://bettergov.ph/flood-control-projects/table) ·
  [contractors](https://bettergov.ph/flood-control-projects/contractors)
  12,870+ projects, ₱740B+ nationwide. **We take our data from them**, so the
  distinction has to be stated plainly and early: *they publish a REGISTER, we
  publish an AUDIT LAYER.* They show what DPWH says; we check where what DPWH
  says contradicts itself, and we add three things they do not have — coordinate
  integrity against boundary geometry, bidding red flags against a national
  baseline, and imagery.
- BetterGovPH Research <https://research.bettergov.ph/>
- Visualisations and their source list
  <https://visualizations.bettergov.ph/> · <https://visualizations.bettergov.ph/sources>
- GitHub org <https://github.com/bettergovph> · OpenBayan
  <https://www.openbayan.org/projects/bettergov>

### 2. Procurement red flags — the closest thing to a standard for our bidding tier

- **Cardinal (Open Contracting Partnership)** — open-source library computing
  corruption and collusion indicators over OCDS data; deployed in Ecuador and
  the Dominican Republic.
  <https://www.open-contracting.org/2024/06/12/cardinal-an-open-source-library-to-calculate-public-procurement-red-flags/>
- **Red Flags in Public Procurement** — 73 indicators with formulas, mapped to
  OCDS.
  <https://www.open-contracting.org/resources/red-flags-in-public-procurement-a-guide-to-using-data-to-detect-and-mitigate-risks/> ·
  [PDF](https://www.open-contracting.org/wp-content/uploads/2024/12/OCP2024-RedFlagProcurement-1.pdf)
- Development Gateway on detecting corruption risk through open contracting
  <https://developmentgateway.org/blog/detecting-corruption-risk-through-open-contracting/>

  **Read before the defence.** A panel may reasonably ask why we hand-rolled six
  checks instead of adopting an existing 73-indicator standard. The answer needs
  to be a fact about the data — whether PhilGEPS is published in OCDS at all —
  not a preference.

### 3. Imagery for verifying delivery — our satellite tier

- World Bank IEG, *Leveraging Imagery Data in Evaluations*
  <https://ieg.worldbankgroup.org/sites/default/files/Data/Evaluation/files/Methods_paper-Leveraging_Imagery_Data.pdf>
- World Bank, *Remote Sensing: A Guide to Practitioners*
  <https://documents1.worldbank.org/curated/en/099255007072211554/pdf/P1704410d9fa370fd0b689008a8c0ee03d8.pdf>
- abyrint, satellite imagery for project oversight
  <https://abyrint.com/perspectives/satellite-imagery-remote-sensing-project-oversight/>
- Commercial construction monitoring: UP42
  <https://up42.com/blog/satellite-imagery-helps-with-construction-monitoring> ·
  LiveEO <https://www.live-eo.com/> · SkyWatch
  <https://skywatch.com/satellite-imagery-for-infrastructure-monitoring/>

  These vendors sell exactly the capability our satellite tier attempted, at
  30 cm. **None of them publishes a null result.** That is worth saying out
  loud: the measured finding that a 10 m tier does not discriminate is a
  contribution precisely because the commercial literature has no incentive to
  produce it.

### 4. Academic framing — and the gap it leaves open

- **Third World Quarterly special issue, "Ghost Projects — Ruined Futures and
  the Unfulfilled Promises of Infrastructure Development"** (guest eds.
  Müller-Mahn, Kioko, Aalders; announced Feb 2026, launch June 2026)
  <https://globalsouth.org/2026/02/new-twq-si-ghost-projects-ruined-futures-and-the-promises-of-infrastructure-development/>
- Lead article, *Ghost projects and the ambiguity of infrastructure development*
  <https://www.tandfonline.com/doi/full/10.1080/01436597.2025.2610335>

  **This is an opening, not competition.** Twelve contributions on what ghost
  projects MEAN socially and politically, and not one on how to DETECT them.
  The literature has the theory and no method; we have a method and a measured
  account of where it fails.

### 5. Citizen reporting analogues — our Reports feed

- **GeoFix** (India) <https://www.geofix.in/> — the closest match. Reports are
  shown to nearby users who confirm with a tap, and a **confirmation threshold**
  triggers notification of the responsible department. That is our "masid" votes
  with a routing rule attached, and it is the obvious next step for ours.
- SmartCivic (India) — multilingual, GPS + photo + voice note
  <https://blink.new/p/smartcivic-india-issue-reporting-platform-4dqzmqoz>
- Community-based monitoring, general background
  <https://en.wikipedia.org/wiki/Community-based_monitoring>

### 6. Two pieces that argue for our own design decisions

- **"Ghost projects or mapping failure? Contractors push back over glitches"**
  <https://opinion.inquirer.net/188105/ghost-projects-or-mapping-failure-contractors-push-back-over-glitches>
  Contractors arguing the ghost-project findings are *mapping failures* rather
  than missing structures. This is the single best external justification for
  why every flag in MASID is worded as *the record disagrees with itself*, and
  for building a right-of-reply route. Cite it in the methodology.
- **"Philippines now turns to technology after flood control projects vanish"**
  <https://bworldonline.com/top-stories/2025/11/17/712461/philippines-now-turns-to-technology-after-flood-control-projects-vanish/>
  Government reaching for blockchain, livestreamed bidding and **satellite
  mapping**. The thesis arrives as the state adopts the method — a significance
  argument that writes itself.

Scandal context: [Wikipedia](https://en.wikipedia.org/wiki/Flood_control_projects_scandal_in_the_Philippines) ·
[421 ghost projects confirmed](https://www.philstar.com/headlines/2025/10/09/2478643/421-flood-control-projects-found-be-ghosts)

### What is left over — the contribution

Nobody found combines **contract-record checks + imagery + citizen reports over
the same set of projects, and reports which tier failed.** BetterGov is a
register. OCP is procurement-only. The World Bank material is imagery-only. TWQ
is theory. The fusion is the contribution, and the null result is what makes it
credible rather than promotional.
