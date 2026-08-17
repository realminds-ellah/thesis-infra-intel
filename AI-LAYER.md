# The AI layer — architecture, and what it is allowed to do

MASID currently contains no machine learning. Every number in it is a
deterministic comparison of two published facts, which is why every flag can be
defended line by line. Adding an AI layer risks that, and the risk is the whole
design problem: a tool whose credibility rests on *never overclaiming* cannot
bolt on a component that guesses.

So this document leads with the constraint rather than the capability.

---

## The governing principle: extraction over inference

| | Checkable? | Example | Verdict |
|---|---|---|---|
| **Extraction** — reading a value that already exists in a document | **Yes**, against the document | "The contract agreement states 780 linear metres" | **Build this** |
| **Classification** — labelling something with a defined ground truth | **Yes**, against held-out labels | "This photo shows a revetment" | Build, once labels exist |
| **Inference about conduct** — predicting wrongdoing | **No.** There is no published itemised list of confirmed ghost projects to validate against | "This contract is likely fraudulent" | **Never** |

The satellite tier already demonstrated what happens when this line is crossed
carelessly: a plausible-sounding detector, built on an assumption nobody tested,
that turned out to have no discriminative power at all. It survived as a
credible part of the project *only* because it was measured and reported as a
null result. An AI layer gets the same treatment or it does not ship.

**Every AI output is a pointer, never a finding.** The wording rule holds
unchanged: the record disagrees with itself; go and look.

---

## Tier 1 — Document reading *(the headline, and it is not a chatbot)*

### The problem, measured

The register publishes **2,474 PDFs directly** and more inside zips:

| Document | Count |
|---|---|
| Notice of Award | 1,245 |
| Contract Agreement | 1,237 |
| Notice to Proceed | 1,237 |
| Advertisement | 1,217 |
| **Program of Work** | **0** |
| **Engineering Design** | **0** |

**None of them are machine-readable.** Tested on `23CC0269`'s contract
agreement:

- `pdffonts` reports **Type 3 fonts with custom encoding and no ToUnicode map**
  (`uni: no`) — the glyphs are drawn, but nothing maps them back to characters.
- `pdfimages` finds embedded grayscale JPEGs — scanned pages.
- `pdftotext` yields 7,659 non-whitespace characters of **unusable garbage**.

So there are roughly 2,500 published documents about ₱67.7 billion of public
works that **no one can search, and no conventional pipeline can read**. That is
not a niche AI application; it is the single largest untapped source in the
project, and it is unreachable without vision.

### What it would unlock

**FINDINGS.md §1 — the most consequential gap in the whole project.** 1,069 of
1,293 contracts (83%) publish **no dimension of any kind**; only 186 contain a
digit. You cannot tell whether a ₱96 M contract built fifty metres or two
kilometres.

The descriptions do not carry it. **The contract agreements might.** If a
vision-language model can read station limits, linear metres and quantities out
of those scans, the ceiling on scope corridors moves from **220 contracts to
potentially all 1,237** — and every imagery check becomes quantitative:
*780 m specified, N m visible* instead of *something is there*.

Secondary extractions, in rough order of value: contract amount and dates for
cross-checking; unit quantities for a price-per-metre comparison across
contractors; signatories; variation orders where present.

### Why this is safe to build

**Because it is measurable for free, with no manual annotation.**

The structured export already holds `awardAmount`, `dateOfAward`, `contractor`
and `contractId` for all 1,245 Notices of Award. Those same values appear inside
the scanned documents. So:

> Extract fields we already know → compare against the export → that is a
> **1,245-row labelled evaluation set** that costs nothing to build.

Report exact-match accuracy per field before trusting a single extracted
dimension. `verify_data.py` already established the precedent by checking one
NOA to the centavo by hand; this generalises it to every document, automatically.

Any field the model reads that the export *also* holds is a test. Any field only
the document holds — the dimensions — is the payoff, and it is trustworthy in
proportion to the measured accuracy on the fields that could be checked.

### Architecture

```
pipeline/documents.py
  fetch          → 2,474 PDFs + zips, cached by URL hash, never re-fetched
  rasterise      → page images at 200 dpi (pdftoppm)
  read           → vision-language model, one structured JSON per document
  reconcile      → compare extracted vs known fields from the export
  emit           → src/app/data/documents.json  +  an accuracy report
```

**Model choice matters for reproducibility, not just cost.** A thesis result
that depends on a paid API is weaker than one anyone can re-run. Preference
order: a local open-weights vision model → a documented hosted model with the
exact version and prompt recorded → nothing. Whatever is used, the prompt, model
version and date go in the output file, the way `wayback.py` records acquisition
metadata.

**Extraction is constrained, not free-form.** Ask for a fixed JSON schema with
nulls allowed, never prose. A null is a correct answer and must be cheaper for
the model to give than a guess — the same discipline as "cannot tell" being a
first-class option in the imagery review station.

