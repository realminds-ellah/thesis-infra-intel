#!/usr/bin/env python3
"""
MASID data pipeline — Bulacan 1st DEO flood-control slice.

Builds the dashboard's dataset from public sources only. No DPWH FOI response
and no PhilSA imagery grant is required to run this.

SOURCES
  1. DPWH infrastructure transparency records
     bettergovph/dpwh-transparency-data (HuggingFace), CC0-1.0
     https://huggingface.co/datasets/bettergovph/dpwh-transparency-data
     248,220 rows scraped from https://infrastructure.dpwh.gov.ph/
  2. Philippine municipal boundaries (ADM3)
     geoBoundaries gbOpen PHL ADM3, CC BY 3.0 IGO
     Upstream: NAMRIA / PSA / OCHA Philippines
     https://www.geoboundaries.org/

OUTPUTS  -> src/app/data/
  projects.json     one record per contract, with derived audit flags
  contractors.json  contractor aggregates computed from the same records
  meta.json         provenance, counts, coverage and known data gaps

The audit flags in this file are PROCUREMENT-RECORD CONSISTENCY CHECKS ONLY.
They are not satellite verification and they are not findings of fraud. A flag
means "this record disagrees with itself or with the boundary data" — which is
a reason to look, not a conclusion. See SOURCES.md.
"""

from __future__ import annotations

import io
import json
import math
import re
import subprocess
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd
from shapely.geometry import Point, shape
from shapely.prepared import prep
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data"
OUT = ROOT / "src" / "app" / "data"

DETAIL_URL = (
    "https://huggingface.co/datasets/bettergovph/dpwh-transparency-data/"
    "resolve/main/dpwh_transparency_data_all_details.parquet"
)
DPWH_PARQUET_URL = (
    "https://huggingface.co/datasets/bettergovph/dpwh-transparency-data/"
    "resolve/main/dpwh_transparency_data.parquet"
)
ADM3_URL = (
    "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/"
    "gbOpen/PHL/ADM3/geoBoundaries-PHL-ADM3.geojson"
)

DEO = "Bulacan 1st DEO"
CATEGORY_MATCH = "flood"

# Search extent for loading ADM3 polygons. Deliberately wider than Bulacan so a
# coordinate that lands in Pampanga or NCR is named rather than returned as None.
SEARCH_BBOX = (120.30, 14.55, 121.30, 15.20)  # minx, miny, maxx, maxy

# The 24 LGUs of Bulacan. geoBoundaries spells the municipality of Bulakan
# "Bulacan" and prefixes the three cities with "City of".
BULACAN_LGUS = {
    "Angat", "Balagtas", "Baliuag", "Bocaue", "Bulacan", "Bustos", "Calumpit",
    "Doña Remedios Trinidad", "Guiguinto", "Hagonoy", "Marilao", "Norzagaray",
    "Obando", "Pandi", "Paombong", "Plaridel", "Pulilan", "San Ildefonso",
    "San Miguel", "San Rafael", "Santa Maria", "City of Malolos",
    "City of Meycauayan", "City of San Jose del Monte",
}

# Spellings DPWH actually uses in project descriptions, mapped to the ADM3 name.
ALIASES = {
    "BULAKAN": "Bulacan",
    "MALOLOS": "City of Malolos",
    "MALOLOS CITY": "City of Malolos",
    "CITY OF MALOLOS": "City of Malolos",
    "MEYCAUAYAN": "City of Meycauayan",
    "MEYCAUAYAN CITY": "City of Meycauayan",
    "SAN JOSE DEL MONTE": "City of San Jose del Monte",
    "SAN JOSE DEL MONTE CITY": "City of San Jose del Monte",
    "SJDM": "City of San Jose del Monte",
    "DRT": "Doña Remedios Trinidad",
    "DONA REMEDIOS TRINIDAD": "Doña Remedios Trinidad",
    "BALIWAG": "Baliuag",
}

