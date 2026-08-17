# MASID — 5-minute demo walkthrough

**Monitoring And Surveillance of Infrastructure Delivery**
Quality monitoring of flood control infrastructure delivery through procurement and satellite data
Case study: DPWH Bulacan 1st District Engineering Office

---

## Before you start — 2 minutes of setup

| | |
|---|---|
| **Run it from** | `http://localhost:5173` — **not** the live site. The deployed version at masid.vercel.app is one version behind and does **not** have the imagery time strip in Act 3. |
| **Start the server** | `cd ~/masid && npm run dev` |
| **Sign in as** | DPWH Administrator (the default) — it sees every screen |
| **Reset the demo data** | In DevTools console: `localStorage.clear()` then reload. This restores the three example reports and clears any imagery reviews. |
| **Camera** | Only needed if you show live capture. Allow the permission **before** you present, so the prompt doesn't interrupt you. |
| **Theme** | Light for a projector, dark for a screen share. Toggle is top-right of the nav. |

**Have these tabs ready:** just the one. Everything is in the app.

> **Pacing — measured, not guessed.** Every spoken line counted at a normal demo pace of 140 words/min:
>
> | | words | time |
> |---|---|---|
> | Full script | 730 | **5 min 13 s** — 13 s over |
> | Drop the three ⟨drop if long⟩ lines | 658 | **4 min 42 s** — leaves 18 s for clicking |
>
> So **plan to drop all three.** Put them back only if you are running fast. Never cut the red-banner line in Act 3 or the 96.00% line in Act 1 — those are the demo.

---

## The one-line version, if you only get 30 seconds

> Ten years of flood control contracts for one district office, rebuilt from public records, checked for places where the record disagrees with itself — and honest about the two questions satellite imagery cannot answer.

---

## ACT 1 — The register, and what it already admits
**0:00 → 1:20**

### 0:00 — Open on the Dashboard *(already signed in)*

> "This is MASID. Every number here comes from public records — DPWH's own flood control export, PhilGEPS award notices, Sentinel-2, and the UP NOAH hazard maps. Nothing is estimated."

> "One district office. **1,293 contracts. ₱67.7 billion. 2016 to 2025.**"

*[Point at the six tiles across the top]*

> "**310 trip at least one consistency check.** Note the phrase — the record disagrees with itself. Not fraud. That distinction holds everywhere in this tool."

### 0:35 — Scroll to **Where the money went**

> "The question everybody actually arrives with — who got paid."

*[Point at the contractor bars]*

> "**12 firms out of 176 hold half of the ₱67.7 billion.** And **8 carry a registration DPWH itself marks revoked** — ₱4.92 billion. We didn't decide that. Their own export says so."

### 0:55 — Scroll to **What to audit first**

> "Two independent signals — the record, and the bidding pattern."

*[Point at the triage header line]*

> "This office awards at **exactly 96.00% of the approved budget on 38.4% of its contracts.** The national rate is **3.9%.** That makes it **rank 1 of 48 district offices.**"

*[Beat. Let that land.]*

> "**17 contracts trip both signals.** That's where you'd start."

---

## ACT 2 — Where, and whether the location is even real
**1:20 → 2:00**

### 1:20 — Click **Map**

> "Same records, on the ground. Colour is audit priority — green is clean, red is several checks tripped."

### 1:40 — Click a red dot → detail panel

> "Every contract opens to its full record — award, bidders, documents, flood hazard, and the checks that tripped." ⟨drop if long⟩

> "**92% publish a coordinate. 102 don't.** And three of the ones that do sit **more than a kilometre outside Bulacan.**"

---

## ACT 3 — The part that says "I don't know"
**2:00 → 3:40**

> "Now the satellite tier — the part I'd most like you to look at, because it reports a negative result."

### 2:05 — Click **Satellite**

