# Data quality

<!-- GENERATED FROM src/app/data/data-quality.json BY build_quality.py — DO NOT EDIT -->

The gate's own results, rendered. `pipeline/verify_data.py` runs **before every other pipeline** and refuses to pass the build on a FAIL.

It exists because this project once shipped a tier built on an unchecked assumption about what a column meant, and a screen built on a claim that turned out to be false. Both would have been caught by running it.

| level | count | meaning |
|---|---|---|
| PASS | 19 | the check ran and the data satisfied it |
| WARN | 4 | known and accepted — listed in full below, never hidden |
| info | 13 | a counted fact, not a judgement |
| **FAIL** | 0 | would stop the build |

## The check that matters most

Anyone can build a dashboard on a mirror and never learn whether the mirror is faithful. So one contract is checked against the **government's own published PDF**, by hand, to the centavo:

| | |
|---|---|
| contractId | 22CC0095 |
| document | https://dcs.infrawatch.ph/notice_of_award/22CC0095/22CC0095_-_NOA.pdf |
| pdfStates | P43,276,428.28 |
| parquetAwardAmount | 43276428.28 |
| match | True |

One spot check is not a guarantee. It is the difference between trusting a mirror and having tested it.

## What `budget` actually means

| | |
|---|---|
| matchesAbc | 52.7% |
| matchesAwardAmount | 45.3% |
| conclusion | mixed — use abc and awardAmount explicitly |

This is why the interface reads `abc` and `awardAmount` rather than `budget`. An earlier version filtered on `budget`, which silently excluded the twelve largest contracts in the register.

## Accepted warnings

Not defects to be fixed — facts about the public record that the project works around and states rather than smooths over.

| check | detail |
|---|---|
| exactly one winner per contract | 26 of 1,293 · 2.0% — (0 winners tracks the null-contractor rows) |
| every bidder carries a PCAB id | 119 of 1,293 · 9.2% — (gaps are unusable for identity, not wrong) |
| awardAmount parses without stripping separators | 57 of 1,274 · 4.5% — (values carry thousands separators — always strip first) |
| date of award <= start date | 1 of 1,293 · 0.1% |

## Every check

| | check | result |
|---|---|---|
| info | rows, flat export | 248,220 |
| info | rows, detail export | 248,421 |
| PASS | detail has no duplicate contractId | 248,421 / 248,421  (100.0%) |
| PASS | every flat contract exists in detail | 248,220 / 248,220  (100.0%) |
| info | contracts only in detail | 201 |
| info | contracts in slice | 1,293 |
| PASS | agree on budget | 1,293 / 1,293  (100.0%) |
| PASS | agree on amountPaid | 1,293 / 1,293  (100.0%) |
| PASS | agree on progress | 1,293 / 1,293  (100.0%) |
| PASS | agree on status | 1,293 / 1,293  (100.0%) |
| PASS | agree on contractor | 1,293 / 1,293  (100.0%) |
| PASS | agree on latitude | 1,293 / 1,293  (100.0%) |
| PASS | agree on longitude | 1,293 / 1,293  (100.0%) |
| PASS | agree on infraYear | 1,293 / 1,293  (100.0%) |
| PASS | every contract has at least one bidder | 1,293 / 1,293  (100.0%) |
| PASS | at most one winner per contract | 1,293 / 1,293  (100.0%) |
| WARN | exactly one winner per contract | 1,267 / 1,293  (98.0%) |
| WARN | every bidder carries a PCAB id | 1,174 / 1,293  (90.8%) |
| PASS | abc parses without stripping separators | 1,293 / 1,293  (100.0%) |
| WARN | awardAmount parses without stripping separators | 1,217 / 1,274  (95.5%) |
| PASS | abc present and positive | 1,293 / 1,293  (100.0%) |
| PASS | awardAmount <= abc | 1,293 / 1,293  (100.0%) |
| PASS | bid-to-ABC ratio within 0.5-1.0 | 1,293 / 1,293  (100.0%) |
| PASS | advertisement <= bid deadline | 1,293 / 1,293  (100.0%) |
| PASS | bid deadline <= date of award | 1,293 / 1,293  (100.0%) |
| WARN | date of award <= start date | 1,292 / 1,293  (99.9%) |
| PASS | start <= completion | 1,293 / 1,293  (100.0%) |
| info | budget matches abc | 671 (52.7%) |
| info | budget matches awardAmount | 577 (45.3%) |
| info | budget matches neither | 26 |
| info | advertisement published | 1,217 / 1,293 (94.1%) |
| info | contractAgreement published | 1,237 / 1,293 (95.7%) |
| info | noticeOfAward published | 1,245 / 1,293 (96.3%) |
| info | noticeToProceed published | 1,237 / 1,293 (95.7%) |
| info | programOfWork published | 0 / 1,293 ( 0.0%) |
| info | engineeringDesign published | 0 / 1,293 ( 0.0%) |

## Tiers that report their own accuracy

Two tiers were built so their error rate could be measured against something already known, at no annotation cost. Both numbers are recomputed by their pipelines, not typed here.

### Document OCR

The contract price appears inside each scan **and** in the structured export, so every document carries its own test.

- price read from **362 of 419** documents that parsed
- matched the export within one peso on **352 of 362** = **97.2%**
- parse completeness: median **18%** of contract value, best **86%**, never 90%

The completeness figure is exact rather than estimated: a Bill of Quantities sums to the contract price by construction, so parsed-rows over price *is* the coverage.

### Satellite change detection — a reported null result

- fires on **6/102 (5.9%)** of flagged contracts
- fires on **3/39 (7.7%)** of seeded controls
- discriminates: **False**

Statistically indistinguishable. The tier has **no measured ability** to tell a flagged contract from an ordinary one, it says so on its own screen, and its verdicts are excluded from every score in the project. See [`METHODS.md`](METHODS.md).

---

*Generated 2026-08-19 from `data-quality.json` (built 2026-08-04). Regenerate with `python3 data-docs/build_quality.py`.*
