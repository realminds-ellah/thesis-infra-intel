# Background research — July 2026

This folder is the **topic-selection and proposal phase** of the thesis, before
MASID existed and before any data had been acquired. Nothing here has been edited
to agree with what was later measured. That is deliberate.

## Why it is kept

The thesis argues that its findings are credible because assumptions were tested
rather than asserted. That argument only works if the assumptions are still on
record. This folder is the record.

| File | What it is |
|---|---|
| `README.md` | The original satellite-only proposal, with a banner listing the three claims that did not survive measurement |
| `TOPIC-BANK.md` | Ten emerging-tech candidate topics, fact-checked, for the three-topic panel proposal |
| `IDEAS.md` | Five ranked thesis ideas at the disaster × governance intersection |
| `FUSION.md` | The spec for fusing procurement red flags with satellite delivery. Its planned join key turned out not to exist |
| `TITLES.md` | Every candidate title considered |
| `RESEARCH-LOG.md` | Running index of every direction explored, nothing deleted |
| `SIGNIFICANCE.md` | Impact, users, product ladder, and the honest limits as understood at the time |
| `criteria.yaml` · `audit.py` · `power/` | The pre-data feasibility harness — verifiable-type thresholds, and a validation-set power analysis (Clopper-Pearson recall intervals, Hanley-McNeil AUC standard errors) putting the label requirement at roughly 30 + 30 |

## What this phase got right

The **legal guard** was written here, before any code existed that could breach
it: no detectable structure never means fraud. It has never been relaxed, and it
is why every flag in the shipped system is worded as *the record disagrees with
itself*.

The **power analysis** was run before a single label was collected, so the label
budget was a number rather than a hope. That number is still the target.

The decision to **upgrade from satellite-only to fusion** is the reason the
project survived its own null result — when the imagery tier failed, there were
two other tiers already specified.

## What this phase got wrong

Three claims in `README.md` were later measured and did not hold: that free
satellite imagery could detect these structures, that the recorded coordinates
were falsified, and that a validated set of roughly 21 COA cases was available to
train against. See the banner on that file and `../FINDINGS.md`.

None of these were careless. Each was the reasonable reading of the public
reporting at the time. They are wrong in the specific way that only measurement
reveals, which is the point.