---

## Tier 2 — Vision on sub-metre imagery *(blocked, and honest about it)*

The Sentinel-2 tier failed because 10 m per pixel is wider than the structures.
The Wayback archive provides **0.3–0.5 m** imagery, and **826 of 962 dated
contracts have a clean before-and-after pair**. That is the right input for a
supervised change-detection model: *did a structure appear between these two
frames?*

**What blocks it is labels, and the project already built the label factory.**
The imagery review station collects exactly the needed annotation — structure
visible / built but unidentified / nothing visible / coordinate suspect / cannot
tell — attributed, dated, CSV-exportable. It currently holds **almost none**.

Order of operations, and it is not negotiable:

1. Review ~300–500 sites through the existing station. This is human work with
   no shortcut.
2. Hold out a third. Train on the rest.
3. Report precision and recall **against the held-out third**, and against a
   seeded control group as `satellite.py` already does.
4. If it does not beat the control rate, report that. The project has published
   one null result already; a second is not a failure.

Anything that ships before step 3 repeats the mistake the project is known for
having caught.

---

## Tier 3 — Citizen-side assistance

Smaller models, narrower jobs, and the tier where user harm is most likely.

**Report grouping — one thread per project.** The adviser's request, and better
served by AI than by a database key: ten reports of the same missing structure
are **corroboration**, not duplication. Cluster by project id, then by proximity
and description similarity, and present one card with N reports nested. Group the
*presentation*, never merge the *records*.

**Photo relevance, not photo verdicts.** A vision model can say "this is an
indoor selfie, not a riverbank" and quietly deprioritise it. It must never say
"this photo proves nothing was built". The first is moderation; the second is a
finding the model cannot support.

**Language.** Reports will arrive in Tagalog, English and Taglish, often mixed
in one sentence. A model that normalises and translates *for the reader* — while
always keeping the original text visible — makes the feed usable across the
country. The original is the record; the translation is a convenience and is
labelled as one.

**Abuse filtering, with the earlier caution intact.** Blur behind a control,
never delete; log every filter action; scope to slurs and sexual content, never
to criticism of institutions. A model that hides "offensive" content is one
configuration change away from hiding the reports this tool exists to collect.

---

## Tier 4 — Asking in your own language

The filters are good and still assume you know what a filter is. A layer that
turns *"ilang proyekto sa Hagonoy ang hindi pa tapos?"* into a filter state is
the most direct accessibility win available.

**The hard constraint: it emits a filter, not an answer.** The model's entire
output is structured — municipality, status, year, flags — which the existing
deterministic code then applies, and the app shows the same counted result it
would have shown had you clicked. The model never states a figure, never
summarises a contract, never characterises a contractor. It translates a
question into a query and then gets out of the way.

That design makes hallucinated numbers structurally impossible rather than
merely discouraged, and it is the reason to build this rather than a chatbot
over the register.

---

## What the AI layer is never permitted to do

1. **Assert that a project was not built.** Only inspection establishes that.
2. **Score, rank or label a contractor by likelihood of wrongdoing.** There is no
   ground truth to validate it against — the ICI referred its findings to the DOJ
   and Ombudsman rather than publishing an itemised list — so any such score is
   unfalsifiable by construction, and unfalsifiable accusations about named
   companies are exactly what this project has refused throughout.
3. **Write the flag text.** Flag wording is the project's legal and ethical
   guard and stays hand-written.
4. **Silently replace a published value.** An extracted figure sits *beside* the
   published one, marked as extracted, with a link to the page it came from.
5. **Emit prose where a number is expected.** Every extraction returns a schema
   with nulls permitted.

---

## Build order

| | Tier | Why here | Blocked on |
|---|---|---|---|
| **1** | Document reading | Largest untapped source; self-evaluating; attacks the project's #1 finding | Nothing |
| **2** | Report grouping + language | Small, safe, directly requested, immediately useful to citizens | Nothing |
| **3** | Natural-language filters | Highest accessibility gain per line of code | Tier 2's language work |
| **4** | Supervised imagery model | The scientifically interesting one | **300–500 human reviews** |

Tier 1 first is not a hedge. It is the only tier that both attacks the finding
everything else is downstream of — 83% of contracts publishing no dimension —
and comes with a 1,245-row evaluation set already sitting in the data.

---

## What this changes about the thesis argument

The current argument is: *the public record cannot answer whether these projects
were delivered, and here is exactly where and why it fails.*

The AI layer does not overturn that. It sharpens it. If 2,500 documents that
nobody can read turn out to contain the dimensions missing from 83% of contracts,
then the finding becomes stronger and more specific: **the information exists and
is published — it is simply published in a form that defeats every conventional
tool, which is a transparency failure of a different and more interesting kind
than not publishing at all.**

That is a better result than either "the data is missing" or "AI found fraud",
and it is the one the evidence currently points at.
