/**
 * Filipino, for the people this was built for.
 *
 * The whole premise of this project is a resident in Hagonoy checking the
 * revetment on their own barangay's riverbank. That person was handed an
 * interface entirely in English. Everything else in this app — live capture,
 * on-device geocoding, offline-friendly storage — was designed around them, and
 * then the words were not.
 *
 * WHAT IS TRANSLATED, AND WHY NOT EVERYTHING
 *
 * The citizen-facing surface: navigation, the map filters, what a flag means,
 * report categories, report status, and the guards. Not the analyst surfaces —
 * the procurement tables, the statistic ablation, the satellite validation
 * banner — which are read by people working in English on a technical record,
 * and where a half-finished translation of a statistical claim is worse than
 * none. Those are marked, not hidden, so the gap is visible rather than
 * pretended away.
 *
 * THE HARD PART IS THE FLAG WORDING
 *
 * Every English flag is phrased to describe a discrepancy and stop there — "the
 * record disagrees with itself", never "they lied". That restraint has to
 * survive translation, and Tagalog makes it easy to lose: "mali" (wrong) and
 * "hindi tugma" (does not match) are close in everyday speech and very far
 * apart in what they accuse someone of. Every string below uses the
 * non-accusatory construction, and where English hedges, the Filipino hedges.
 *
 * Register is deliberately conversational Tagalog with English technical terms
 * left in place — "coordinate", "contract", "flood control" — because that is
 * how these things are actually said, and inventing purist Tagalog coinages for
 * them would make the tool harder to read, not easier.
 */

export type Lang = "en" | "fil";

const KEY = "masid.lang.v1";

export const loadLang = (): Lang => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "en" || v === "fil") return v;
    // A device set to Filipino gets Filipino without being asked.
    return /^(fil|tl)/i.test(navigator.language ?? "") ? "fil" : "en";
  } catch { return "en"; }
};

export const saveLang = (l: Lang) => { try { localStorage.setItem(KEY, l); } catch { /* private mode */ } };

type Dict = Record<string, string>;

