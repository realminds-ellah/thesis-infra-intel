#!/usr/bin/env python3
"""
Check the emitted data against contract.yaml, and fail when they disagree.

WHY THIS EXISTS RATHER THAN JUST A DOCUMENT

A data dictionary that is written once and never checked is worth very little:
it describes what somebody believed at the time, and it rots silently the first
time a pipeline gains a field. That is not a defensible artefact — it is a claim
about the data with nothing holding it to account.

So the dictionary here is GENERATED from a contract, and the contract is
ENFORCED by this script. Add a field to a pipeline without documenting it and
this fails. Change a type, or start emitting nulls in a column declared
non-nullable, and this fails. The documentation cannot drift from the data
without somebody being told.

WHAT IT CHECKS

  1. every emitted dataset appears in the contract, and every contracted
     dataset exists on disk
  2. every field present in the data is documented — an undocumented field is a
     FAILURE, not a warning, because that is exactly how drift starts
  3. declared types match observed types
  4. nullability: a field declared `nullable: false` containing nulls fails; a
     field declared nullable with a `nulls:` count is warned when it moves,
     since that usually means the upstream export changed under us
  5. row counts against `expect_rows`
  6. referential integrity — every id in the joined datasets exists in
     projects.json
  7. writes MANIFEST.json: row count and sha256 per dataset, so a figure quoted
     in the thesis can be tied to the exact build that produced it

Reporting follows pipeline/verify_data.py — PASS / WARN / FAIL, non-zero exit on
any failure — so this reads as part of the same gate rather than a bolt-on.

USAGE
  python3 data-docs/validate.py
  python3 data-docs/validate.py --quiet     # only failures and the verdict
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

try:
    import yaml
except ImportError:                                    # pragma: no cover
    print("needs pyyaml:  python3 -m pip install pyyaml", file=sys.stderr)
    raise SystemExit(2)

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CONTRACT = HERE / "contract.yaml"
MANIFEST = HERE / "MANIFEST.json"

# Nulls move when the upstream export is refreshed. That is expected and is not
# a failure — but a large move means something changed under us and should be
# looked at rather than absorbed silently.
NULL_DRIFT_TOLERANCE = 0.02


class Report:
    def __init__(self, quiet: bool = False):
        self.fails: list[str] = []
        self.warns: list[str] = []
        self.quiet = quiet

    def ok(self, msg: str) -> None:
        if not self.quiet:
            print(f"  PASS  {msg}")

    def warn(self, msg: str) -> None:
        self.warns.append(msg)
        print(f"  WARN  {msg}")

    def fail(self, msg: str) -> None:
        self.fails.append(msg)
        print(f"  FAIL  {msg}")

    def info(self, msg: str) -> None:
        if not self.quiet:
            print(f"        {msg}")


def observed_type(v: object) -> str | None:
    """None means the value is null — nullability is tracked separately."""
    if v is None:
        return None
    if isinstance(v, bool):
        return "bool"
    if isinstance(v, int):
        return "int"
    if isinstance(v, float):
        return "float"
    if isinstance(v, str):
        return "str"
    if isinstance(v, list):
        return "list"
    if isinstance(v, dict):
        return "obj"
    return "?"


def compatible(declared: str, seen: set[str]) -> bool:
    """
    An int is an acceptable float.

    JSON has one number type, so a float column whose values all happen to be
    whole — a length of exactly 780 — comes back as int. Refusing that would
    make the contract fail on arithmetic rather than on drift.
    """
    if not seen:
        return True
    allowed = {declared}
    if declared == "float":
        allowed.add("int")
    return seen <= allowed


def records(doc: object, path: str | None) -> list[dict]:
    if path in (None, "null"):
        return []
    if path == "(root array)":
        return doc if isinstance(doc, list) else []
    if isinstance(doc, dict):
        v = doc.get(path)
        return v if isinstance(v, list) else []
    return []


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    contract = yaml.safe_load(CONTRACT.read_text())
    data_dir = ROOT / contract["meta"]["data_dir"]
    datasets = contract["datasets"]
    r = Report(args.quiet)

    print(f"VALIDATING {data_dir.relative_to(ROOT)} AGAINST data-docs/contract.yaml\n")

    # ── 1. the two sides agree on which datasets exist ───────────────────────
    on_disk = {p.name for p in data_dir.glob("*.json")}
    contracted = set(datasets)
    for missing in sorted(contracted - on_disk):
        r.fail(f"{missing}: in the contract, not on disk")
    for extra in sorted(on_disk - contracted):
        r.fail(f"{extra}: emitted but not in the contract — document it or stop emitting it")
    if contracted == on_disk:
        r.ok(f"{len(on_disk)} datasets, contract and disk agree")

    manifest: dict[str, dict] = {}
    ids_by_dataset: dict[str, set[str]] = {}
    total_fields = 0

    # ── 2-5. per dataset ─────────────────────────────────────────────────────
    for name in sorted(contracted & on_disk):
        spec = datasets[name]
        raw = (data_dir / name).read_bytes()
        doc = json.loads(raw)
        rows = records(doc, spec.get("record_path"))
        fields = spec.get("fields") or {}

        manifest[name] = {
            "rows": len(rows),
            "bytes": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest(),
            "emitted_by": spec.get("emitted_by"),
        }
        if rows and "id" in (rows[0] if rows else {}):
            ids_by_dataset[name] = {x["id"] for x in rows if isinstance(x.get("id"), str)}

        if not fields:
            r.info(f"{name}: summary object, no per-record contract")
            continue

        print(f"\n{name}  ({len(rows)} rows)")
        total_fields += len(fields)

        # row count
        want = spec.get("expect_rows")
        if want is not None:
            if len(rows) == want:
                r.ok(f"rows = {want}")
            else:
                r.fail(f"rows = {len(rows)}, contract says {want}")

        # observe
        seen_types: dict[str, set[str]] = {}
        null_count: dict[str, int] = {}
        present: dict[str, int] = {}
        for rec in rows:
            for k, v in rec.items():
                present[k] = present.get(k, 0) + 1
                t = observed_type(v)
                if t is None:
                    null_count[k] = null_count.get(k, 0) + 1
                else:
                    seen_types.setdefault(k, set()).add(t)

        # undocumented fields are a failure — this is the drift check
        undocumented = sorted(set(present) - set(fields))
        for k in undocumented:
            r.fail(f"{name}.{k}: emitted but undocumented — add it to contract.yaml")
        if not undocumented and fields:
            r.ok(f"all {len(present)} emitted fields documented")

        for k, spec_f in fields.items():
            if k not in present:
                if spec_f.get("optional"):
                    continue
                r.fail(f"{name}.{k}: documented but never emitted")
                continue

            # type
            declared = str(spec_f.get("type", "?"))
            if not compatible(declared, seen_types.get(k, set())):
                r.fail(f"{name}.{k}: declared {declared}, saw {sorted(seen_types.get(k, set()))}")

            # nullability
            n = null_count.get(k, 0)
            if n and not spec_f.get("nullable", False):
                r.fail(f"{name}.{k}: declared non-nullable, found {n} nulls")
            declared_nulls = spec_f.get("nulls")
            if declared_nulls is not None and rows:
                drift = abs(n - declared_nulls) / max(1, len(rows))
                if drift > NULL_DRIFT_TOLERANCE:
                    r.warn(f"{name}.{k}: nulls moved {declared_nulls} → {n} "
                           f"({drift:.1%} of rows) — upstream may have changed")

            # origin is required, and must be one of the three
            origin = spec_f.get("origin")
            if origin not in {"published", "derived", "joined"}:
                r.fail(f"{name}.{k}: origin must be published|derived|joined, got {origin!r}")

    # ── 6. referential integrity ─────────────────────────────────────────────
    print("\nreferential integrity")
    joins = contract.get("joins", {})
    for parent, jspec in joins.items():
        parent_ids = ids_by_dataset.get(parent, set())
        if not parent_ids:
            r.fail(f"{parent}: no ids to join against")
            continue
        for child in jspec.get("referenced_by", []):
            child_ids = ids_by_dataset.get(child, set())
            orphans = child_ids - parent_ids
            if orphans:
                r.fail(f"{child}: {len(orphans)} ids not in {parent}, e.g. {sorted(orphans)[:3]}")
            else:
                r.ok(f"{child}: all {len(child_ids)} ids exist in {parent}")

    # ── 7. manifest ──────────────────────────────────────────────────────────
    MANIFEST.write_text(json.dumps({
        "generated": datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "contract_version": contract["meta"]["contract_version"],
        "note": ("Row counts and checksums for the build these figures came from. "
                 "A number quoted anywhere in this project can be tied to a sha256 here."),
        "datasets": manifest,
    }, indent=1) + "\n")

    # ── verdict ──────────────────────────────────────────────────────────────
    print(f"\n{'─' * 68}")
    print(f"{len(manifest)} datasets · {total_fields} documented fields · "
          f"{sum(m['rows'] for m in manifest.values()):,} rows")
    print(f"wrote {MANIFEST.relative_to(ROOT)}")
    if r.fails:
        print(f"\nVERDICT: FAIL — {len(r.fails)} problem(s). The contract and the data disagree.")
        return 1
    if r.warns:
        print(f"\nVERDICT: PASS with {len(r.warns)} warning(s).")
        return 0
    print("\nVERDICT: PASS — every emitted field is documented and matches its contract.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