# What an inspector needs off the contract description, in the order the phrases
# actually appear in DPWH titles. Longest/most specific first so "concrete slope
# protection" does not resolve to "concrete".
STRUCTURE_TYPES = [
    ("PUMPING STATION", "Pumping station"), ("FLOOD GATE", "Flood gate"),
    ("FLOODGATE", "Flood gate"), ("SLOPE PROTECTION", "Slope protection"),
    ("SHORE PROTECTION", "Shore protection"), ("BANK PROTECTION", "Bank protection"),
    ("RIVER PROTECTION", "Bank protection"), ("RIVERBANK PROTECTION", "Bank protection"),
    ("REVETMENT", "Revetment"), ("FLOOD WALL", "Flood wall"), ("FLOODWALL", "Flood wall"),
    ("RIVER WALL", "River wall"), ("DRAINAGE", "Drainage"), ("DREDGING", "Dredging"),
    ("DESILTING", "Desilting"), ("RIPRAP", "Riprap"), ("RIP-RAP", "Riprap"),
    ("DIKE", "Dike"), ("EMBANKMENT", "Embankment"), ("PARAPET", "Parapet wall"),
    ("CHANNEL", "Channel works"), ("WATERWAY", "Waterway works"),
    ("FLOOD MITIGATION", "Flood mitigation structure"),
    ("FLOOD CONTROL", "Flood control structure"),
]

# A published point this close to the boundary of the municipality its own
# description names is a cartographic edge case, not a relocated project.
BOUNDARY_TOLERANCE_M = 300


# ── fetch helpers ─────────────────────────────────────────────────────────────

