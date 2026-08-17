#!/usr/bin/env python3
"""
What the paper says should be at the site — read out of the scanned contracts.

THE PROBLEM THIS SOLVES

  1,069 of 1,293 contracts (83%) publish no dimension of any kind in their
  description. A ₱96 M contract might be fifty metres of work or two kilometres,
  and the register does not say. That is FINDINGS.md §1, and it is upstream of
  every other limit in this project: with no quantity, imagery has nothing to be
  checked against.

  The quantities are not missing. They are published — inside 1,237 scanned
  contract agreements that no conventional tool can read.

WHY THESE PDFS DEFEAT NORMAL EXTRACTION

  Tested on 23CC0269: `pdffonts` reports Type 3 fonts with custom encoding and
  NO ToUnicode map, so the glyphs are drawn but nothing maps them back to
  characters; `pdfimages` finds scanned greyscale JPEGs; `pdftotext` returns
  7,659 characters of garbage. The text is visually present and machine-
  unreadable, which is the exact shape of problem OCR exists for.

  Notably this needs no vision-language model and no API key. Plain tesseract
  reads them cleanly, which keeps the tier free, offline and reproducible by
  anyone — the same standard the rest of the pipeline is held to.

WHAT IS EXTRACTED

  The Bill of Quantities: DPWH standard pay items with quantity, unit, unit
  price and amount.

      103(1)a  Structure Excavation, Common Soil   7,183.35 m3  318.00  2,284,305.30
      311(1)h2 PCC Pavement (Reinforced) 0.35m       274.30 m2 4,280.00 1,174,004.00
      404(1)b  Reinforcing Steel, Grade 60       327,722.72 kg    66.55 21,809,947.02

  Each item is then classified by WHETHER IT SURVIVES TO BE PHOTOGRAPHED, which
  is the whole point: it converts a contract into a list of things an inspector
  can actually look for, and an explicit list of things nobody can check without
  opening the structure.

    surface    at the surface when finished — pavement, markings, gratings.
               Measurable in 0.3 m imagery.
    footprint  structural concrete and masonry. The outline is visible from
               above; the thickness and volume are not.
    ground     visible only from beside it — floodgates, culvert outlets, the
               face of a wall. This is what street-level imagery is for.
    buried     under ground or under a surface course when finished.
    inside     cast into the concrete. Reinforcing steel is typically the single
               largest line in these contracts and is invisible forever.
    gone       the item is removal or clearing; nothing remains to see.
    none       not a physical work item — mobilisation, safety, billboards.

  On the one contract worked through by hand (24CC0624, ₱52.1 M) that split came
  out at 3.8% surface, 38.1% footprint and 58.0% invisible to any camera. If
  that holds across the register it is a finding in its own right, and a
  sobering one: most of what is paid for cannot be verified by any imagery at
  any resolution, which is a limit of the work itself and not of the method.

SELF-EVALUATION, AT NO ANNOTATION COST

  The structured export already holds awardAmount for these contracts, and the
  same figure is written inside the scan. Every document therefore carries its
  own test: extract the total, compare, and report exact-match accuracy before
  anybody trusts an extracted quantity. `verify_data.py` established this
  precedent by checking one Notice of Award to the centavo by hand; this
  generalises it to the whole corpus automatically.

USAGE
  python3 pipeline/documents.py --limit 40        # a sample, cached
  python3 pipeline/documents.py --all             # the full 1,237, hours
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import ssl
import subprocess
import sys
import tempfile
import urllib.request
import threading
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from hashlib import sha1
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "app" / "data" / "documents.json"
CACHE = ROOT / "data" / "doc-cache"
PROC = ROOT / "src" / "app" / "data" / "procurement.json"
PROJECTS = ROOT / "src" / "app" / "data" / "projects.json"

DPI = 300
MAX_PAGES = 8

# Below this share of the contract price accounted for, the parsed table is too
# incomplete to put in front of anyone: a list showing one pay item out of
# seventeen reads as "this is the contract" and is worse than showing nothing.
#
# Set at a third rather than at completeness, because measured coverage runs at
# a median of 62% and NOTHING reaches 90%. Two OCR passes recover different rows
# and neither is close to the whole table. So the app shows what was read and
# states the share, rather than either hiding a real partial result or dressing
# it up as the full Bill of Quantities.
MIN_COVERAGE = 0.35

# dcs.infrawatch.ph is a volunteer-run civic mirror, not a CDN. OCR wants every
# core, but pointing eight of them at someone else's server for 1,177 files is
# roughly sixteen requests a second from one client, which is rude and is the
# kind of thing that gets a public archive taken down. Fetching is serialised
# behind a lock with a small gap; it costs almost nothing in wall clock because
# a fetch is 0.5 s against 12 s of OCR, and it keeps this a good citizen of the
# archive it depends on.
FETCH_LOCK = threading.Lock()
FETCH_GAP_S = 0.35

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()


# ── classification ───────────────────────────────────────────────────────────
#
# PRIMARILY BY PAY ITEM CODE, not by description.
#
# The OCR splits these tables across columns, so a description often arrives
# truncated — "Piles, Driven" for "Prestressed Concrete Piles, Driven", or
# "ation" for "Occupational Safety". Classifying on that text would be
# classifying on debris.
#
# The item CODE survives intact, and it is a national standard: DPWH numbers
# every pay item the same way in every contract in the country, so 404 is
# reinforcing steel in Bulacan and in Davao alike. Code first, wording only as
# a fallback for the rows where the code did not survive.
CODE_RULES: list[tuple[str, str]] = [
    (r"^(A\.|B\.)", "none"),          # provisional and indirect: engineer, billboard, safety
    (r"^(101|102)\b", "gone"),         # removal, clearing, demolition
    (r"^(404|902)\b", "inside"),       # reinforcing steel — cast in, invisible forever
    (r"^(1047)\b", "inside"),          # structural steel plate, embedded
    (r"^(103|104|105|200|201|202|203|204|205|206|207|1701|1704)\b", "buried"),
    (r"^(1716)\b", "buried"),          # piles — driven below ground
    (r"^(5\d\d)\b", "buried"),        # 500 series drainage: culverts, pipes
    (r"^(3\d\d)\b", "surface"),       # 300 series surface courses, pavement
    (r"^(6\d\d)\b", "surface"),       # 600 series markings, signs, furniture
    (r"^(1003|1013|1046)\b", "ground"), # railings, grilles, metal work
    (r"^(405|900|801|1712|1713|1714)\b", "footprint"),   # structural concrete, slope protection
]

# Keyed on the wording of DPWH standard pay items. Order matters: the first
# rule that matches wins, so the specific sits above the general.
RULES: list[tuple[str, str]] = [
    (r"mobiliz|demobiliz|occupational safety|health program|billboard|as[- ]built|insurance", "none"),
    (r"removal|demolition|clearing|grubbing|dismantl", "gone"),
    (r"reinforc\w* steel|steel bars?|prestress", "inside"),
    (r"excavat|embankment|borrow|backfill|subgrade|subbase|sub-base|base course|"
     r"lean concrete|filter|geotext|foundation|pile|sheet pile|culvert|pipe|"
     r"drain\w* pipe|bedding", "buried"),
    (r"pavement marking|thermoplastic|grating|manhole cover|curb|gutter|sidewalk|"
     r"pavement|riprap|rip-rap|grouted|paving", "surface"),
    (r"floodgate|flood gate|gate valve|sluice|pumping station|pump|handrail|"
     r"railing|guardrail|signage|sign board|outlet|headwall|wingwall|apron|manhole", "ground"),
    (r"structural concrete|concrete, class|masonry|chb|coping|parapet|revetment|"
     r"slope protection|retaining wall|concrete slope|wall", "footprint"),
]

VISIBILITY_NOTE = {
    "surface":   "at the surface when finished — measurable in 0.3 m imagery",
    "footprint": "outline visible from above; thickness and volume are not",
    "ground":    "visible only from beside it — this is what street level is for",
    "buried":    "under ground or under a surface course when finished",
    "inside":    "cast into the concrete — invisible forever",
    "gone":      "the item is removal; nothing remains to see",
    "none":      "not a physical work item",
}


def classify(description: str, code: str | None) -> str:
    if code:
        c = code.upper().replace(" ", "")
        for pattern, bucket in CODE_RULES:
            if re.match(pattern, c):
                return bucket
    d = description.lower()
    for pattern, bucket in RULES:
        if re.search(pattern, d):
            return bucket
    return "footprint"      # a physical item we could not place; the honest default


# ── fetch + OCR ──────────────────────────────────────────────────────────────
def fetch(url: str) -> Path | None:
    """
    Cached by URL hash. These are large scans; never fetch one twice.

    The cache check is outside the lock so a warm run never serialises, and only
    an actual network round trip waits its turn.
    """
    CACHE.mkdir(parents=True, exist_ok=True)
    dest = CACHE / (sha1(url.encode()).hexdigest() + ".pdf")
    if dest.exists() and dest.stat().st_size > 1000:
        return dest
    try:
        with FETCH_LOCK:
            req = urllib.request.Request(url, headers={"User-Agent": "masid-thesis/1.0"})
            with urllib.request.urlopen(req, timeout=90, context=SSL_CTX) as r:
                data = r.read()
            time.sleep(FETCH_GAP_S)
        if len(data) < 1000:
            return None
        dest.write_bytes(data)
        return dest
    except Exception:
        return None


def rows_from_tsv(png: Path) -> list[str]:
    """
    Rebuild table rows from word coordinates.

    Tesseract's plain text output flattens a table: a row whose description
    wraps, or whose columns are far apart, comes back as separate lines, and a
    line-by-line regex then misses the row entirely. Grouping words by their y
    position reconstructs the visual row regardless of column spacing.

    It is not a replacement for the plain pass — the two recover DIFFERENT rows,
    which is why both are run and the results unioned. Neither alone is close to
    complete.
    """
    out = subprocess.run(["tesseract", str(png), "-", "--psm", "6", "tsv"],
                         capture_output=True, text=True, timeout=300).stdout
    words = []
    for line in out.split("\n")[1:]:
        f = line.split("\t")
        if len(f) < 12 or not f[11].strip():
            continue
        try:
            words.append((int(f[7]), int(f[6]), f[11]))     # y, x, text
        except ValueError:
            continue
    words.sort()
    rows: list[list[tuple[int, int, str]]] = []
    for w in words:
        if rows and abs(w[0] - rows[-1][0][0]) <= 14:
            rows[-1].append(w)
        else:
            rows.append([w])
    return [" ".join(t for _, _, t in sorted(r, key=lambda z: z[1])) for r in rows]


def ocr(pdf: Path) -> str:
    """
    Rasterise then read, twice, and keep both.

    Cached beside the PDF because OCR is by far the slow part — a full run over
    1,237 documents is hours, and nothing here should ever repeat it.
    """
    txt_path = pdf.with_suffix(".txt")
    if txt_path.exists():
        return txt_path.read_text(errors="replace")
    out: list[str] = []
    with tempfile.TemporaryDirectory() as td:
        subprocess.run(["pdftoppm", "-r", str(DPI), "-png", "-f", "1", "-l", str(MAX_PAGES),
                        str(pdf), str(Path(td) / "p")],
                       capture_output=True, timeout=300)
        for png in sorted(Path(td).glob("p*.png")):
            r = subprocess.run(["tesseract", str(png), "-", "--psm", "6"],
                               capture_output=True, text=True, timeout=300)
            out.append(r.stdout)
            out.extend(rows_from_tsv(png))
    text = "\n".join(out)
    txt_path.write_text(text)
    return text


# ── Bill of Quantities ───────────────────────────────────────────────────────
# OCR drops spaces into digit groups — "7 409,560.00" for 7,409,560.00 — so a
# number may contain internal whitespace. Matched here, stripped in num().
NUM = r"[\d][\d,. ]*\d"
UNIT_WORDS = (r"(?:cu\.?|cubic|sq\.?|square|lin\.?|linear)?\s*"
              r"(?:m(?:eter|etre)?s?\.?|l\.?\s?m\.?|kgs?\.?|each|ea\.?|sum|mo\.?|"
              r"bags?|li?t(?:er|re)s?|tons?|pcs?\.?|set)")
# A pay item line ends in three numbers: quantity, unit price, amount, with the
# unit sitting between the first and second. OCR wraps "cubic"/"square" onto the
# previous line often enough that the unit prefix is optional here and recovered
# from context afterwards.
# Codes carry letters and dots as well as digits — A.1.1(8), B.5(1), 902(1)a1,
# 1047(5)d, 1716(12) — so the earlier digits-only pattern missed most rows,
# including the single largest line in a typical contract.
CODE = r"[A-Z]?\.?\d{1,4}(?:\.\d+)*\s*\(\d+\)\s*[a-z0-9_]*"
ITEM = re.compile(
    rf"^\s*\|?\s*(?P<code>{CODE})?\s*\|?\s*(?P<desc>.*?)\s+"
    rf"(?P<qty>{NUM})\s*\|?\s*(?P<unit>{UNIT_WORDS})?\s*\|?\s*"
    rf"(?P<price>{NUM})\s*\|?\s*(?P<amount>{NUM})\s*\|?\s*$",
    re.I)


def num(s: str) -> float | None:
    """
    Parse a peso figure out of OCR.

    THE DECIMAL POINT IS THE WHOLE PROBLEM. On the full corpus this was the
    single largest source of error: a printed "4,850,890.09" is read back as
    "4,850,890,09" often enough that stripping commas blindly turned it into
    485,089,009 — exactly a hundred times too big. Four of the six visible
    mismatches in the first full run were that, to the centavo.

    So the LAST separator is decided on shape rather than on character: if
    exactly two digits follow it, it is the decimal point, whether OCR rendered
    it as a dot or a comma. Every earlier separator is a thousands mark and goes.
    """
    if not s:
        return None
    t = re.sub(r"\s", "", s.strip())
    m = re.search(r"[.,](\d{2})$", t)
    if m:
        head = t[: m.start()]
        return _f(re.sub(r"[.,]", "", head) + "." + m.group(1))
    # No two-digit tail: a whole-peso figure, so every separator is a thousands
    # mark — unless a single dot has 1 or 3+ digits after it, which is a real
    # decimal the printer chose not to pad.
    if t.count(".") == 1 and not re.search(r"\.\d{3}$", t):
        head, _, tail = t.partition(".")
        return _f(head.replace(",", "") + "." + tail)
    return _f(re.sub(r"[.,]", "", t))


def _f(t: str) -> float | None:
    try:
        return float(t)
    except ValueError:
        return None


def parse_boq(text: str) -> list[dict]:
    items: list[dict] = []
    lines = text.split("\n")
    for i, raw in enumerate(lines):
        line = raw.strip()
        if len(line) < 12:
            continue
        m = ITEM.match(line)
        if not m:
            continue
        qty, price, amount = num(m["qty"]), num(m["price"]), num(m["amount"])
        if qty is None or price is None or amount is None:
            continue
        # The arithmetic is the filter. A real BoQ row multiplies out; an OCR
        # misread of a paragraph almost never does. 2% tolerance absorbs
        # rounding in the printed total and the odd misread digit.
        if amount <= 0 or qty <= 0 or abs(qty * price - amount) > max(2.0, amount * 0.02):
            continue
        desc = re.sub(r"\s+", " ", (m["desc"] or "")).strip(" |.")
        if len(desc) < 3:
            continue
        unit = (m["unit"] or "").strip().lower()
        prev = lines[i - 1].strip().lower() if i else ""
        if unit.startswith("m") and prev.endswith(("cubic", "square", "linear")):
            unit = prev.split()[-1] + " " + unit
        if any(abs(x["amount"] - amount) < 0.01 for x in items):
            continue      # the same row recovered by both OCR passes
        items.append({
            "code": re.sub(r"\s+", "", m["code"] or "") or None,
            "description": desc[:90],
            "quantity": round(qty, 2),
            "unit": unit or None,
            "unitPrice": round(price, 2),
            "amount": round(amount, 2),
            "visibility": classify(desc, m["code"]),
        })
    return items


def stated_price(text: str) -> float | None:
    """
    The contract price the document itself states.

    Taking the first peso figure was wrong: contract agreements quote unit
    prices, bond amounts and retention percentages long before they get to the
    total, so the first match was usually a line item. These documents write the
    total in words and then in figures — "...Pesos and 11/100 (P 74,111,786.11)"
    — so the parenthesised figure after a "Pesos and NN/100" is the reliable
    anchor. Failing that, the largest peso figure on the page, which for a
    contract agreement is the total by construction.
    """
    m = re.search(r"Pesos?\s+and\s+\d{2}\s*/\s*100\s*\(\s*[₱P]?\s*([\d][\d,. ]*\d)\s*\)",
                  text, re.I)
    if m:
        v = num(m.group(1))
        if v:
            return v
    cands = [num(x) for x in re.findall(r"[₱P]\s?([\d][\d,. ]*\.\d{2})", text)]
    cands = [c for c in cands if c]
    return max(cands) if cands else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=40)
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()

    for tool in ("pdftoppm", "tesseract"):
        if not shutil.which(tool):
            print(f"missing {tool} — brew install poppler tesseract", file=sys.stderr)
            return 1

    proc = json.loads(PROC.read_text())["results"]
    rows = json.loads(PROJECTS.read_text())
    rows = rows if isinstance(rows, list) else rows["projects"]
    by_id = {p["id"]: p for p in rows}

    todo = [r for r in proc if (r.get("documents") or {}).get("contractAgreement")]
    # Largest first: if only part of the corpus is read, it should be the part
    # carrying the most public money.
    todo.sort(key=lambda r: -(r.get("awardAmount") or 0))
    if not args.all:
        todo = todo[: args.limit]
    print(f"reading {len(todo)} contract agreements at {DPI} dpi…")

    done = 0
    started = time.time()
    fails: Counter[str] = Counter()
    lock = threading.Lock()

    def one(r: dict) -> dict | None:
        """
        Returns the extraction, or None having recorded WHY.

        The sample run had 19 of 30 documents yield nothing and the cause was
        never established, which made the failure rate uninterpretable — a
        document with no Bill of Quantities in it and a document whose table the
        parser could not read are very different facts. Every exit is counted.
        """
        nonlocal done
        outcome = "ok"
        result: dict | None = None
        try:
            pdf = fetch(r["documents"]["contractAgreement"])
            if not pdf:
                outcome = "fetch failed"
                return None
            try:
                text = ocr(pdf)
            except subprocess.TimeoutExpired:
                outcome = "OCR timed out"
                return None
            except Exception:
                outcome = "OCR failed"
                return None
            if len(text.strip()) < 200:
                outcome = "no text recovered"
                return None
            items = parse_boq(text)
            if not items:
                outcome = "text but no parsable rows"
                return None
            result = build(r, text, items)
            return result
        finally:
            with lock:
                done += 1
                if outcome != "ok":
                    fails[outcome] += 1
                if done % 25 == 0 or done == len(todo):
                    el = time.time() - started
                    rate = done / el if el else 0
                    left = (len(todo) - done) / rate if rate else 0
                    print(f"  {done}/{len(todo)}  {el/60:.1f} min elapsed, "
                          f"~{left/60:.0f} min left", file=sys.stderr, flush=True)

    def build(r: dict, text: str, items: list[dict]) -> dict:
        total = round(sum(i["amount"] for i in items), 2)
        by_vis: dict[str, float] = {}
        for i in items:
            by_vis[i["visibility"]] = round(by_vis.get(i["visibility"], 0) + i["amount"], 2)
        stated = stated_price(text)
        award = r.get("awardAmount")
        # A measured length or area in the paper for a contract whose published
        # description carries no dimension at all. This is the 83% gap closing,
        # counted per contract rather than asserted.
        linear = [i for i in items if i["unit"] and re.search(r"\bm\b|\bl\.?m|met", i["unit"], re.I)]
        return {
            "id": r["id"],
            # How much of the contract the parsed rows actually account for.
            # A Bill of Quantities sums to the contract price by construction, so
            # anything below 1.0 is rows the parser missed — this is the only
            # honest measure of whether the extraction is usable, and the app
            # refuses to display a table below the threshold.
            "coverage": round(total / award, 3) if award else None,
            "items": items,
            "boqTotal": total,
            "statedTotal": stated,
            "awardAmount": r.get("awardAmount"),
            "byVisibility": by_vis,
            "hasMeasuredQuantity": bool(linear),
        }

    def write_out(got: list[dict], partial: bool = False) -> None:
        """
        Emit the file. Called periodically as well as at the end, so an hour of
        work is not lost to a crash at 90% — the OCR cache makes a re-run cheap
        but the aggregation is not free.
        """
        checked = [g for g in got if g["statedTotal"] and g["awardAmount"]]
        exact = [g for g in checked if abs(g["statedTotal"] - g["awardAmount"]) < 1.0]
        agg: dict[str, float] = {}
        for g in got:
            for k, v in g["byVisibility"].items():
                agg[k] = agg.get(k, 0) + v
        cov = sorted(g["coverage"] for g in got if g.get("coverage"))
        recovered = [g for g in got
                     if g.get("hasMeasuredQuantity")
                     and not (by_id.get(g["id"], {}) or {}).get("lengthMetres")]
        no_dim = [r for r in todo if not (by_id.get(r["id"], {}) or {}).get("lengthMetres")]
        shown = [g for g in got if (g.get("coverage") or 0) >= MIN_COVERAGE]
        OUT.write_text(json.dumps({
            "generated": datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z"),
            "partial": partial,
            "source": "DPWH contract agreements (scanned PDFs) via dcs.infrawatch.ph",
            "method": (f"pdftoppm at {DPI} dpi then tesseract --psm 6, twice: plain text and a "
                       "second pass reconstructing rows from word coordinates, unioned. No vision "
                       "model and no API key — these scans are readable by ordinary OCR, which "
                       "keeps the tier free, offline and reproducible."),
            "visibilityNote": VISIBILITY_NOTE,
            "minCoverage": MIN_COVERAGE,
            "corpus": {
                "documentsAttempted": len(todo),
                "withBoQ": len(got),
                "shownInApp": len(shown),
                "priceReadable": len(checked),
                "priceExact": len(exact),
                "coverageMedian": cov[len(cov) // 2] if cov else None,
                "coverageBest": cov[-1] if cov else None,
                "contractsWithNoPublishedDimension": len(no_dim),
                "dimensionRecovered": len(recovered),
                "failures": dict(fails),
            },
            "aggregateByVisibility": {k: round(v, 2) for k, v in agg.items()},
            # Only what the app will display, so the bundle stays small; the
            # corpus figures above describe the whole run.
            "contracts": shown,
        }, indent=1) + "\n")

    got: list[dict] = []
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        for res in ex.map(one, todo):
            if res:
                got.append(res)
                if len(got) % 50 == 0:
                    write_out(got, partial=True)
    write_out(got)

    print(f"  {len(got)} of {len(todo)} yielded a Bill of Quantities")
    if fails:
        print("  why the rest produced nothing:")
        for reason, n in fails.most_common():
            print(f"    {n:>5}  {reason}")

    # ── the free evaluation ──────────────────────────────────────────────────
    checked = [g for g in got if g["statedTotal"] and g["awardAmount"]]
    exact = [g for g in checked if abs(g["statedTotal"] - g["awardAmount"]) < 1.0]
    print(f"\naccuracy, against a figure we already hold:")
    print(f"  contract price read from the scan   {len(checked)}/{len(got)}")
    print(f"  matches the export within one peso   {len(exact)}/{len(checked)}"
          + (f"  ({len(exact)/len(checked)*100:.1f}%)" if checked else ""))

    # ── what is checkable against imagery ────────────────────────────────────
    agg: dict[str, float] = {}
    for g in got:
        for k, v in g["byVisibility"].items():
            agg[k] = agg.get(k, 0) + v
    tot = sum(agg.values()) or 1
    print("\nshare of read contract value, by whether it survives to be photographed:")
    for k in ["surface", "footprint", "ground", "buried", "inside", "gone", "none"]:
        if k in agg:
            print(f"  {agg[k]/tot*100:5.1f}%  {k:<10} {VISIBILITY_NOTE[k]}")
    seen = (agg.get("surface", 0) + agg.get("ground", 0)) / tot
    part = agg.get("footprint", 0) / tot
    print(f"\n  directly checkable   {seen*100:.1f}%")
    print(f"  footprint only       {part*100:.1f}%")
    print(f"  not checkable at all {(1-seen-part)*100:.1f}%")

    # Recovered dimensions: contracts whose description states no length but
    # whose BoQ carries measured quantities. This is the 83% gap, closing.
    recovered = [g for g in got
                 if not (by_id.get(g["id"], {}) or {}).get("lengthMetres")
                 and any(i["unit"] and "m" in i["unit"] for i in g["items"])]
    cov = [g["coverage"] for g in got if g.get("coverage")]
    usable = [c for c in cov if 0.9 <= c <= 1.1]
    print(f"\nparse completeness — parsed rows as a share of the contract price:")
    if cov:
        cov_s = sorted(cov)
        print(f"  median {cov_s[len(cov_s)//2]*100:.0f}%   best {max(cov)*100:.0f}%   "
              f"within 10% of complete: {len(usable)}/{len(cov)}")
    print(f"  Only contracts at or above {int(MIN_COVERAGE*100)}% are shown in the app.")

    print(f"\ncontracts with no length in the description that DO carry "
          f"measured quantities in the paper: {len(recovered)} of {len(got)}")

    print(f"\nwrote {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
