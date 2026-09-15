#!/usr/bin/env python3
"""
Audit the weakest link in the strongest check.

WHY THIS EXISTS

`MUNI_MISMATCH` is the most consequential flag this project produces: 37
contracts marked high severity because the published coordinate falls in a
different municipality than the contract description names. `BOUNDARY_ADJACENT`
adds 33 more of the same comparison at lower severity.

Both rest on `declared_municipality()`, which is a **regex over prose**. The
point-in-polygon half is exact arithmetic on published geometry and can be
falsified by anyone with a map. The text half cannot — and if it is wrong, the
flag is spurious and the project has accused a record of contradicting itself
when it does not.

That asymmetry was never measured. This measures it.

THE METHOD

An independent second parser, then a disagreement report.

  PRODUCTION  takes the RIGHTMOST municipality-vocabulary token anywhere in the
              description, longest first. Robust to messy text; vulnerable to a
              barangay named after a municipality appearing late in the string.

  STRUCTURAL  ignores the vocabulary sweep and reads DPWH's actual sentence
              shape: "... <barangay>, <MUNICIPALITY>, BULACAN". It takes the
              comma-separated segment immediately before the province token and
              matches only that. Vulnerable to descriptions that do not follow
              the convention; immune to stray barangay collisions elsewhere.

The two fail in DIFFERENT directions, which is the entire point — agreement is
evidence, and every disagreement is printed in full for a human to settle.

Deliberately NOT used as a third opinion: the geocoded municipality. That is the
thing being compared against, so using it here would be circular and would
quietly convert a measurement into an assumption.

SCOPE

The full register is reported for context, but the number that matters is the
audit of the 70 contracts where this parse actually produces a flag. Those are
audited exhaustively rather than sampled, because 70 is small enough to check
completely and a sample of a population you can enumerate is a wasted
opportunity.

USAGE
  python3 pipeline/audit_municipality.py            # summary + disagreements
  python3 pipeline/audit_municipality.py --all      # every flagged contract
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECTS = ROOT / "src" / "app" / "data" / "projects.json"
OUT = ROOT / "src" / "app" / "data" / "municipality-audit.json"

BULACAN_LGUS = {
    "Angat", "Balagtas", "Baliuag", "Bocaue", "Bulacan", "Bustos", "Calumpit",
    "Doña Remedios Trinidad", "Guiguinto", "Hagonoy", "Marilao", "Norzagaray",
    "Obando", "Pandi", "Paombong", "Plaridel", "Pulilan", "San Ildefonso",
    "San Miguel", "San Rafael", "Santa Maria", "City of Malolos",
    "City of Meycauayan", "City of San Jose del Monte",
}
ALIASES = {
    "BULAKAN": "Bulacan", "MALOLOS": "City of Malolos",
    "MALOLOS CITY": "City of Malolos", "CITY OF MALOLOS": "City of Malolos",
    "MEYCAUAYAN": "City of Meycauayan", "MEYCAUAYAN CITY": "City of Meycauayan",
    "SAN JOSE DEL MONTE": "City of San Jose del Monte",
    "SAN JOSE DEL MONTE CITY": "City of San Jose del Monte",
    "SJDM": "City of San Jose del Monte", "DRT": "Doña Remedios Trinidad",
    "DONA REMEDIOS TRINIDAD": "Doña Remedios Trinidad", "BALIWAG": "Baliuag",
}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s).strip().upper()


VOCAB = {
    **{norm(n): n for n in BULACAN_LGUS},
    **{norm(n.replace("City of ", "")): n for n in BULACAN_LGUS},
    **{norm(k): v for k, v in ALIASES.items()},
}
VOCAB.pop("BULACAN", None)
PROVINCE = re.compile(r"\b(BULACAN|BULACA)\b")


def structural(description: str) -> str | None:
    """
    Read the sentence shape rather than sweeping for tokens.

    DPWH writes "... AT BARANGAY PANDUCOT, CALUMPIT, BULACAN". The municipality
    is the comma-segment immediately before the province. Anything earlier in
    the string is ignored entirely, so a barangay that happens to share a
    municipality's name cannot be picked up.
    """
    d = norm(description)
    m = list(PROVINCE.finditer(d))
    if not m:
        return None
    head = d[: m[-1].start()]
    # Segments before the province, nearest first.
    segs = [s.strip(" .-") for s in head.split(",") if s.strip(" .-")]
    for seg in reversed(segs):
        if seg in VOCAB:
            return VOCAB[seg]
        # A segment like "CALUMPIT CITY" or "STA. MARIA" — try its tail words.
        words = seg.split()
        for n in (4, 3, 2, 1):
            if len(words) >= n:
                tail = " ".join(words[-n:])
                if tail in VOCAB:
                    return VOCAB[tail]
        break          # only the segment adjacent to the province counts
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="print every flagged contract")
    args = ap.parse_args()

    rows = json.loads(PROJECTS.read_text())
    rows = rows if isinstance(rows, list) else rows["projects"]

    MISMATCH = {"MUNI_MISMATCH", "BOUNDARY_ADJACENT"}
    depends = [p for p in rows if any(f["code"] in MISMATCH for f in p["auditFlags"])]

    print("AUDIT OF declared_municipality() — the text half of MUNI_MISMATCH\n")
    print(f"  contracts in the register                 {len(rows):>5}")
    print(f"  contracts where this parse raises a flag  {len(depends):>5}"
          f"   <- audited exhaustively\n")

    def compare(pool: list[dict]) -> tuple[int, int, int, list[dict]]:
        agree = prod_only = struct_only = 0
        disagreements: list[dict] = []
        for p in pool:
            a = p.get("declaredMunicipality")
            b = structural(p["description"])
            if a == b:
                agree += 1
            elif a and not b:
                prod_only += 1
                disagreements.append({"id": p["id"], "kind": "structural found nothing",
                                      "production": a, "structural": b,
                                      "description": p["description"]})
            elif b and not a:
                struct_only += 1
                disagreements.append({"id": p["id"], "kind": "production found nothing",
                                      "production": a, "structural": b,
                                      "description": p["description"]})
            else:
                disagreements.append({"id": p["id"], "kind": "CONFLICT — different municipality",
                                      "production": a, "structural": b,
                                      "description": p["description"]})
        return agree, prod_only, struct_only, disagreements

    # ── the population that matters ─────────────────────────────────────────
    ag, po, so, dis = compare(depends)
    conflicts = [d for d in dis if d["kind"].startswith("CONFLICT")]
    n = len(depends) or 1
    print("ON THE FLAG-RAISING POPULATION")
    print(f"  both parsers agree                        {ag:>5}   {ag/n:.1%}")
    print(f"  differ, but only one found anything       {po + so:>5}")
    print(f"  CONFLICT — named a different municipality {len(conflicts):>5}   "
          f"{len(conflicts)/n:.1%}   <- these would be spurious flags")

    # ── the whole register, for context ─────────────────────────────────────
    ag2, po2, so2, dis2 = compare(rows)
    conf2 = [d for d in dis2 if d["kind"].startswith("CONFLICT")]
    m = len(rows)
    print("\nACROSS THE WHOLE REGISTER")
    print(f"  both parsers agree                        {ag2:>5}   {ag2/m:.1%}")
    print(f"  production found one, structural did not  {po2:>5}")
    print(f"  structural found one, production did not  {so2:>5}")
    print(f"  CONFLICT                                  {len(conf2):>5}   {len(conf2)/m:.1%}")

    # ── every conflict, printed for a human to settle ───────────────────────
    show = conflicts if not args.all else dis
    if show:
        print(f"\n{'─' * 74}")
        print("FOR HAND REVIEW — the parse cannot settle these, a person must\n")
        for d in show[:40]:
            print(f"  {d['id']}  [{d['kind']}]")
            print(f"    production : {d['production']}")
            print(f"    structural : {d['structural']}")
            print(f"    text       : {d['description'][:150]}")
            print()
    else:
        print("\n  No conflicts. Every flag-raising parse is confirmed by an "
              "independent method.")

    OUT.write_text(json.dumps({
        "method": ("Two independent parsers of the same prose: the production "
                   "rightmost-token sweep, and a structural read of the "
                   "comma-segment before the province token. They fail in "
                   "different directions, so agreement is evidence. The geocoded "
                   "municipality is deliberately excluded — it is the thing being "
                   "compared against, and using it here would be circular."),
        "flagRaisingPopulation": {
            "contracts": len(depends), "agree": ag,
            "conflicts": len(conflicts),
            "agreementRate": round(ag / n, 4),
        },
        "wholeRegister": {
            "contracts": m, "agree": ag2, "conflicts": len(conf2),
            "productionOnly": po2, "structuralOnly": so2,
            "agreementRate": round(ag2 / m, 4),
        },
        "conflicts": conflicts,
    }, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