*[Point at the red banner, top of screen — don't skip it]*

> "This banner never leaves the screen. The automated detector **does not work.** It fires on **6 of 102 flagged contracts and 3 of 39 controls** — the same rate. It cannot tell a flagged contract from an ordinary one."

> "So no verdict here is evidence — and it says so where nobody can miss it."

### 2:30 — Scroll to **What is there now**

> "What *does* work is the imagery. Sub-metre — you can see whether a structure is there. So the screen stops computing a verdict and starts collecting one."

*[Click a review option — e.g. "Nothing visible"]*

> "Five options, every one describing the **picture**, not the contract. 'Nothing visible' means nothing was visible in this photo on this date — a reason to send an inspector, not a conclusion."

> "Each records who and when, and exports to CSV — the ground-truth set you'd need to evaluate any future detector." ⟨drop if long⟩

### 3:00 — Scroll to **The same spot, photographed over time**

> "And this is the finding I didn't expect."

*[Step left through the frames with the arrow]*

> "Esri publishes 28 archived versions over Bulacan. Read the acquisition metadata and those 28 are republications of **six actual photographs.**"

> "**The gap between the last two flights is five and a half years — October 2019 to April 2025.**"

*[Point at the track — no amber segment]*

> "That gap contains the entire spending surge. The 2022, 2023 and 2024 contracts — the biggest bars on the dashboard — were awarded, built and completed **without one high-resolution photograph taken over them.**"

> "So it can't be a progress view and I don't call it one. But **826 of 962 dated contracts have a clean before-and-after pair** — enough to ask whether a structure appeared."

---

## ACT 4 — So you ask the people who are there
**3:40 → 4:30**

### 3:40 — Click **Reports**

> "If imagery can't settle it, ask someone standing on the bank."

*[Point at an example card]*

> "Photos can only be taken live — the camera opens in the page, no file picker. That stops the easy case. It isn't proof, and the banner says so."

### 3:55 — Click **Report from the site** *(or point at an existing card)*

> "Filing one starts with what you're reporting. Seven options, every one describing the site, not a person. No 'ghost project' button."

> "One is **'It is there and looks finished.'** If a feed only accepts complaints, silence becomes unreadable — you can't tell the sites nobody checked from the ones that were fine." ⟨drop if long⟩

*[Close the sheet. Point at a card's location line.]*

> "If GPS is allowed, the report is tagged automatically — resolved **on the device**, against the same boundaries the audit uses. Nothing goes to Google."

> "And it makes the one comparison worth automating: **'Taken in Hagonoy — contract says Calumpit.'** That accuses nobody. It's the reason to look."

---

## CLOSE
**4:30 → 5:00**

> "Three things to take from this."

> "**One** — built entirely from public records, so anyone can reproduce it."

> "**Two** — it never says fraud. Every flag is worded as *the record disagrees with itself*, because that's what the data supports."

> "**Three** — the satellite tier reports a null result, and the imagery archive has a five-year hole exactly where the money is. I didn't hide those. They're findings about what satellite monitoring can and can't do here right now."

> "Thank you."

---

## Timing card — tear this off

| Time | Screen | The one thing to land |
|---|---|---|
| 0:00 | Dashboard | 1,293 contracts · ₱67.7B · public records only |
| 0:35 | Where the money went | **12 of 176 firms hold half** · 8 revoked, ₱4.92B |
| 0:55 | Audit-priority triage | **96.00% on 38.4% vs 3.9% national — rank 1 of 48** |
| 1:20 | Map | Colour = audit priority; 102 have no coordinate |
| 2:05 | Satellite banner | **The detector does not work — 6/102 vs 3/39** |
| 2:30 | Review station | Five options, all describe the picture |
| 3:00 | Imagery over time | **6 flights, 5.5-year gap over the whole surge** |
| 3:40 | Reports | Live capture only · positive option exists |
| 4:10 | GPS tag | **"Taken in Hagonoy — contract says Calumpit"** |
| 4:30 | Close | Reproducible · never says fraud · reports its own nulls |

---

## If you get asked

**"Is this accusing anyone?"**
No. Every flag is a discrepancy between published records. Whether anything is missing on the ground is a question for inspection, and the tool says so on every screen.

**"Why doesn't the satellite part work?"**
Sentinel-2 is 10 m per pixel. That's wider than most structures in this register — a 2 m revetment cannot produce a signal. I measured it against seeded controls rather than assuming it worked.

**"Did you use PhilSA's satellites?"**
No, and the reason is access rather than choice. PhilSA imagery comes through a formal
request, which is pending — there is no open catalogue. I tested it: every machine-readable
path on their data portal returns 404, against nine anonymous open collections for
Sentinel-2. It would not have rescued the detector either: Diwata is a tasked telescope
rather than a sweeper, so there is unlikely to be a repeat archive over these coordinates
on these dates, and at ~3 m a two-metre revetment is still a pixel. What PhilSA would
genuinely unlock is **tasking** — imagery acquired inside a contract's construction window,
which is the only fix for the five-and-a-half-year gap — and **SAR**, which sees through the
cloud that makes 59 of 200 sites unreadable. Written up in `masid/SOURCES.md`.

**"Why not Google Earth?"**
Historical imagery isn't exposed by any Google API — the time slider is a UI feature of Earth Pro and Earth web only. Their tiles also can't be embedded in a third-party map under the Maps Platform terms. So the app links out to it instead, which is genuinely useful as a second opinion since Google often flies on different dates.

**"How much closer can the imagery get?"**
It can't. The metadata reports `MaxMapLevel 19`, and zoom 20 returns HTTP 404. Native sampling is 0.3 m per pixel. A pumping station is ~33 px across; a 1 m drainage line is 3 px and effectively invisible.

**"Is the citizen data real?"**
No — the three reports are seeded examples, badged DEMO, with obvious placeholder images rather than fabricated site photos. It's a prototype: reports live in the browser and go nowhere. A real deployment needs submission, moderation, an audit trail and a takedown route.

**"Can you check the contract against what is actually built?"**
Partly, and now with a number. All 1,237 scanned contract agreements were OCR'd — the
Bills of Quantities are in there, and 209 of the 1,015 contracts with no published
dimension do carry a measured quantity in the paper. But classifying every pay item by
whether it survives to be photographed: **0.1% is directly visible, 32.7% is outline
only, and 67.1% is invisible to any camera** — excavation backfilled, reinforcing steel
cast into concrete. Remote monitoring can establish existence and footprint. It cannot
establish quantity, and no satellite changes that. See `FINDINGS.md` §1.

**"What would you do next?"**
Extend past one district office, get the COA audit findings in so "built more than once" becomes a recorded finding rather than an inference, and add Sentinel-1 radar, which sees through the wet-season cloud that makes 59 of 200 assessed sites unreadable.

---
---

# APPENDIX A — The stack

*Not spoken. Reference for the "how did you build it" question.*

## Front end

| | | Why |
|---|---|---|
| **React 18 + TypeScript** | `18.3.1` | Types earn their keep here: a contract record has ~30 fields and half of them are legitimately nullable. The compiler catches "coordinate might be null" before a demo does. |
| **Vite** | `6.3.5` | Dev server starts in ~200 ms; production build in ~2.7 s. |
| **Tailwind CSS** | `4.1.12` | v4 compiles every colour utility to a CSS custom property — which is the only reason dark mode is one 190-line stylesheet instead of `dark:` on ~2,000 class occurrences. |
| **Leaflet + react-leaflet** | `1.9.4` / `4.2.1` | Open source, no API key, no per-load billing. Swaps basemaps freely, which is what lets the same map show street, satellite and a dated 2018 archive layer. |
| **react-leaflet-cluster** | `2.1.0` | 1,191 markers is an unreadable smear without it. |
| **Recharts** | `2.15.2` | SVG charts, so they inherit the theme's custom properties directly. |
| **lucide-react / sonner** | | Icons, toasts. |

Deployed as a **static single-page app on Vercel**. There is no back end.

## Data pipeline — Python

Seven scripts under `pipeline/`, each writing JSON the app imports at build time:

| Script | Does |
|---|---|
| `verify_data.py` | **Gate.** Must pass before any other pipeline runs. Cross-export agreement, structural checks, a primary-source spot check against a published Notice of Award. |
| `build_dataset.py` | The register: 248,220 national records → 1,293 Bulacan 1st DEO flood-control contracts, plus the consistency checks. |
| `procurement.py` | Bidders, approved budget, award amount, bid ratios. Computes the national baseline **before** narrowing to one office. |
| `satellite.py` | Sentinel-2 NDVI/NDBI change detection with a bootstrap null, plus the self-validation that reports the tier does not work. |
| `evaluate.py` | Statistic ablation — disc-mean/tail/core/patch × 1.0–2.5σ. Recall never exceeds 26%. |
| `hazard.py` | UP NOAH flood-hazard join. |
| `wayback.py` | Resolves the Esri imagery archive to distinct flights, with acquisition date, resolution, accuracy and provider. |

**Libraries:** pandas, pyarrow, shapely (STRtree + prepared geometries), rasterio (windowed COG reads), pyshp, Pillow, numpy.

## What there deliberately isn't

**No database, no server, no accounts.** Citizen reports and imagery reviews live in the browser's `localStorage` and go nowhere. Every screen that collects something says so. A real deployment needs submission, moderation, an audit trail and a takedown route — none of which exist, and the prototype does not pretend otherwise.

---

# APPENDIX B — The data we used

Everything below is public and free. No signup, no API key, no scraping of anything private.

### 1. DPWH infrastructure transparency records
- **Via** [`bettergovph/dpwh-transparency-data`](https://huggingface.co/datasets/bettergovph/dpwh-transparency-data) — a volunteer scrape of `infrastructure.dpwh.gov.ph`
- **Licence** CC0-1.0 · **248,220** national records → sliced to **1,293** flood-control contracts, Bulacan 1st DEO, 2016–2025
- **Gives** contract id, description, contractor, budget, progress, status, dates, funding source, coordinates
- **Caveat, stated out loud** it is a third-party mirror, not a DPWH release. Verified against a published Notice of Award to the centavo, but *faithful-but-unofficial* — good enough to build and reason on, not to cite as the government's own position.

### 2. PhilGEPS award notices (detail export)
- **Gives** bidders per contract, approved budget ceiling (ABC), award amount, award dates, document links
- **Produces** the bid-ratio analysis — including the finding that this office awards at exactly 96.00% of ABC on 38.4% of contracts against a 3.9% national rate

### 3. Sentinel-2 L2A
- **Via** Element 84 Earth Search STAC → AWS Open Data COGs, anonymous access
- **10 m/px, ~5-day revisit, 2015→present, free**
- **Produces** the NDVI/NDBI change tier — and its null result

### 4. geoBoundaries PHL ADM3
- **Licence** CC BY 3.0 IGO · 24 municipal polygons
- **Produces** coordinate integrity checks, and the on-device reverse geocoding in citizen reports

### 5. UP NOAH 100-year flood hazard
- **Via** BetterGov's mirror of Project NOAH · 261,710 polygon parts
- **Produces** the hazard join: 596 high / 210 medium / 76 low / 306 just outside / 3 over a kilometre away

### 6. Esri World Imagery + Wayback archive
- **Sub-metre, served live with attribution, never redistributed**
- **Produces** the "what is there now" panel and the six dated flights

### 7. OpenStreetMap
- Street basemap and place names.

> **The honest summary of the data position:** everything here describes what was *contracted*. Nothing in the public record describes what was *delivered* — no disbursement figures, no progress photographs, no inspection reports. That gap is exactly what the two data requests are for.

---

# APPENDIX C — What changes when PhilSA and DPWH data arrives

## From DPWH

| Ask | What it unlocks | Pipeline work |
|---|---|---|
| **Progress / accomplishment photographs**, dated and geotagged | The single biggest unlock. **826 contracts currently have only a before and an after** — no imagery from during the build. DPWH already takes these photos. | New tier: match photo EXIF geotag against the published coordinate — the same check the citizen reports already run. |
| **Disbursement records** | We only have *awarded* amount; what was actually paid is not published. Turns "awarded ₱X" into "paid ₱Y at Z% reported progress" — the discrepancy that matters most. | Extend `build_dataset.py`; add a payment-vs-progress check. |
| **Program of Works / detailed estimates** | Designed quantities: length, dimensions, materials. Makes imagery checks **quantitative** — "780 m of revetment specified, N m visible" instead of "something is there". | New check comparing designed length against measured extent. |
| **Inspection reports and S-curves** | Real ground truth on the progress timeline. | Validation set for every other tier. |
| **Variation orders and time extensions** | Explains the **256 overdue** contracts — some legitimately, which the current flags cannot distinguish. | Reduces false positives on the overdue check. |
| **Barangay and exact station/chainage** | Sharpens coordinate checks from municipality level to barangay level. | Tightens `MUNI_MISMATCH` and the boundary checks. |

## From PhilSA

| Ask | What it unlocks | Pipeline work |
|---|---|---|
| **Tasked acquisitions over selected contracts** | The fundamental fix. Imagery **on demand, inside a contract's construction window** — which is precisely what the 5½-year archive gap denies us today. | `satellite.py` moves from fixed before/after windows to acquisition dates aligned per contract. |
| **Diwata-2 / higher-resolution PH archive** | More dates, and Philippine-owned provenance rather than a commercial mosaic. | Additional frames in the time strip. |
| **SAR (Sentinel-1 or PH radar)** | Sees through cloud. **59 of 200 assessed sites are currently unreadable** because of wet-season cloud over Bulacan. | New tier: backscatter change, which responds to built surface rather than to greenness. |
| **LiDAR / high-resolution DEM** | Elevation profile — whether a structure has the height and cross-section designed, not just a footprint. | New check against Program of Works dimensions. |

## What that makes possible that is impossible now

1. **A detector that can actually be evaluated.** The current tier is declared null because flagged records and controls detect at the same rate. With during-construction imagery *and* a labelled ground-truth set — which the imagery review station is already collecting and exporting as CSV — recall and precision become measurable rather than assumed.
2. **Delivery, not just procurement.** Every finding in this build is about the *record*. Disbursement plus progress photos moves it to what was actually delivered.
3. **Quantitative rather than binary.** "A structure is visible" becomes "a 780 m revetment was specified and 300 m is visible."

## What does *not* change

- **The wording.** Flags stay "the record disagrees with itself". More data raises confidence; it does not license an accusation.
- **The need for COA findings.** Only an audit finding turns "built more than once" from an inference into a recorded fact. That is a separate request and a separate document trail.
- **Human verification.** Every tier here produces a reason to look, not a conclusion. That is the design, not a limitation of the current data.
