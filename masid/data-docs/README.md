# Data documentation

Everything about how MASID handles data, in one place — written so a thesis
panel can be convinced by it and a successor engineer can rebuild from it.

**The governing idea: documentation that can drift is not defensible.** So the
centrepiece here is not a document. It is a **contract that a script enforces**.
Add a field to a pipeline without documenting it, change a type, or start
emitting nulls in a column declared non-nullable, and `validate.py` fails with a
non-zero exit.

```bash
python3 data-docs/validate.py
# VERDICT: PASS — every emitted field is documented and matches its contract.
```

---

## What is here

| file | | |
|---|---|---|
| **[`contract.yaml`](contract.yaml)** | **the source of truth** | 129 fields across 13 datasets: type, nullability, unit, origin, meaning. Hand-authored. Everything else derives from it. |
| **[`validate.py`](validate.py)** | **the enforcement** | Checks the emitted JSON against the contract. Fails on undocumented fields, type drift, null violations, row-count changes and broken joins. Writes `MANIFEST.json`. |
| [`DICTIONARY.md`](DICTIONARY.md) | generated | Every field, readable. Never hand-edited — `build_dictionary.py` renders it. |
| [`METHODS.md`](METHODS.md) | authored | Why each threshold is the number it is. Severity weights, the 300 m boundary tolerance, the bootstrap null, the 96.00% comparison, the OCR evaluation. |
| [`LIMITATIONS.md`](LIMITATIONS.md) | authored | 33 known limits, **each with a measured size**. |
| [`LINEAGE.md`](LINEAGE.md) | authored | Source → pipeline → dataset, what breaks if a source disappears, and the fields with no source at all. |
| [`QUALITY.md`](QUALITY.md) | generated | The gate's 36 checks, rendered from `data-quality.json`. |
| [`MANIFEST.json`](MANIFEST.json) | generated | Row counts and sha256 per dataset, so a figure quoted in the thesis ties to the build that produced it. |

**Provenance and licences are not here.** They live in
[`../SOURCES.md`](../SOURCES.md), which is the authority on where data came from
and why each source was chosen. This folder describes **shape, meaning, method
and limits** — and links rather than repeats.

---

## The one column to read first

Every field carries an **origin**, and it is a closed set:

| | | count |
|---|---|---|
| **published** | The value as DPWH or PhilGEPS published it, unchanged. If it is wrong, the government's record is wrong. | **38** |
| **derived** | Computed by this project. If it is wrong, **we** are wrong — so the derivation is named. | **73** |
| **joined** | From a third party — boundaries, flood hazard, waterways, imagery metadata — and attributable to it. | **18** |

More than half the register as presented is our arithmetic. A reviewer is
entitled to know which half, at field level, without reading code.

---

## Regenerating

```bash
python3 data-docs/validate.py           # contract vs data — the gate
python3 data-docs/build_dictionary.py   # DICTIONARY.md from contract.yaml
python3 data-docs/build_quality.py      # QUALITY.md from data-quality.json
```

Only `contract.yaml`, `METHODS.md`, `LIMITATIONS.md` and `LINEAGE.md` are
hand-written. The rest is generated, and regenerating produces no diff unless
the data changed.

`validate.py` needs `pyyaml` and nothing else — no new runtime dependency, in
keeping with a project whose whole claim is that anyone can re-run it.

---

## Proof that the enforcement works

A validator never seen to fail is not evidence. All four drift classes were
tested against a copy of the data and each produced a non-zero exit:

| injected | caught as |
|---|---|
| an extra undocumented field | `scope.json.sneakyNewField: emitted but undocumented` |
| a string in an int column | `scope.json.lengthMetres: declared int, saw ['int', 'str']` |
| a null in a non-nullable column | `scope.json.waterwayClass: declared non-nullable, found 1 nulls` |
| an id with no matching contract | `scope.json: 1 ids not in projects.json` |

## What it has already caught

Not hypothetical — four real defects, found while building this:

- **The document tier changed underneath the docs.** The parser was improved and
  re-run; `documents.json` went from 101 shipped contracts to 972, coverage from
  a median 18% to 92%, and recovered dimensions from 209 to 774. Nothing in the
  prose knew. `validate.py` failed on the row count, which is precisely the case
  it exists for — a document would have quietly kept claiming 101.
- **`wayback.resolutionMetres` was a string.** Esri returns `SRC_RES` as
  `"0.5"`, and the pipeline passed it through, shipping a measurement typed as
  text. Now coerced at the pipeline boundary.
- **The `budget` note quoted the wrong percentages** — 55.1/42.7 from memory
  against 52.7/45.3 in the gate's own output. Corrected against the data.
- **`null:` is a YAML keyword.** The first contract used it as a key, which
  parses to the `None` object rather than the string, so every nullability
  declaration was silently ignored. Renamed to `nullable:` — and the validator
  is what surfaced it, by failing on 24 fields that were correctly declared.

---

*Findings: [`../../FINDINGS.md`](../../FINDINGS.md) ·
AI plans: [`../../AI-LAYER.md`](../../AI-LAYER.md) ·
Sources: [`../SOURCES.md`](../SOURCES.md)*
