#!/usr/bin/env python3
"""
Render QUALITY.md from the gate's own machine-readable output.

`pipeline/verify_data.py` already emits `data-quality.json` — 36 checks with
levels and counts — and nobody has ever read it, because it is JSON. This turns
it into the page a reviewer actually opens, without anyone retyping a number.

Run after verify_data.py:

    python3 pipeline/verify_data.py
    python3 data-docs/build_quality.py
"""

from __future__ import annotations

import json
import sys
from datetime import UTC, datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SRC = ROOT / "src" / "app" / "data" / "data-quality.json"
DOCS = ROOT / "src" / "app" / "data" / "documents.json"
SAT = ROOT / "src" / "app" / "data" / "satellite.json"
OUT = HERE / "QUALITY.md"

MARK = {"PASS": "PASS", "WARN": "WARN", "FAIL": "**FAIL**", "INFO": "info"}


def main() -> int:
    q = json.loads(SRC.read_text())
    checks = q["checks"]
    by = {}
    for c in checks:
        by[c["level"]] = by.get(c["level"], 0) + 1

    L: list[str] = []
    L.append("# Data quality")
    L.append("")
    L.append("<!-- GENERATED FROM src/app/data/data-quality.json BY build_quality.py — DO NOT EDIT -->")
    L.append("")
    L.append("The gate's own results, rendered. `pipeline/verify_data.py` runs **before "
             "every other pipeline** and refuses to pass the build on a FAIL.")
    L.append("")
    L.append("It exists because this project once shipped a tier built on an unchecked "
             "assumption about what a column meant, and a screen built on a claim that "
             "turned out to be false. Both would have been caught by running it.")
    L.append("")
    L.append("| level | count | meaning |")
    L.append("|---|---|---|")
    L.append(f"| PASS | {by.get('PASS', 0)} | the check ran and the data satisfied it |")
    L.append(f"| WARN | {by.get('WARN', 0)} | known and accepted — listed in full below, never hidden |")
    L.append(f"| info | {by.get('INFO', 0)} | a counted fact, not a judgement |")
    L.append(f"| **FAIL** | {by.get('FAIL', 0)} | would stop the build |")
    L.append("")

    L.append("## The check that matters most")
    L.append("")
    spot = q.get("primarySourceSpotCheck")
    if spot:
        L.append("Anyone can build a dashboard on a mirror and never learn whether the mirror "
                 "is faithful. So one contract is checked against the **government's own "
                 "published PDF**, by hand, to the centavo:")
        L.append("")
        L.append("| | |")
        L.append("|---|---|")
        for k, v in spot.items():
            L.append(f"| {k} | {v} |")
        L.append("")
        L.append("One spot check is not a guarantee. It is the difference between trusting a "
                 "mirror and having tested it.")
        L.append("")

    sem = q.get("budgetSemantics")
    if sem:
        L.append("## What `budget` actually means")
        L.append("")
        L.append("| | |")
        L.append("|---|---|")
        for k, v in sem.items():
            L.append(f"| {k} | {v:.1%} |" if isinstance(v, float) else f"| {k} | {v} |")
        L.append("")
        L.append("This is why the interface reads `abc` and `awardAmount` rather than "
                 "`budget`. An earlier version filtered on `budget`, which silently "
                 "excluded the twelve largest contracts in the register.")
        L.append("")

    # ── warnings first: they are the ones a reviewer should see ──────────────
    warns = [c for c in checks if c["level"] == "WARN"]
    if warns:
        L.append("## Accepted warnings")
        L.append("")
        L.append("Not defects to be fixed — facts about the public record that the project "
                 "works around and states rather than smooths over.")
        L.append("")
        L.append("| check | detail |")
        L.append("|---|---|")
        for c in warns:
            bits = []
            if c.get("violations") is not None and c.get("total"):
                bits.append(f"{c['violations']:,} of {c['total']:,}")
            if c.get("rate") is not None:
                bits.append(f"{c['rate']:.1%}")
            note = " ".join((c.get("note") or "").split())
            detail = " · ".join(bits)
            L.append(f"| {c['check']} | {detail}{' — ' + note if note else ''} |")
        L.append("")

    L.append("## Every check")
    L.append("")
    L.append("| | check | result |")
    L.append("|---|---|---|")
    for c in checks:
        if c.get("value") is not None:
            res = str(c["value"])
        elif c.get("total"):
            v = c.get("violations", 0)
            res = f"{c['total'] - v:,} / {c['total']:,}"
            if c.get("rate") is not None:
                res += f"  ({1 - c['rate']:.1%})"
        else:
            res = ""
        L.append(f"| {MARK.get(c['level'], c['level'])} | {c['check']} | {res} |")
    L.append("")

    # ── tiers that evaluate themselves ───────────────────────────────────────
    L.append("## Tiers that report their own accuracy")
    L.append("")
    L.append("Two tiers were built so their error rate could be measured against something "
             "already known, at no annotation cost. Both numbers are recomputed by their "
             "pipelines, not typed here.")
    L.append("")

    if DOCS.exists():
        d = json.loads(DOCS.read_text()).get("corpus", {})
        if d:
            pr, px = d.get("priceReadable", 0), d.get("priceExact", 0)
            L.append("### Document OCR")
            L.append("")
            L.append(f"The contract price appears inside each scan **and** in the structured "
                     f"export, so every document carries its own test.")
            L.append("")
            L.append(f"- price read from **{pr} of {d.get('withBoQ', 0)}** documents that parsed")
            L.append(f"- matched the export within one peso on **{px} of {pr}** "
                     f"= **{px / pr:.1%}**" if pr else "")
            L.append(f"- parse completeness: median **{d.get('coverageMedian', 0):.0%}** of "
                     f"contract value, best **{d.get('coverageBest', 0):.0%}**, never 90%")
            L.append("")
            L.append("The completeness figure is exact rather than estimated: a Bill of "
                     "Quantities sums to the contract price by construction, so parsed-rows "
                     "over price *is* the coverage.")
            L.append("")

    if SAT.exists():
        v = json.loads(SAT.read_text()).get("validation", {})
        if v:
            f_, c_ = v.get("flagged", {}), v.get("control", {})
            L.append("### Satellite change detection — a reported null result")
            L.append("")
            L.append(f"- fires on **{f_.get('detections')}/{f_.get('assessed')} "
                     f"({f_.get('rate', 0):.1%})** of flagged contracts")
            L.append(f"- fires on **{c_.get('detections')}/{c_.get('assessed')} "
                     f"({c_.get('rate', 0):.1%})** of seeded controls")
            L.append(f"- discriminates: **{v.get('discriminates')}**")
            L.append("")
            L.append("Statistically indistinguishable. The tier has **no measured ability** to "
                     "tell a flagged contract from an ordinary one, it says so on its own "
                     "screen, and its verdicts are excluded from every score in the project. "
                     "See [`METHODS.md`](METHODS.md).")
            L.append("")

    L.append("---")
    L.append("")
    L.append(f"*Generated {datetime.now(UTC).strftime('%Y-%m-%d')} from "
             f"`data-quality.json` (built {q.get('generated', '?')[:10]}). "
             f"Regenerate with `python3 data-docs/build_quality.py`.*")
    L.append("")

    OUT.write_text("\n".join(L))
    print(f"wrote {OUT.name}: {len(checks)} checks "
          f"({by.get('PASS', 0)} pass, {by.get('WARN', 0)} warn, {by.get('INFO', 0)} info)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
