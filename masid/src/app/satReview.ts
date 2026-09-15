/**
 * What a person saw, recorded as what a person saw.
 *
 * The automated tier on this screen does not work. It fires on 7.7% of ordinary
 * completed contracts and on 5.9% of flagged ones — statistically the same rate —
 * so a verdict it produces carries no information about whether anything was
 * built. That is measured, not suspected, and it is stated at the top of the
 * screen where nobody can miss it.
 *
 * What still works on this screen is the imagery itself. Esri World Imagery
 * resolves well under a metre; a revetment, a floodgate, a pumping station or an
 * empty riverbank are all plainly legible to a person looking at it, and none of
 * them are legible to a 10 m NDVI difference. So the useful thing the screen can
 * do is not compute a verdict — it is to put the imagery in front of someone and
 * record what they say about it.
 *
 * That recording is deliberately modest:
 *
 *  - It is an OBSERVATION OF IMAGERY, never a finding about a contract. "Nothing
 *    visible" means nothing was visible in this picture on this date, which is a
 *    reason to send an inspector, not a conclusion about whether money was spent.
 *  - It carries WHO and WHEN, because an unattributed judgement is not evidence
 *    of anything and cannot be checked by a second reviewer.
 *  - It is EXPORTABLE, because a set of reviewed sites with named reviewers is
 *    the ground-truth the detector never had — the thing you would need to
 *    measure any future detector against.
 *
 * PROTOTYPE STORAGE. There is no server; reviews live in this browser only, and
 * clearing site data loses them. Export before you rely on them.
 */

const KEY = "masid.satreview.v1";

export type EyeVerdict =
  | "structure" | "something" | "nothing" | "wrong-place" | "cannot-tell";

export interface Review {
  id: string;            // contract id
  verdict: EyeVerdict;
  note: string;
  by: string;            // reviewer role label — this is a prototype, not an account
  at: string;            // ISO
}

/**
 * Five answers, and no sixth.
 *
 * The wording is the whole design here. Every option describes THE PICTURE, and
 * none of them describes the contract. "Nothing visible at this coordinate" is a
 * statement about pixels; whether a project exists is not something imagery can
 * settle, and the phrasing must not let a reviewer drift into thinking it can.
 *
 * "Cannot tell" is a first-class answer rather than a failure to answer. Cloud,
 * tree canopy over a channel, and imagery predating the contract are all common
 * here, and a reviewer forced to guess produces worse data than one allowed to
 * decline.
 */
export const EYE_CFG: Record<EyeVerdict, {
  label: string; short: string; color: string; bg: string; help: string;
}> = {
  structure: {
    label: "A structure like the one described is visible",
    short: "Structure visible", color: "#046b04", bg: "#e6f2e6",
    help: "You can see something that matches what the contract describes — a revetment along the bank, a floodgate, a pumping station, a lined channel.",
  },
  something: {
    label: "Something is built here, but not identifiable",
    short: "Built, unidentified", color: "#8a6d00", bg: "#fdf6dd",
    help: "There is clearly construction at the point, but the imagery will not tell you whether it is this contract's work or something else entirely.",
  },
  nothing: {
    label: "Nothing visible at this coordinate",
    short: "Nothing visible", color: "#c0272d", bg: "#fbe9ea",
    help: "Bare ground, open water, farmland or existing road with no structure at the point. A reason to send an inspector — not, on its own, a finding about the contract.",
  },
  "wrong-place": {
    label: "The coordinate does not fit the description",
    short: "Coordinate suspect", color: "#e8722c", bg: "#fdf0e8",
    help: "The point lands somewhere the described work could not be — mid-subdivision, far from any waterway, inside a building. The coordinate is the thing in question here, not the work.",
  },
  "cannot-tell": {
    label: "Cannot tell from this imagery",
    short: "Cannot tell", color: "#64748b", bg: "#f1f5f9",
    help: "Cloud, dense canopy over the channel, or imagery that predates the contract. Declining is a real answer and better data than a guess.",
  },
};

export const EYE_ORDER: EyeVerdict[] = ["structure", "something", "nothing", "wrong-place", "cannot-tell"];

const migrate = (r: Partial<Review> & { id: string }): Review => ({
  id: r.id,
  verdict: r.verdict && r.verdict in EYE_CFG ? r.verdict : "cannot-tell",
  note: r.note ?? "",
  by: r.by ?? "unknown",
  at: r.at ?? new Date().toISOString(),
});

/** Anything unreadable is dropped rather than thrown — a corrupt entry must not
 *  take the whole screen down, which is exactly how the reports feed once died. */
export function loadReviews(): Record<string, Review> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!raw || typeof raw !== "object") return {};
    const out: Record<string, Review> = {};
    for (const [id, v] of Object.entries(raw as Record<string, Partial<Review>>)) {
      if (v && typeof v === "object") out[id] = migrate({ ...v, id });
    }
    return out;
  } catch { return {}; }
}

export const saveReviews = (r: Record<string, Review>) =>
  localStorage.setItem(KEY, JSON.stringify(r));

/**
 * CSV, with the caveat carried inside the file.
 *
 * A spreadsheet outlives the screen it was exported from, and the one thing that
 * must not get separated from these rows is what they are: observations of a
 * picture, by a named reviewer, on a date. So the header row says so.
 */
export function reviewsToCsv(
  reviews: Record<string, Review>,
  meta: (id: string) => { municipality: string; description: string; lat: number | null; lng: number | null; autoVerdict: string },
): string {
  const esc = (s: string | number | null) =>
    s == null ? "" : /[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s);
  const rows = Object.values(reviews).sort((a, b) => a.id.localeCompare(b.id));
  const head = [
    "contract_id", "municipality", "description", "lat", "lng",
    "detector_verdict", "reviewer_observation", "reviewer_note", "reviewed_by", "reviewed_at",
  ];
  const lines = [
    "# MASID — observations of satellite imagery, not findings about contracts.",
    "# reviewer_observation describes what was visible in high-resolution imagery on the review date.",
    "# detector_verdict is the automated Sentinel-2 tier, which has no measured ability to tell",
    "# flagged contracts from ordinary ones and must not be read as evidence.",
    head.join(","),
    ...rows.map(r => {
      const m = meta(r.id);
      return [r.id, m.municipality, m.description, m.lat, m.lng,
        m.autoVerdict, EYE_CFG[r.verdict].short, r.note, r.by, r.at].map(esc).join(",");
    }),
  ];
  return lines.join("\n");
}

/** Imagery archives at a point, for dates neither panel on the screen holds. */
export function imageryLinks(lat: number, lng: number) {
  return [
    {
      label: "Copernicus Browser",
      note: "every Sentinel-2 pass over this point, by date",
      href: `https://browser.dataspace.copernicus.eu/?zoom=16&lat=${lat}&lng=${lng}&themeId=DEFAULT-THEME`,
    },
    {
      label: "Esri Wayback",
      note: "this same high-resolution basemap, back through its past versions",
      href: `https://livingatlas.arcgis.com/wayback/#active=&mapCenter=${lng},${lat},17`,
    },
    {
      label: "Google Maps",
      note: "a second high-resolution source, often flown on a different date",
      href: `https://www.google.com/maps/@${lat},${lng},18z/data=!3m1!1e3`,
    },
  ];
}
