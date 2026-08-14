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

**"Why not Google Earth?"**
Historical imagery isn't exposed by any Google API — the time slider is a UI feature of Earth Pro and Earth web only. Their tiles also can't be embedded in a third-party map under the Maps Platform terms. So the app links out to it instead, which is genuinely useful as a second opinion since Google often flies on different dates.

**"How much closer can the imagery get?"**
It can't. The metadata reports `MaxMapLevel 19`, and zoom 20 returns HTTP 404. Native sampling is 0.3 m per pixel. A pumping station is ~33 px across; a 1 m drainage line is 3 px and effectively invisible.

**"Is the citizen data real?"**
No — the three reports are seeded examples, badged DEMO, with obvious placeholder images rather than fabricated site photos. It's a prototype: reports live in the browser and go nowhere. A real deployment needs submission, moderation, an audit trail and a takedown route.

**"What would you do next?"**
Extend past one district office, get the COA audit findings in so "built more than once" becomes a recorded finding rather than an inference, and add Sentinel-1 radar, which sees through the wet-season cloud that makes 59 of 200 assessed sites unreadable.