const FIL: Dict = {
  // ── navigation ───────────────────────────────────────────────────────────
  "nav.dashboard": "Dashboard",
  "nav.map": "Mapa",
  "nav.satellite": "Satellite",
  "nav.documents": "Mga Dokumento",
  "nav.reports": "Mga Ulat",
  "nav.contractors": "Mga Kontratista",
  "nav.admin": "Admin",
  "nav.nationwide": "Buong Bansa",
  "nav.public": "Publiko",

  // ── the five site states, matching the filter controls ────────────────────
  "status.completed": "Tapos na",
  "status.ongoing": "Ginagawa pa",
  "status.proposed": "Hindi pa nasisimulan",
  "status.terminated": "Kanselado",
  "status.flagged": "Kailangang suriin",

  // ── map + filters ────────────────────────────────────────────────────────
  "map.nearMe": "Ano ang malapit sa akin?",
  "map.finding": "Hinahanap ka…",
  "map.updateLocation": "I-update ang lokasyon ko",
  "map.nearest": "Pinakamalapit sa iyo",
  "map.noLocation": "Hindi ibinigay ang lokasyon, kaya walang masusukat mula sa kinaroroonan mo.",
  "map.locationPrivate": "Sa browser mo lang ginamit ang lokasyon mo. Hindi ito ipinapadala kahit saan.",
  "filter.municipality": "Bayan",
  "filter.allMunicipalities": "Lahat ng bayan",
  "filter.status": "Kalagayan",
  "filter.contractor": "Kontratista",
  "filter.year": "Taon",
  "filter.clear": "Alisin ang filter",

  // ── what a flag is, and what it is not ───────────────────────────────────
  "flag.heading": "Mga tsek na hindi tumugma",
  "flag.meaning":
    "Ang ibig sabihin ng flag: may hindi tugma sa mismong nakasulat na record, o sa opisyal na hangganan ng bayan. " +
    "Dahilan ito para tingnan, hindi patunay na may ginawang mali ang sinuman.",
  "flag.MISSING_COORDS": "Walang nakalagay na koordinado",
  "flag.MUNI_MISMATCH": "Hindi tugma ang koordinado sa deskripsyon",
  "flag.OUTSIDE_PROVINCE": "Nasa labas ng Bulacan ang koordinado",
  "flag.UNLOCATABLE_COORD": "Wala sa anumang hangganan ang koordinado",
  "flag.COORD_DUPLICATE": "May ibang kontrata sa parehong koordinado",
  "flag.CONTRACTOR_REVOKED": "Nakamarka bilang revoked ang rehistro ng kontratista",
  "flag.BOUNDARY_ADJACENT": "Malapit sa hangganan ng bayan",
  "flag.STATUS_PROGRESS_CONFLICT": "Hindi tugma ang status sa progress",
  "flag.DATE_ANOMALY": "Mas maaga ang petsa ng tapos kaysa sa simula",

  // ── citizen reports ──────────────────────────────────────────────────────
  "report.title": "Mga ulat mula sa lugar",
  "report.subtitle": "Ang nakikita ng tao na hindi sinasabi ng papel",
  "report.new": "Mag-ulat mula sa site",
  "report.whatReporting": "Ano ang iniuulat mo?",
  "report.whatSaw": "Ano ang nakita mo?",
  "report.whichProject": "Aling proyekto?",
  "report.retake": "Ulitin ang kuha",
  "report.notPosted": "Hindi pa nai-post",
  "report.post": "I-post ang ulat",
  "report.delete": "Burahin",
  "report.remove": "Alisin",
  "report.liveOnly":
    "Kailangang kuhanan ngayon din — bubukas ang camera sa page at walang paraan para mag-attach ng lumang litrato. " +
    "Hindi ito patunay; kailangan pa ring suriin ng tao ang bawat ulat.",

  "kind.nothing-here": "Walang naitayo dito",
  "kind.unfinished": "Mukhang hindi tapos o tumigil",
  "kind.damaged": "Nakatayo pero sira o nasisira",
  "kind.different": "Iba sa nakasulat na deskripsyon",
  "kind.not-working": "Nandiyan pero hindi gumagana",
  "kind.looks-done": "Nandiyan at mukhang tapos",
  "kind.other": "Iba pa",
  "kind.positiveWhy":
    "Kasinghalaga ng pag-uulat ng problema ang pagkumpirmang may naitayo. Kung puro reklamo lang ang tinatanggap, " +
    "hindi na mabasa ang katahimikan — hindi mo malalaman kung walang pumunta o kung maayos naman talaga.",

  "rstatus.submitted": "Naipasa",
  "rstatus.reviewing": "Sinusuri",
  "rstatus.queued": "Nakapila para bisitahin",
  "rstatus.validated": "Nakumpirma sa site",
  "rstatus.not-confirmed": "Hindi nakumpirma",
  "rstatus.closed": "Sarado",
  "rstatus.officialsOnly": "DPWH, LGU o inspector lang ang makakapagpalit nito",

  // ── the guards, which must survive translation intact ────────────────────
  "guard.prototype":
    "Prototype ito. Nananatili sa browser mo ang mga ulat at hindi ipinapadala kahit saan. " +
    "Ang tunay na bersyon ay kailangan ng paraan para magpasa, mag-moderate, mag-record, at mag-takedown.",
  "guard.notFraud":
    "Walang sinasabi rito na may nandaya. Ang bawat tsek ay paghahambing ng dalawang bagay na parehong inilathala ng gobyerno.",
  "guard.reportedProgress": "Ayon sa iniulat ng DPWH — hindi ito obserbasyon sa mismong lugar",
  "guard.estimate": "Tantiya ang dilaw na hugis",

  // ── general ──────────────────────────────────────────────────────────────
  "common.contracts": "mga kontrata",
  "common.flagged": "kailangang suriin",
  "common.of": "sa",
  "common.close": "Isara",
  "common.search": "Maghanap",
  "common.english": "English",
  "common.filipino": "Filipino",
  "common.onlyPartlyTranslated":
    "Bahagi pa lang ang naisalin. Nasa English pa ang mga teknikal na screen — mas mabuti nang " +
    "walang salin kaysa sa maling salin ng isang bagay na tungkol sa pera at pangalan ng kompanya.",
};

/**
 * Look up a string. Falls back to English rather than to the key, so a missing
 * translation degrades to a readable word instead of `report.whatSaw`.
 */
export function makeT(lang: Lang, en: Dict) {
  return (key: string, fallback?: string): string => {
    if (lang === "fil" && FIL[key]) return FIL[key];
    return en[key] ?? fallback ?? key;
  };
}

/** English strings, kept beside the Filipino so the pair stays in sync. */
export const EN: Dict = {
  "nav.dashboard": "Dashboard", "nav.map": "Map", "nav.satellite": "Satellite",
  "nav.documents": "Documents", "nav.reports": "Reports", "nav.contractors": "Contractors",
  "nav.admin": "Admin", "nav.nationwide": "Nationwide", "nav.public": "Public",
  "status.completed": "Finished", "status.ongoing": "Being built",
  "status.proposed": "Not started yet", "status.terminated": "Cancelled",
  "status.flagged": "Flagged for review",
  "map.nearMe": "What is near me?", "map.finding": "Finding you…",
  "map.updateLocation": "Update my location", "map.nearest": "Nearest to you",
  "map.noLocation": "Location permission was declined, so nothing can be measured from where you are.",
  "map.locationPrivate": "Your location is used in this browser only and is not sent anywhere.",
  "common.english": "English", "common.filipino": "Filipino",
  "common.onlyPartlyTranslated":
    "Partly translated. The technical screens are still in English — no translation is better " +
    "than a wrong one where money and company names are involved.",
};

export const FIL_KEYS = Object.keys(FIL).length;
