#!/usr/bin/env python3
"""
Generate DICTIONARY.md from contract.yaml.

The dictionary is NEVER hand-edited. If it were, it would be a second place
where the truth is written down, and second places drift. `contract.yaml` is
the source; this renders it; `validate.py` enforces it against the data.

Run after any contract change:

    python3 data-docs/build_dictionary.py
    python3 data-docs/validate.py
"""

from __future__ import annotations

import sys
from datetime import UTC, datetime
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent
CONTRACT = HERE / "contract.yaml"
OUT = HERE / "DICTIONARY.md"

ORIGIN_MARK = {
    "published": "**pub**",
    "derived": "*der*",
    "joined": "join",
}


def main() -> int:
    c = yaml.safe_load(CONTRACT.read_text())
    ds = c["datasets"]

    total_fields = sum(len(s.get("fields") or {}) for s in ds.values())
    by_origin: dict[str, int] = {}
    for s in ds.values():
        for f in (s.get("fields") or {}).values():
            o = f.get("origin", "?")
            by_origin[o] = by_origin.get(o, 0) + 1

    L: list[str] = []
    L.append("# Data dictionary")
    L.append("")
    L.append("<!-- GENERATED FROM contract.yaml BY build_dictionary.py — DO NOT EDIT -->")
    L.append("")
    L.append(f"Every field this project emits: **{total_fields} fields across "
             f"{len(ds)} datasets**. Generated from `contract.yaml`, which "
             f"`validate.py` enforces against the data on every run.")
    L.append("")
    L.append("## How to read the origin column")
    L.append("")
    L.append("This is the column to read first, and the one a reviewer should press on.")
    L.append("")
    L.append("| | | count |")
    L.append("|---|---|---|")
    L.append(f"| **pub** | **Published.** The value as DPWH or PhilGEPS published it, "
             f"passed through unchanged. If this is wrong, the government's record is wrong. "
             f"| {by_origin.get('published', 0)} |")
    L.append(f"| *der* | *Derived.* Computed by this project from published values. "
             f"If this is wrong, **we** are wrong — so the derivation is named. "
             f"| {by_origin.get('derived', 0)} |")
    L.append(f"| join | **Joined.** From a third-party dataset — boundaries, flood hazard, "
             f"waterways, imagery metadata — and attributable to it. "
             f"| {by_origin.get('joined', 0)} |")
    L.append("")
    L.append("Provenance, licences and the reasoning behind each source are in "
             "[`../SOURCES.md`](../SOURCES.md). This file describes shape and meaning only.")
    L.append("")
    L.append("---")
    L.append("")

    for name in sorted(ds):
        spec = ds[name]
        fields = spec.get("fields") or {}
        L.append(f"## `{name}`")
        L.append("")
        desc = " ".join((spec.get("description") or "").split())
        if desc:
            L.append(desc)
            L.append("")
        bits = []
        if spec.get("expect_rows") is not None:
            bits.append(f"**{spec['expect_rows']:,} rows**")
        if spec.get("record_path"):
            bits.append(f"records at `{spec['record_path']}`")
        if spec.get("emitted_by"):
            bits.append(f"emitted by `{spec['emitted_by']}`")
        if bits:
            L.append(" · ".join(bits))
            L.append("")

        if not fields:
            L.append("*Summary object — no per-record contract.*")
            L.append("")
            continue

        L.append("| field | type | null | origin | meaning |")
        L.append("|---|---|---|---|---|")
        for fn, f in fields.items():
            t = f.get("type", "?")
            if f.get("unit"):
                t += f" · {f['unit']}"
            if f.get("nullable"):
                n = f"yes ({f['nulls']:,})" if f.get("nulls") is not None else "yes"
            elif f.get("optional"):
                n = "optional"
            else:
                n = "no"
            note = " ".join((f.get("note") or "").split())
            if f.get("source"):
                note = f"*{f['source']}.* {note}".strip()
            L.append(f"| `{fn}` | {t} | {n} | {ORIGIN_MARK.get(f.get('origin'), '?')} | {note} |")
        L.append("")

    joins = c.get("joins", {})
    if joins:
        L.append("---")
        L.append("")
        L.append("## Joins")
        L.append("")
        for parent, j in joins.items():
            L.append(f"`{parent}` on `{j['key']}` is referenced by "
                     + ", ".join(f"`{x}`" for x in j["referenced_by"]) + ".")
            L.append("")
            L.append("`validate.py` checks every one of those ids exists in the parent, "
                     "so a dataset cannot quietly describe a contract that is not in the register.")
            L.append("")

    L.append("---")
    L.append("")
    L.append(f"*Generated {datetime.now(UTC).strftime('%Y-%m-%d')} from "
             f"`contract.yaml` v{c['meta']['contract_version']}. "
             f"Regenerate with `python3 data-docs/build_dictionary.py`.*")
    L.append("")

    OUT.write_text("\n".join(L))
    print(f"wrote {OUT.name}: {total_fields} fields, {len(ds)} datasets")
    print(f"  published {by_origin.get('published', 0)} · "
          f"derived {by_origin.get('derived', 0)} · joined {by_origin.get('joined', 0)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