def fetch(url: str, dest: Path) -> Path:
    """Download once, then serve from cache. Keeps reruns free and offline."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  cached  {dest.name} ({dest.stat().st_size/1e6:.1f} MB)")
        return dest
    print(f"  fetch   {url}")
    # curl rather than urllib: the python.org framework builds ship without a
    # usable CA bundle, and both hosts redirect.
    subprocess.run(
        ["curl", "-fsSL", "-A", "masid-pipeline", "-o", str(dest), url],
        check=True,
    )
    print(f"          -> {dest.name} ({dest.stat().st_size/1e6:.1f} MB)")
    return dest


# ── text normalisation ────────────────────────────────────────────────────────

def norm(s: str) -> str:
    """Uppercase, strip accents and punctuation. DPWH descriptions are shouty
    and inconsistently punctuated; boundary names are title case with accents."""
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.upper()
    s = re.sub(r"[^A-Z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def parse_amount(series):
    """Money columns in the DPWH export are strings, and some carry thousands
    separators ("10,947,829.50"). pd.to_numeric alone turns those into NaN
    silently, which quietly dropped 3,063 national rows from a first analysis
    without any error. Strip separators before parsing, always."""
    return pd.to_numeric(
        series.astype(str).str.replace(",", "", regex=False).str.strip(),
        errors="coerce")


def title(s: str) -> str:
    return " ".join(w.capitalize() for w in str(s).split())


# ── load boundaries ───────────────────────────────────────────────────────────

class Municipalities:
    """ADM3 polygons for the search extent, with lookup and distance helpers."""

    def __init__(self, names: list[str], geoms: list):
        self.names = names
        self.geoms = geoms
        self.tree = STRtree(geoms)
        self.prepared = [prep(g) for g in geoms]
        self.by_name: dict[str, int] = {}
        for i, n in enumerate(names):
            # Duplicate shapeNames exist across provinces (two "San Miguel").
            # Keep the Bulacan one where there is a choice.
            if n not in self.by_name or n in BULACAN_LGUS:
                self.by_name.setdefault(n, i)

    def locate(self, lat, lon) -> str | None:
        """Which municipality does this published coordinate actually fall in?"""
        if lat is None or lon is None:
            return None
        pt = Point(float(lon), float(lat))
        for i in self.tree.query(pt):
            if self.prepared[i].contains(pt):
                return self.names[i]
        return None

    def distance_m(self, name: str, lat: float, lon: float) -> float | None:
        """Metres from the point to the named municipality's polygon, 0 if inside.

        Equirectangular approximation. At Bulacan's latitude the error over the
        few kilometres we care about is far below the tolerance we apply."""
        i = self.by_name.get(name)
        if i is None:
            return None
        d_deg = self.geoms[i].distance(Point(float(lon), float(lat)))
        return d_deg * 111_320 * math.cos(math.radians(float(lat)))


def load_municipalities() -> Municipalities:
    path = fetch(ADM3_URL, CACHE / "geoBoundaries-PHL-ADM3.geojson")
    with open(path) as f:
        gj = json.load(f)

    minx, miny, maxx, maxy = SEARCH_BBOX
    geoms, names = [], []
    for feat in gj["features"]:
        g = shape(feat["geometry"])
        b = g.bounds
        # gbOpen ADM3 carries no province field, so select by extent.
        if b[2] < minx or b[0] > maxx or b[3] < miny or b[1] > maxy:
            continue
        names.append(feat["properties"]["shapeName"])
        geoms.append(g)

    found = {n for n in names} & BULACAN_LGUS
    print(f"  {len(geoms)} ADM3 units in extent; {len(found)}/24 Bulacan LGUs matched")
    missing = BULACAN_LGUS - found
    if missing:
        print(f"  WARNING unmatched Bulacan LGU names: {sorted(missing)}")
    return Municipalities(names, geoms)


# ── declared location parsing ────────────────────────────────────────────────

# Longest first so "SAN JOSE DEL MONTE" is tested before "SAN MIGUEL" etc.
VOCAB_TO_LGU = {
    **{norm(n): n for n in BULACAN_LGUS},
    **{norm(n.replace("City of ", "")): n for n in BULACAN_LGUS},
    **{norm(k): v for k, v in ALIASES.items()},
}
# "BULACAN" is stripped as the province before matching (see PROVINCE_TOKEN).
VOCAB_TO_LGU.pop("BULACAN", None)
DECLARED_VOCAB = sorted(VOCAB_TO_LGU, key=len, reverse=True)

# "BULACAN" in a description is the province in overwhelmingly most cases, but
# geoBoundaries spells the municipality of Bulakan the same way. Rather than
# guess, drop the ambiguous spelling everywhere and accept only the unambiguous
# "BULAKAN" as a municipality claim. Descriptions of genuine Bulakan projects
# spelled the other way yield no declared municipality, which under-flags — the
# safe direction for a tool that accuses public officials of nothing.
PROVINCE_TOKEN = re.compile(r"\b(BULACAN|BULACA)\b")


def structure_type(description: str) -> str | None:
    """What an inspector is looking for when they arrive."""
    d = norm(description)
    for token, label in STRUCTURE_TYPES:
        if token in d:
            return label
    return None


def barangay(description: str) -> str | None:
    """DPWH titles name the barangay in prose: '... AT BARANGAY PANDUCOT, ...'."""
    m = re.search(r"\b(?:BRGY\.?|BARANGAY)\s+([A-Z][A-Z0-9 .'\-]{2,40}?)\s*(?:,|$|\()",
                  description.upper())
    if not m:
        return None
    v = re.sub(r"\s+", " ", m.group(1)).strip(" .,-")
    return title(v) if v else None


def station_limits(description: str):
    """Chainage markers like 'STA. 0+475 - STA. 0+829' give the exact stretch of
    river to walk, and its length. Only 14% of contracts carry them, but where
    they do it is the difference between finding a structure and guessing."""
    pts = [int(a) * 1000 + int(b) for a, b in
           re.findall(r"(?:STA|K)\.?\s*(\d+)\s*\+\s*(\d+)", description, re.I)]
    if len(pts) < 2:
        return None, None, None
    lo, hi = min(pts), max(pts)
    return f"{lo//1000}+{lo%1000:03d}", f"{hi//1000}+{hi%1000:03d}", (hi - lo) or None


def declared_municipality(description: str) -> str | None:
    """Recover the site the contract itself names.

    DPWH descriptions carry the declared location in prose:
    '... ALONG BARANGAY PANDUCOT, CALUMPIT, BULACAN'. This is an INDEPENDENT
    statement of location from the published lat/lng, which is the only reason
    comparing the two means anything.

    Municipality sits rightmost, after any barangay, so take the last match —
    barangay names collide constantly with municipality names ('Santa Cruz' is
    a barangay of Guiguinto; 'San Miguel' is a barangay of Calumpit).
    """
    d = PROVINCE_TOKEN.sub(" ", norm(description))

    best = None  # (end position, length, lgu)
    for token in DECLARED_VOCAB:
        for m in re.finditer(rf"\b{re.escape(token)}\b", d):
            cand = (m.end(), len(token), VOCAB_TO_LGU[token])
            if best is None or cand[:2] > best[:2]:
                best = cand
    return best[2] if best else None


# ── main ──────────────────────────────────────────────────────────────────────

def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)

    print("Boundaries")
    munis = load_municipalities()

    print("DPWH records")
    pq = fetch(DPWH_PARQUET_URL, CACHE / "dpwh_transparency_data.parquet")
    df = pd.read_parquet(pq)
    total_rows = len(df)

    loc = pd.json_normalize(df["location"])
    df = pd.concat([df.drop(columns=["location"]), loc.add_prefix("loc_")], axis=1)

    df = df[
        df["category"].astype(str).str.contains(CATEGORY_MATCH, case=False, na=False)
        & (df["loc_province"] == DEO)
    ].copy()
    print(f"  {total_rows:,} rows -> {len(df):,} flood-control rows in {DEO}")

    # ── delivery state, from the verified detail export ──────────────────────
    # The five DPWH status values describe paperwork, not delivery. "Completed"
    # covers a structure standing today and one washed away two seasons ago
    # equally. These derived states are what an inspector actually triages on.
    detail = pd.read_parquet(
        fetch(DETAIL_URL, CACHE / "dpwh_all_details.parquet"),
        columns=["contractId", "expiryDate", "contractEffectivityDate", "abc",
                 "awardAmount", "bidders", "hasImages", "totalImages",
                 "advertisement", "contractAgreement", "noticeOfAward",
                 "noticeToProceed"],
    )
    df = df.merge(detail, on="contractId", how="left")
    print(f"  merged detail export: {df['abc'].notna().sum():,}/{len(df):,} rows have an ABC")

    df["abcN"] = parse_amount(df["abc"])
    df["awardAmountN"] = parse_amount(df["awardAmount"])

    today = pd.Timestamp.today().normalize()
    expiry = pd.to_datetime(df["expiryDate"], errors="coerce")
    df["overdue"] = (expiry < today) & (df["progress"] < 100) & (df["status"] != "Completed")
    df["stalled"] = df["overdue"] & (df["progress"] < 50)

    # Recurrence: the same coordinate built again in a LATER year. A flood control
    # structure that has to be redone is one that failed, was washed out, or was
    # never there — the closest honest proxy in this data for "completed but no
    # longer working". Same-year repeats are excluded; those are usually phases
    # of one job rather than a rebuild.
    coord = df.apply(
        lambda r: None if pd.isna(r["latitude"]) or pd.isna(r["longitude"])
        else f"{round(float(r['latitude']), 4)},{round(float(r['longitude']), 4)}",
        axis=1,
    )
    years_at = defaultdict(set)
    for k, y in zip(coord, df["infraYear"]):
        if k and pd.notna(y):
            years_at[k].add(int(y))
    df["siteRebuilds"] = [
        0 if not k else max(0, len(years_at[k]) - 1) for k in coord
    ]
    print(f"  delivery states: {int(df['overdue'].sum())} overdue, "
          f"{int(df['stalled'].sum())} stalled, "
          f"{int((df['siteRebuilds'] > 0).sum())} at rebuilt sites")

    # Derive both location claims independently.
    df["declaredMunicipality"] = df["description"].map(declared_municipality)
    df["geocodedMunicipality"] = [
        None if pd.isna(la) or pd.isna(lo) else munis.locate(la, lo)
        for la, lo in zip(df["latitude"], df["longitude"])
    ]
    unparsed = df["declaredMunicipality"].isna().sum()
    print(f"  declared municipality parsed for {len(df)-unparsed:,}/{len(df):,} "
          f"({unparsed} descriptions name no municipality)")

    # The DEO's real service area, derived from the data rather than assumed:
    # whatever municipalities its own project descriptions name.
    served = {m for m in df["declaredMunicipality"].dropna()}
    print(f"  DEO service area (from descriptions): {len(served)} municipalities")

    # Coordinates reused across contracts — one of COA's documented patterns.
    coord_key = df.apply(
        lambda r: None
        if pd.isna(r["latitude"]) or pd.isna(r["longitude"])
        else f"{round(float(r['latitude']), 5)},{round(float(r['longitude']), 5)}",
        axis=1,
    )
    coord_counts = Counter(k for k in coord_key if k)

    def parse_date(v):
        if v is None or (isinstance(v, float) and math.isnan(v)):
            return None
        s = str(v)[:10]
        return s if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s) else None

    STATUS_MAP = {
        "Completed": "completed",
        "On-Going": "ongoing",
        "Not Yet Started": "proposed",
        "For Procurement": "proposed",
        "Terminated": "terminated",
    }

    projects, flag_tally = [], Counter()

    for key, (_, r) in zip(coord_key, df.iterrows()):
        lat = None if pd.isna(r["latitude"]) else float(r["latitude"])
        lng = None if pd.isna(r["longitude"]) else float(r["longitude"])
        prog = 0.0 if pd.isna(r["progress"]) else float(r["progress"])
        dpwh_status = str(r["status"])
        start, end = parse_date(r["startDate"]), parse_date(r["completionDate"])
        # Both columns hold object dtype, so a missing value arrives as NaN
        # rather than None and would otherwise compare as a real municipality.
        decl = None if pd.isna(r["declaredMunicipality"]) else r["declaredMunicipality"]
        geoc = None if pd.isna(r["geocodedMunicipality"]) else r["geocodedMunicipality"]

        flags = []
        offset_m = None

        if lat is None or lng is None:
            flags.append({
                "code": "MISSING_COORDS",
                "severity": "high",
                "detail": "No latitude/longitude published, so the site cannot be "
                          "located for satellite or field verification.",
            })
        else:
            if decl:
                offset_m = munis.distance_m(decl, lat, lng)

            if geoc is None:
                flags.append({
                    "code": "UNLOCATABLE_COORD",
                    "severity": "high",
                    "detail": f"Published coordinate ({lat:.5f}, {lng:.5f}) falls "
                              f"outside every municipal boundary in the region — "
                              f"open water, or a malformed coordinate.",
                })
            elif geoc not in BULACAN_LGUS:
                flags.append({
                    "code": "OUTSIDE_PROVINCE",
                    "severity": "high",
                    "detail": f"Coordinate falls in {geoc}, outside Bulacan entirely, "
                              f"for a project of the Bulacan 1st District "
                              f"Engineering Office.",
                })
            elif decl and geoc != decl:
                # Distinguish a relocated site from a point that merely sits on
                # the far side of a boundary line.
                if offset_m is not None and offset_m <= BOUNDARY_TOLERANCE_M:
                    flags.append({
                        "code": "BOUNDARY_ADJACENT",
                        "severity": "low",
                        "detail": f"Coordinate falls in {geoc}, {offset_m:.0f} m "
                                  f"outside {decl} which the description names. "
                                  f"Within boundary tolerance — likely cartographic.",
                    })
                else:
                    off = f"{offset_m/1000:.1f} km" if offset_m else "an unknown distance"
                    flags.append({
                        "code": "MUNI_MISMATCH",
                        "severity": "high",
                        "detail": f"Description names {decl}; the published "
                                  f"coordinate falls in {geoc}, {off} outside "
                                  f"{decl}.",
                    })
            elif not decl and geoc not in served:
                flags.append({
                    "code": "OUTSIDE_DEO_AREA",
                    "severity": "medium",
                    "detail": f"Coordinate falls in {geoc}, outside the municipalities "
                              f"this district office's own records describe, and the "
                              f"description names no municipality to check it against.",
                })

            if key and coord_counts[key] > 1:
                flags.append({
                    "code": "COORD_DUPLICATE",
                    "severity": "medium",
                    "detail": f"{coord_counts[key]} separate contracts share this exact "
                              f"coordinate.",
                })

        # DPWH's own contractor field carries a registration marker, e.g.
        # "ST. TIMOTHY CONSTRUCTION CORPORATION ([REVOKED] 39196)". This is the
        # portal's statement, not an inference, and it is the only contractor
        # standing data in any public source.
        #
        # It says nothing about whether the award was proper. The portal does not
        # date the revocation, so it may well postdate the contract — which is
        # exactly what happens when a firm is sanctioned after the work. The flag
        # is a pointer to check the dates, and the wording has to stay that.
        if "REVOKED" in str(r["contractor"]).upper():
            flags.append({
                "code": "CONTRACTOR_REVOKED",
                "severity": "medium",
                "detail": "DPWH's own record marks this contractor's registration "
                          "as revoked. The portal does not publish the revocation "
                          "date, so whether it preceded or followed this award has "
                          "to be established separately.",
            })

        if dpwh_status == "Completed" and prog < 100:
            flags.append({
                "code": "STATUS_PROGRESS_CONFLICT",
                "severity": "medium",
                "detail": f"Marked Completed but reported progress is {prog:.0f}%.",
            })

        if start and end and end < start:
            flags.append({
                "code": "DATE_ANOMALY",
                "severity": "low",
                "detail": f"Completion date ({end}) precedes start date ({start}).",
            })

        for f in flags:
            flag_tally[f["code"]] += 1

        weight = {"high": 3, "medium": 2, "low": 1}
        score = sum(weight[f["severity"]] for f in flags)

        st_from, st_to, st_len = station_limits(r["description"])
        municipality = decl or geoc or "Unspecified"

        # Status is the lifecycle stage DPWH reports and NOTHING else. An earlier
        # version overwrote it with "flagged" whenever a check tripped, which hid
        # 245 completed contracts inside a status that is not a lifecycle stage at
        # all — the app said 717 completed where DPWH says 962, and no filter
        # could recover them. A flagged project is still completed; a defective
        # one would be too. Conditions live in auditFlags, never in the stage.
        status = STATUS_MAP.get(dpwh_status, "proposed")

        projects.append({
            "id": str(r["contractId"]),
            "name": title(r["description"])[:120],
            "description": str(r["description"]),
            "contractor": re.sub(r"\s*\(\d+\)\s*$", "", str(r["contractor"])).strip(),
            "municipality": municipality,
            "declaredMunicipality": decl,
            "geocodedMunicipality": geoc,
            "offsetMetres": None if offset_m is None else round(offset_m),
            "budget": 0.0 if pd.isna(r["budget"]) else float(r["budget"]),
            "amountPaid": 0.0 if pd.isna(r["amountPaid"]) else float(r["amountPaid"]),
            "status": status,
            "dpwhStatus": dpwh_status,
            "completion": prog,
            "startDate": start,
            "endDate": end,
            "infraYear": None if pd.isna(r["infraYear"]) else int(r["infraYear"]),
            "lat": lat,
            "lng": lng,
            "fundingSource": str(r["sourceOfFunds"]) if not pd.isna(r["sourceOfFunds"]) else "—",
            "districtOffice": DEO,
            "hasSatelliteImage": bool(r["hasSatelliteImage"]),
            "overdue": bool(r["overdue"]),
            "stalled": bool(r["stalled"]),
            "siteRebuilds": int(r["siteRebuilds"]),
            "hasPhotos": bool(r["hasImages"]) if pd.notna(r["hasImages"]) else False,
            "photoCount": 0 if pd.isna(r["totalImages"]) else int(r["totalImages"]),
            "bidderCount": 0 if r["bidders"] is None or isinstance(r["bidders"], float) else len(r["bidders"]),
            "awardAmount": None if pd.isna(r["awardAmountN"]) else float(r["awardAmountN"]),
            "abc": None if pd.isna(r["abcN"]) else float(r["abcN"]),
            "docCount": sum(1 for c in ("advertisement","contractAgreement","noticeOfAward","noticeToProceed")
                            if isinstance(r[c], str) and r[c].startswith("http")),
            "reportCount": 0 if pd.isna(r["reportCount"]) else int(r["reportCount"]),
            "structureType": structure_type(r["description"]),
            "barangay": barangay(r["description"]),
            "stationFrom": st_from,
            "stationTo": st_to,
            "lengthMetres": st_len,
            "auditFlags": flags,
            "auditScore": score,
        })

    projects.sort(key=lambda p: (-p["auditScore"], -p["budget"]))

    # ── contractor aggregates, computed from the same records ────────────────
    by_contractor = defaultdict(list)
    for p in projects:
        by_contractor[p["contractor"]].append(p)

    contractors = []
    for i, (name, ps) in enumerate(sorted(by_contractor.items()), start=1):
        flagged = [p for p in ps if p["auditFlags"]]
        revoked = "REVOKED" in name.upper()
        contractors.append({
            "id": f"C{i}",
            "name": name,
            "totalProjects": len(ps),
            "activeProjects": sum(1 for p in ps if p["dpwhStatus"] == "On-Going"),
            "completedProjects": sum(1 for p in ps if p["dpwhStatus"] == "Completed"),
            "flaggedProjects": len(flagged),
            "flagRate": round(len(flagged) / len(ps), 3),
            "totalValue": round(sum(p["budget"] for p in ps), 2),
            "municipalities": sorted({p["municipality"] for p in ps}),
            "years": sorted({p["infraYear"] for p in ps if p["infraYear"]}),
            "registrationRevoked": revoked,
        })
    contractors.sort(key=lambda c: -c["totalValue"])

    flagged_projects = [p for p in projects if p["auditFlags"]]
    with_coords = [p for p in projects if p["lat"] is not None]

    meta = {
        "generated": pd.Timestamp.now("UTC").strftime("%Y-%m-%dT%H:%M:%SZ"),
        "areaOfInterest": DEO,
        "coverage": {
            "projects": len(projects),
            "contractors": len(contractors),
            "yearMin": min((p["infraYear"] for p in projects if p["infraYear"]), default=None),
            "yearMax": max((p["infraYear"] for p in projects if p["infraYear"]), default=None),
            "totalBudget": round(sum(p["budget"] for p in projects), 2),
            "withCoordinates": len(with_coords),
            "overdue": int(sum(1 for p in projects if p["overdue"])),
            "stalled": int(sum(1 for p in projects if p["stalled"])),
            "atRebuiltSites": int(sum(1 for p in projects if p["siteRebuilds"] > 0)),
            "flagged": len(flagged_projects),
            "municipalitiesServed": sorted(served),
        },
        "flagTally": dict(flag_tally.most_common()),
        "sources": [
            {
                "name": "DPWH Infrastructure Transparency Dataset",
                "publisher": "BetterGov.ph (scrape of infrastructure.dpwh.gov.ph)",
                "url": "https://huggingface.co/datasets/bettergovph/dpwh-transparency-data",
                "license": "CC0-1.0",
                "rowsUpstream": total_rows,
                "provides": "contract id, description, contractor, budget, progress, "
                            "status, dates, funding source, latitude/longitude",
            },
            {
                "name": "geoBoundaries PHL ADM3 (municipalities)",
                "publisher": "geoBoundaries / NAMRIA / PSA / OCHA Philippines",
                "url": "https://www.geoboundaries.org/",
                "license": "CC BY 3.0 IGO",
                "provides": "municipal polygons for reverse-geocoding published coordinates",
            },
        ],
        "knownGaps": [
            "amountPaid is 0 on every completed record in this slice — the "
            "transparency portal does not publish disbursement, so financial "
            "reconciliation (request section 1E) still needs DPWH.",
            "No project polygons or alignment geometry are published anywhere "
            "public; each project is a single point (request section 1B).",
            "No design drawings, cross-sections, bills of quantities or as-builts "
            "(request section 1C).",
            "No inspection or acceptance reports; DIME carries geotagged photos "
            "and citizen reports but does not publish the formal records "
            "(request section 1D).",
            "Satellite verification is not yet wired in. Every flag here is a "
            "procurement-record consistency check.",
        ],
    }

    # Real municipal outlines for the map canvas, simplified enough to ship in
    # the bundle. The dashboard drew a decorative province shape before; a tool
    # whose whole claim is "this coordinate is in the wrong municipality" has to
    # show the boundaries it judged against.
    boundaries = []
    for name in sorted(BULACAN_LGUS):
        i = munis.by_name.get(name)
        if i is None:
            continue
        geom = munis.geoms[i].simplify(0.0008, preserve_topology=True)
        polys = geom.geoms if geom.geom_type == "MultiPolygon" else [geom]
        rings = [
            [[round(x, 5), round(y, 5)] for x, y in poly.exterior.coords]
            for poly in polys
            if poly.area > 1e-6  # drop slivers and offshore specks
        ]
        if rings:
            boundaries.append({"name": name, "rings": rings})

    (OUT / "boundaries.json").write_text(json.dumps(boundaries))
    print(f"  municipal outlines: {len(boundaries)} LGUs, "
          f"{sum(len(r) for b in boundaries for r in b['rings']):,} vertices")

    (OUT / "projects.json").write_text(json.dumps(projects, indent=1))
    (OUT / "contractors.json").write_text(json.dumps(contractors, indent=1))
    (OUT / "meta.json").write_text(json.dumps(meta, indent=2))

    print(f"\nWrote {len(projects):,} projects, {len(contractors)} contractors -> {OUT}")
    print(f"  coordinates published : {len(with_coords):,} / {len(projects):,}")
    print(f"  flagged for review    : {len(flagged_projects):,}")
    for code, n in flag_tally.most_common():
        print(f"    {code:26s} {n:5d}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
