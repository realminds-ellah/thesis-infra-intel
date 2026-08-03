# MASID

Quality monitoring of flood control infrastructure delivery, Bulacan 1st DEO.

A GIS dashboard over **1,293 real DPWH flood control contracts** (2016–2025,
₱67.75 B, 176 contractors), built entirely from public data — no DPWH FOI
response and no PhilSA imagery grant required to run it.

```bash
python3 pipeline/build_dataset.py   # contracts, boundaries, consistency flags
python3 pipeline/satellite.py       # Sentinel-2 change detection (free, no signup)
npm install && npm run dev
```

## What this is

The interface began as a [Figma Make design
export](https://www.figma.com/design/ECH44zAkMxAyLS89wnlWy8/Design-MASID-GIS-Dashboard)
with twelve invented projects. This repo replaces that mock data with the real
public record and adds the derivation that makes it useful: every published
coordinate is reverse-geocoded against official municipal boundaries and compared
with the location the contract description itself states.

**That is a queue to investigate, not a finding.** See [SOURCES.md](SOURCES.md)
for what each check tests, why the thresholds are conservative, and what the
public record does not contain.

## Layout

```
pipeline/build_dataset.py   fetch → filter → geocode → flag → emit JSON
pipeline/satellite.py       STAC search → windowed COG reads → composite → z-score
src/app/data/               generated: projects, contractors, boundaries, satellite, meta
src/app/data/index.ts       typed accessors and derived chart series
src/app/App.tsx             the dashboard
data/                       source cache (untracked)
SOURCES.md                  provenance, licences, gaps, flag definitions
```

## Two tiers

**Records tier** — every published coordinate is reverse-geocoded against
official municipal boundaries and compared with the location the contract
description itself states, and every contractor is checked against the
registration marker DPWH publishes in its own records. 310 of 1,293 records
disagree with themselves or with the contractor register in some way.

**Imagery tier** — Sentinel-2 L2A change detection over the pre-construction and
post-completion periods, sampled at 30 m, 90 m and 150 m against a bootstrap null
of 160 same-radius discs drawn from each site's own surroundings. Free public COGs
on AWS Open Data via the Earth Search STAC: no account, no API key, no Earth
Engine signup. 200 records assessed, with before/after NDVI chips rendered for
each.

## The imagery tier does not work, and reports that itself

The seeded control sample exists to measure the detector against itself. It
fails: flagged records detect at **5.9%**, seeded controls at **7.7%** — controls
slightly *more* often, Fisher exact p = 1.00. **No individual satellite verdict
carries evidential weight about its contract**, and the app says so in a red
banner above every assessment.

The cause is resolution, not tuning. A revetment is metres wide; averaging it
across a 30 m disc of floodplain whose seasonal swing dwarfs the structure buries
the signal. `SOURCES.md` sets out what would plausibly fix it — 3 m PlanetScope,
Sentinel-1 coherence, or linear-feature sampling.

This is a real constraint on the whole approach, and shipping it stated plainly is
worth more than a detector that looks like it works.

**Neither tier establishes that a project was not built.** A flag means the
paperwork disagrees with itself. See [SOURCES.md](SOURCES.md).
