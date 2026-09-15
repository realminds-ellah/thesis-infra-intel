# Significance & Impact

*Why this thesis matters, who uses it, and what can be built from it.*

> **The one-sentence version:** this thesis builds a way to check, from space, whether
> public money turned into physical concrete — cheaply, at scale, and independently of
> the people who spent it.

Everything below follows from that one capability.

---

## 1. The core asset (what survives after the thesis)

The lasting contribution is not a flood dashboard. It is a **validated protocol**:
give it a list of declared infrastructure (location, declared works, budget, dates)
and it returns, for each project, an **existence-and-conformance score with calibrated
confidence, plus the supporting satellite evidence**. Because it is validated against
an independent audit (COA), its accuracy is *proven*, not merely claimed.

Why the asset has value: it is **independent and uncheatable at the source.** A
contractor can falsify paperwork, influence an inspector, or fake GPS coordinates —
but cannot alter what a satellite already recorded over the site years ago. The method
is a verification layer that sits *outside* the chain of actors being audited.

---

## 2. Who uses it

| User | What they do with it | The gap it fills today |
|------|----------------------|------------------------|
| **COA / Ombudsman / ICI** | Decide which sites to physically inspect | They audit by hand — a few dozen sites out of thousands |
| **DPWH (internal)** | Flag suspicious "completed" projects before final payment | No independent existence check exists |
| **Journalists / civil society** | Evidence-backed investigation at scale | Manual, one project at a time |
| **Multilateral funders** (World Bank, ADB, JICA) | Verify disbursement milestones on loans | They fund infrastructure they cannot physically monitor |
| **Insurers / re-insurers** | Confirm the flood defenses they underwrite actually exist | They rely on the government's word |

---

## 3. The killer near-term use: audit triage

COA found the Bulacan ghost projects by physically visiting sites. Their bottleneck is
severe: they can inspect only a **few dozen projects out of thousands**, and must
essentially *guess* which to visit.

This tool inverts that. Run the detector over **every** project overnight, rank them by
"least satellite evidence of construction," and hand oversight the top 50. **It does not
replace the auditor — it aims the auditor.** A random-sampling audit becomes a targeted
one, multiplying scarce human inspection capacity by an order of magnitude.

This is the operationally adoptable version: a government agency or anti-corruption NGO
could use it immediately, with no change to their legal process — it only decides *where
to look first*.

---

## 4. What can be built (the product ladder)

The thesis is rung one. Each rung is a defensible step, not a leap:

1. **Thesis** — a validated detector for Bulacan flood-control projects. *(the brick)*
2. **Triage tool** — a ranked "investigate these first" list for oversight bodies. *(first real user)*
3. **Continuous monitor** — re-runs each month as new imagery arrives, catching ghosts in
   year one instead of year four, when the damage is done. *(recurring value)*
4. **Verification API** — input any project list, output existence scores plus evidence;
   serve auditors, funders, and insurers. *(the business)*
5. **Infrastructure Intelligence Platform** — the long-term vision, now earned bottom-up:
   not "we care about accountability," but "we have a proven, independent way to verify
   that declared infrastructure exists." *(the cathedral, built one brick at a time)*

---

## 5. Why it is bigger than floods

Nothing in the method's core is flood-specific. *"Did a declared structure physically
appear at this location?"* is the same question for roads, bridges, school buildings,
and health centers — all subject to ghost-project fraud in developing countries — and for:

- **Foreign aid** — donors spend billions and struggle to verify delivery; existing work
  (e.g. geocoding aid) locates projects but does not verify they were *built*.
- **SDG and climate-finance monitoring** — confirming that funded adaptation was actually
  constructed.

Flood control was chosen because the 2025 scandal supplied free ground-truth labels and
urgency. But the underlying capability is **remote verification of declared public
infrastructure** — a globally reusable one. That is the genuinely notable contribution.

---

## 6. The deepest significance: deterrence, not just detection

Detection is the surface. The real prize is **prevention**. Once contractors and officials
know that an independent, automated satellite check exists, the calculus of a ghost project
changes — an empty lot cannot be hidden from an eye that photographs it every month. This
is a piece of **accountability infrastructure**: it deters the theft it is designed to
catch. The public-value answer to "so what" is measured not in projects flagged, but in
projects that never become ghosts because someone was watching.

---

## 7. Honest limits (what it is NOT)

- It **flags; humans confirm.** It never convicts. Output is always *"no detectable
  structure consistent with the declared project,"* never an accusation of fraud.
- It works only on structures large enough to see. Part of the contribution is honestly
  **mapping the unverifiable blind spots** — project types too small for current free
  imagery.
- Its power is bounded by imagery resolution and by the number of validation labels.
- It should be positioned as a **force-multiplier for auditors**, never as an automated
  judge.

---

*See [`README.md`](README.md) for the method and how to run the audit.*
