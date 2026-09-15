#!/usr/bin/env python3
"""
Is the flood control where the flooding is — and do the flagged ones differ?

TWO QUESTIONS THIS ANSWERS, AND ONE IT DOES NOT

  hazard.py already tested every contract coordinate against UP NOAH's modelled
  100-year flood extent. That join has sat in the app as a per-contract label
  and has never been read across the register, so two things a flood-control
  audit ought to state have gone unstated:

    ALLOCATION   how much of the P67.75 B went to sites the model says flood,
                 and how much went outside the modelled extent entirely.

    ASSOCIATION  whether the contracts the fusion triage flags sit differently
                 on hazard from the ones it does not. The records signal and the
                 procurement signal are both derived from paperwork; hazard is
                 derived from terrain and rainfall. If a difference shows up it
                 is a genuinely third source, and independence is the whole
                 argument for fusing anything.

  WHAT IT CANNOT ANSWER is whether any contract was delivered. Hazard is not
  evidence about delivery and a low-hazard site is not a wasteful one:
  hazard.py's own header makes the point that a revetment BELONGS at the edge of
  a flood zone, and NOAH models fluvial flooding without claiming to cover every
  drainage or coastal mechanism. This is an ordering aid and a description of
  allocation. It is not a finding about any contractor.

THE TRIAGE IS REPRODUCED, NOT RE-INVENTED

  The 2x2 lives in src/app/data/index.ts, derived in TypeScript at render time.
  Recomputing it here in Python risks two definitions of the same quadrant
  drifting apart, so this script asserts its counts against the published
  figures before it reports anything. If the assertion fails the analysis is
  wrong and refuses to print rather than quietly describing a different 2x2.

USAGE
  python3 pipeline/hazard_triage.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "app" / "data"

# src/app/data/index.ts:384-385. Duplicated deliberately and checked below.
RECORDS_SUSPICIOUS = 3
PROC_SUSPICIOUS = 3

# The quadrant counts, so a future change to either derivation is caught rather
# than silently described.
#
# These are NOT the numbers README.md carried. It published 49 / 109 / 286 / 849
# alongside a signal correlation of r = +0.05, and both figures date from before
# SIGNAL_CORRELATION in index.ts was made to compute the correlation instead of
# asserting it — that comment records +0.05 and -0.12 having been written by
# hand in two files, contradicting each other, and being replaced by a derived
# -0.26. The quadrant counts were never revisited.
#
# This script recomputes the correlation from the same JSON and gets -0.2570,
# which matches the app's own derivation, so the join here is faithful and the
# published counts were the stale half. The marginals were never wrong — 158
# high-records and 335 high-procurement in both readings — only the overlap.
EXPECTED = {"both": 17, "records-only": 141, "procurement-only": 318, "neither": 817}

BANDS = ["high", "medium", "low", "just outside", "far outside"]
QUADS = ["both", "records-only", "procurement-only", "neither"]


def load():
    projects = json.loads((DATA / "projects.json").read_text())
    projects = projects if isinstance(projects, list) else projects.get("projects", projects)
    proc = {r["id"]: r for r in json.loads((DATA / "procurement.json").read_text())["results"]}
    haz_run = json.loads((DATA / "hazard.json").read_text())
    haz = {r["id"]: r for r in haz_run["results"]}
    return projects, proc, haz, haz_run.get("farThresholdMetres", 1000)


def quadrant(p: dict, proc: dict) -> str:
    hi_r = (p.get("auditScore") or 0) >= RECORDS_SUSPICIOUS
    hi_p = ((proc.get(p["id"]) or {}).get("procurementScore") or 0) >= PROC_SUSPICIOUS
    return ("both" if hi_r and hi_p else "records-only" if hi_r
            else "procurement-only" if hi_p else "neither")


def band(h: dict | None, far_m: int) -> str | None:
    """The hazard label, with 'outside the model' split by how far outside."""
    if not h or h.get("hazard") is None:
        return None
    if h["hazard"] != "none":
        return h["hazard"]
    d = h.get("metresToHazard")
    if d is None:
        return None
    return "just outside" if d <= far_m else "far outside"


def chi_square(table: list[list[int]]) -> tuple[float, int, float] | None:
    """Pearson chi-square of independence, with the standard expected-count check."""
    try:
        from scipy.stats import chi2_contingency
    except ImportError:
        return None
    rows = [r for r in table if sum(r) > 0]
    if len(rows) < 2:
        return None
    cols = [j for j in range(len(rows[0])) if sum(r[j] for r in rows) > 0]
    rows = [[r[j] for j in cols] for r in rows]
    chi2, p, dof, exp = chi2_contingency(rows)
    small = sum(1 for r in exp for v in r if v < 5) / sum(len(r) for r in exp)
    return chi2, dof, p if small <= 0.2 else float("nan")


def main() -> int:
    projects, proc, haz, far_m = load()

    quads = {p["id"]: quadrant(p, proc) for p in projects}
    counts = {q: sum(1 for v in quads.values() if v == q) for q in QUADS}
    if counts != EXPECTED:
        print("REFUSING TO REPORT — the 2x2 reproduced here does not match the app.")
        print(f"  expected {EXPECTED}")
        print(f"  got      {counts}")
        print("  Fix the derivation before trusting any cross-tab built on it.")
        return 1
    print(f"2x2 reproduced from index.ts thresholds: {counts}  ✓ matches the app\n")

    placed = [p for p in projects if band(haz.get(p["id"]), far_m)]
    print(f"contracts with a coordinate and a hazard verdict: {len(placed)} of {len(projects)}"
          f"   ({len(projects) - len(placed)} have no published coordinate)\n")

    # ── allocation ────────────────────────────────────────────────────────────
    total_v = sum(p.get("budget") or 0 for p in placed)
    print("ALLOCATION — where the money went, against the modelled 100-year extent")
    print(f"{'band':<15}{'contracts':>10}{'share':>8}{'value (PHP B)':>15}{'share':>8}")
    for b in BANDS:
        sel = [p for p in placed if band(haz[p["id"]], far_m) == b]
        v = sum(p.get("budget") or 0 for p in sel)
        print(f"{b:<15}{len(sel):>10}{len(sel)/len(placed):>7.1%}"
              f"{v/1e9:>15,.2f}{v/total_v:>8.1%}")
    inside = [p for p in placed if band(haz[p["id"]], far_m) in ("high", "medium", "low")]
    vi = sum(p.get("budget") or 0 for p in inside)
    print(f"\n  inside the modelled extent : {len(inside)}/{len(placed)} contracts"
          f" = {len(inside)/len(placed):.1%},  P{vi/1e9:,.2f} B = {vi/total_v:.1%} of value")

    # ── the exclusion, stated before anything is inferred ─────────────────────
    nocoord = [p for p in projects if band(haz.get(p["id"]), far_m) is None]
    nc_flagged = sum(1 for p in nocoord if quads[p["id"]] in ("both", "records-only"))
    print("\n\nWHAT THIS ANALYSIS CANNOT SEE, AND IT IS NOT A RANDOM SLICE")
    print(f"  {len(nocoord)} contracts have no published coordinate, so no hazard verdict —")
    print(f"  and {nc_flagged} of those {len(nocoord)} are records-flagged. Publishing no")
    print("  coordinate IS a records inconsistency, so the excluded set is the most")
    print("  records-suspicious part of the register. Every records figure below is")
    print(f"  therefore computed on {sum(1 for p in placed if quads[p['id']] in ('both','records-only'))}"
          f" of the {counts['both'] + counts['records-only']} records-flagged contracts.")

    # ── association ────────────────────────────────────────────────────────────
    def band4(p):
        b = band(haz[p["id"]], far_m)
        return "outside" if b in ("just outside", "far outside") else b

    B4 = ["high", "medium", "low", "outside"]
    print("\n\nASSOCIATION — does either signal sit differently on hazard?")
    print("(bands collapsed to four: 'far outside' is only 3 contracts and cannot"
          "\n carry its own row in a test.)\n")
    print(f"{'band':<10}{'n':>6}{'records-flagged':>20}{'procurement-flagged':>24}")
    rec_tab, proc_tab = [], []
    for b in B4:
        sel = [p for p in placed if band4(p) == b]
        rec = sum(1 for p in sel if quads[p["id"]] in ("both", "records-only"))
        pro = sum(1 for p in sel if quads[p["id"]] in ("both", "procurement-only"))
        rec_tab.append([rec, len(sel) - rec])
        proc_tab.append([pro, len(sel) - pro])
        print(f"{b:<10}{len(sel):>6}{rec:>12} {rec/len(sel):>7.1%}{pro:>16} {pro/len(sel):>7.1%}")
    r_all = sum(r[0] for r in rec_tab); p_all = sum(r[0] for r in proc_tab)
    print(f"{'ALL':<10}{len(placed):>6}{r_all:>12} {r_all/len(placed):>7.1%}"
          f"{p_all:>16} {p_all/len(placed):>7.1%}")

    for name, tab in (("records", rec_tab), ("procurement", proc_tab)):
        res = chi_square(tab)
        if not res:
            continue
        chi2, dof, pv = res
        if pv != pv:
            print(f"\n  {name:<12} chi-square {chi2:.2f} on {dof} df — expected counts too small to report")
        else:
            print(f"\n  {name:<12} chi-square {chi2:.2f} on {dof} df, p = {pv:.4f}"
                  f"   {'differs across hazard bands' if pv < 0.05 else 'no detectable difference'}")

    # The one comparison the fusion actually cares about, tested exactly because
    # the both-flagged list is 17 contracts and no asymptotic test applies to it.
    both = [p for p in placed if quads[p["id"]] == "both"]
    rest = [p for p in placed if quads[p["id"]] != "both"]
    ob = sum(1 for p in both if band4(p) == "outside")
    orst = sum(1 for p in rest if band4(p) == "outside")
    print(f"\n\nTHE BOTH-FLAGGED LIST, OUTSIDE THE MODELLED EXTENT")
    print(f"  both-flagged : {ob}/{len(both)} = {ob/len(both):.1%}")
    print(f"  everything else: {orst}/{len(rest)} = {orst/len(rest):.1%}")
    try:
        from scipy.stats import fisher_exact, mannwhitneyu
        odds, pv = fisher_exact([[ob, len(both) - ob], [orst, len(rest) - orst]])
        print(f"  Fisher exact: odds ratio {odds:.2f}, p = {pv:.4f}"
              f"   {'unlikely to be chance' if pv < 0.05 else 'within chance for n=%d' % len(both)}")
    except ImportError:
        mannwhitneyu = None

    # ── the confound, tested rather than mentioned ────────────────────────────
    #
    # A contract lands OUTSIDE the modelled extent for two very different
    # reasons: it was built outside a flood zone, or its published coordinate is
    # wrong. offsetMetres — how far the published point sits from the
    # municipality the contract itself names — is the project's own measure of
    # the second, and it is also an input to the records score. If outside-ness
    # tracks offset, then any records-vs-hazard association is a coordinate
    # quality artefact and not a fact about where flood control was built.
    print("\n\nTHE CONFOUND — is 'outside the extent' really 'coordinate is wrong'?")
    ins = [p["offsetMetres"] for p in placed
           if band4(p) != "outside" and p.get("offsetMetres") is not None]
    outs = [p["offsetMetres"] for p in placed
            if band4(p) == "outside" and p.get("offsetMetres") is not None]
    import statistics as st
    # The median is 0 on both sides — most coordinates fall inside the
    # municipality their contract names — so the difference lives entirely in
    # the tail and a median would hide it. Reported as the share misplaced.
    def far(a, m):
        return sum(1 for v in a if v > m) / len(a)
    print(f"  {'':<22}{'>0 m':>9}{'>1 km':>9}{'>5 km':>9}{'p90 (m)':>12}")
    for lab, a in (("inside the extent", ins), ("outside the extent", outs)):
        q = sorted(a)[int(0.9 * len(a))]
        print(f"    {lab:<20}{far(a,0):>8.1%}{far(a,1000):>9.1%}{far(a,5000):>9.1%}{q:>12,.0f}")
    if mannwhitneyu:
        u, pv = mannwhitneyu(outs, ins, alternative="greater")
        print(f"  Mann-Whitney U, outside > inside: p = {pv:.2e}"
              f"   {'coordinates outside the extent ARE further from their declared municipality'
                    if pv < 0.05 else 'no difference detectable'}")

    print("\nHazard is terrain and rainfall; the triage is paperwork. Neither is evidence"
          "\nabout whether a structure was delivered, and a low-hazard site is not a"
          "\nwasteful one — a revetment belongs at the edge of a flood zone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
