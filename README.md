# MASID

**Quality Monitoring of Flood Control Infrastructure Delivery Through Procurement
and Satellite Data**

An undergraduate thesis, BS Mathematics with specialization in Computer Science,
College of Science, Bulacan State University — City of Malolos, Bulacan.
September 2026.

Proponents: Benerado, Ellah D. · Fedalquin, Niña Mycaella A. · Teodoro, Jerome S. ·
Viray, Angel Lorraine T.

---

## What MASID does

MASID checks whether flood-control projects that were paid for were actually built.

There are **517 of them in the First District of Bulacan, worth ₱25.88 B**. Nobody
can visit all of them. So the system:

1. **Reads what was promised.** The contract documents are scanned paper no search
   engine can read. MASID reads them and recovers what was supposed to be built —
   concrete volume, steel mass, structure type, location.
2. **Looks at the ground.** Sub-metre satellite imagery of that exact coordinate,
   before the project started and after it was due to finish.
3. **Ranks the disagreements and routes an inspector.** Where the paper says a
   revetment and the ground shows an empty bank, that contract rises. A travelling
   salesman formulation then orders the visits into one feasible trip.

It is a **triage tool**. It aims scarce inspectors. It never says anyone stole
anything — a flag means *the record disagrees with itself, go look*, and a person
standing on the riverbank is what settles it.

## Repository layout

```
README.md                  this file
FINDINGS.md                what the built system measured — start here
RELATED-WORK.md            the peer-reviewed spine
RRL-MATRIX.csv             related work as the review matrix, with gaps marked
AI-LAYER.md                AI architecture, led by what it may not do
DEMO-SCRIPT.md             timed five-minute walkthrough

masid/                     the system
  pipeline/                nine Python pipelines behind one verification gate
  src/app/                 the web application
  data-docs/               the data contract, enforced by validate.py
  SOURCES.md               provenance, licences, and what the record lacks

thesis/
  chapters/                the manuscript

background-research/       the pre-MASID topic exploration, July 2026
  README.md                the original satellite-only proposal (superseded)
  TOPIC-BANK.md IDEAS.md TITLES.md RESEARCH-LOG.md SIGNIFICANCE.md FUSION.md
  audit.py criteria.yaml power/
```

`background-research/` is kept unedited and is not part of the system. It records
what was assumed before anything was measured. The thesis's credibility rests on
showing which of those assumptions survived — and three of them did not.

## Running it

```bash
cd masid
python3 pipeline/verify_data.py     # gate: must pass before anything else runs
python3 pipeline/build_dataset.py   # contracts, boundaries, consistency flags
python3 pipeline/procurement.py     # bidding red flags, benchmarked nationally
python3 pipeline/documents.py       # OCR the scanned contracts → Bill of Quantities
python3 pipeline/satellite.py       # Sentinel-2 change detection (free, no signup)
npm install && npm run dev
```

Everything runs on public data. No DPWH FOI response and no PhilSA imagery grant
is required to reproduce any figure in this repository.

## What was measured, including what failed

The project reports its own negative results as prominently as its positive ones.
Three matter:

**The free 10 m optical tier does not discriminate.** Sentinel-2 change detection
fires on 5.9% of flagged records and 7.7% of seeded controls — Fisher exact
p = 1.00. Four statistics across four thresholds never exceed 26% recall, so the
limit is the sensor and the setting rather than the estimator. Commercial
construction-monitoring vendors sell this capability at 30 cm and none of them
publishes a null result.

**Checking a record against itself does not catch fabrication.** COA has filed
fraud audit reports on this district office. Nine of the named contracts match
this register exactly. **The records tier flags none of them** — every one
publishes a coordinate that geocodes to the municipality its own description
names, at zero offset, and reports completed. A fabricated delivery produces a
clean paper record.

**Remote monitoring can establish existence, not quantity.** Classifying every pay
item by whether it survives to be photographed: 0.1% directly visible, 32.7%
outline only, **67.1% invisible to any camera** — excavation backfilled, rebar
cast in. No satellite, drone or street pass changes that.

Full detail in [`FINDINGS.md`](FINDINGS.md).

## Standing rules

These are binding on the code, the interface and the manuscript alike.

- **Never invent a value the public record lacks.** Disbursement is ₱0 on all
  completed records and is shown as a gap, never estimated.
- **A flag says the record disagrees with itself** — never that anyone stole
  anything. No model may emit a fraud score.
- **A tier that fails reports its own failure**, in a banner that cannot be
  scrolled past.
- **Measure before claiming.** Documentation that can drift is not evidence;
  `data-docs/validate.py` exits non-zero when it does.
- **Nobody sees a different number.** Roles change what is shown first, never what
  is available.

## Scope

The study locale is the **First District of Bulacan** — Bulakan, Calumpit, City of
Malolos, Hagonoy, Paombong and Pulilan. The district is the unit of verification.

**Bulacan 1st District Engineering Office** is the procuring entity, and covers
thirteen municipalities. Procurement characterisations are properties of the
office and are labelled as such. The two are never used interchangeably: the
difference is 517 contracts against 1,293.

## Licence and attribution

Data sources, licences and their limits are documented in
[`masid/SOURCES.md`](masid/SOURCES.md). Imagery is served live from its providers
and is not redistributed by this project.
