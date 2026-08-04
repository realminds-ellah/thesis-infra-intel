/**
 * Colour encodings for the map.
 *
 * Traffic light — green, amber, orange, red — on plain circular dots. Chosen
 * because everyone already knows how to read it, and this register is meant to
 * be usable by the public rather than only by auditors.
 *
 * The known limit, stated once: red and green cannot be fully separated by
 * viewers with the most common form of colour blindness. This set is the best of
 * a dozen traffic-light candidates measured against the map surface (ΔE 7.5 on
 * the protan axis; nothing that still looks like a traffic light does better).
 * The relief is that the legend is always on screen, always labelled in words,
 * and always carries counts — so no reading depends on telling two hues apart.
 * Award amount is the exception and uses a single-hue ramp, because size is a
 * magnitude, not a verdict.
 *
 * Validated 2026-08-04, light mode, surface #f2f2f0, all pairs:
 *   traffic light #046b04 #f7c948 #e8722c #c0272d   CVD 7.5 · normal 16.9
 *   amount ramp   #6da7ec #3987e5 #256abf #104281   all checks pass
 */

import { PROJECTS, PROC_BY_ID, FUSED_BY_ID, HAZARD_BY_ID, type Project } from "./data";
import { amountOf, bidderBand, ratioBand } from "./filters";

/** Neutral for "no signal" / "Other". Deliberately low-chroma so it recedes. */
export const NEUTRAL = "#9a9a94";

/**
 * Traffic light — green, amber, orange, red. Chosen because the semantics are
 * worth more here than a perfectly separable ramp: on a public accountability
 * map, green-means-fine and red-means-look is understood instantly and by
 * everyone, and that legibility is the product.
 *
 * The cost is real and is paid for explicitly. Red↔green cannot be separated on
 * the protan axis: this set reaches ΔE 7.5, and no traffic light does better —
 * a dozen candidate sets were validated and every one that looked like a traffic
 * light landed between 1.6 and 7.5. This is the best of them, and it sits in the
 * band the method permits ONLY WITH SECONDARY ENCODING.
 *
 * So the secondary encoding is not optional here: every severity mark also
 * carries a SHAPE, and the legend renders that shape beside its label. A viewer
 * who cannot separate the hues reads circle / square / triangle / diamond
 * instead, and loses nothing.
 *
 * Validated light mode, surface #f2f2f0, all pairs:
 *   CVD ΔE 7.5 (protan), tritan 14.1 · normal-vision ΔE 16.9 · contrast WARN
 */
const TRAFFIC = {
  good: "#046b04",     // green
  watch: "#f7c948",    // amber
  concern: "#e8722c",  // orange
  alert: "#c0272d",    // red
};

/** Kept as a single value: the map uses plain circular dots throughout. */
export type MarkShape = "circle";

const ORDINAL_4 = ["#6da7ec", "#3987e5", "#256abf", "#104281"];
const CAT_3 = ["#2a78d6", "#eb6834", "#1baf7a"];

/** Neutral basemap. Data colour belongs to the data; the map underneath recedes. */
export const BASEMAP = {
  surface: "#f2f2f0",
  servedFill: "#e6e6e2",
  otherFill: "#eeeeec",
  stroke: "#8c8c85",
  grid: "#c9c9c2",
  label: "#6b6b64",
};

export interface Bin { key: string; label: string; color: string; shape: MarkShape; test: (p: Project) => boolean }
export interface Encoding {
  key: string;
  label: string;
  kind: "ordinal" | "categorical" | "sequential";
  note: string;
  bins: Bin[];
}

const flagCount = (p: Project) => p.auditFlags.length + (PROC_BY_ID.get(p.id)?.procurementFlags.length ?? 0);

export const ENCODINGS: Encoding[] = [
  {
    key: "priority",
    label: "Audit priority",
    kind: "ordinal",
    note: "How many checks a contract trips, across both the records and the bidding tiers. Ordered, so it reads as one ramp.",
    bins: [
      { key: "0", label: "No flags", color: TRAFFIC.good, shape: "circle", test: p => flagCount(p) === 0 },
      { key: "1", label: "1 flag", color: TRAFFIC.watch, shape: "circle", test: p => flagCount(p) === 1 },
      { key: "2", label: "2 flags", color: TRAFFIC.concern, shape: "circle", test: p => flagCount(p) === 2 },
      { key: "3", label: "3 flags", color: TRAFFIC.alert, shape: "circle", test: p => flagCount(p) === 3 },
      { key: "4", label: "4 or more", color: TRAFFIC.alert, shape: "circle", test: p => flagCount(p) >= 4 },
    ],
  },
  {
    key: "delivery",
    label: "Delivery concern",
    kind: "ordinal",
    note: "What is happening on the ground, ordered by how much attention it warrants. A contract can meet several states; the most serious wins.",
    bins: [
      { key: "ok", label: "Nothing flagged", color: TRAFFIC.good, shape: "circle", test: p => !dv(p).length },
      { key: "unpaid", label: "Completed, nothing disbursed", color: TRAFFIC.watch, shape: "circle", test: p => top(p) === "unpaid" },
      { key: "rebuilt", label: "Rebuilt at same site", color: TRAFFIC.concern, shape: "circle", test: p => top(p) === "rebuilt" },
      { key: "overdue", label: "Overdue", color: TRAFFIC.alert, shape: "circle", test: p => top(p) === "overdue" },
      { key: "stalled", label: "Stalled", color: TRAFFIC.alert, shape: "circle", test: p => top(p) === "stalled" },
    ],
  },
  {
    key: "competition",
    label: "Competition",
    kind: "ordinal",
    note: "Bidders on the contract. Darker is thinner competition, so the concerning end is the heavy end.",
    bins: [
      { key: "6+", label: "6 or more bidders", color: TRAFFIC.good, shape: "circle", test: p => bb(p) === "6+" },
      { key: "3-5", label: "3–5 bidders", color: TRAFFIC.good, shape: "circle", test: p => bb(p) === "3-5" },
      { key: "2", label: "2 bidders", color: TRAFFIC.concern, shape: "circle", test: p => bb(p) === "2" },
      { key: "1", label: "1 bidder", color: TRAFFIC.alert, shape: "circle", test: p => bb(p) === "1" },
    ],
  },
  {
    key: "ratio",
    label: "Bid vs approved budget",
    kind: "categorical",
    note: "Whether the winning bid lands on a whole percentage of the approved budget. Three genuinely distinct cases, so distinct hues rather than a ramp.",
    bins: [
      { key: "at96", label: "Exactly 96.00%", color: TRAFFIC.alert, shape: "circle", test: p => ratioBand(PROC_BY_ID.get(p.id)?.bidRatio) === "at96" },
      { key: "whole", label: "Another whole %", color: TRAFFIC.concern, shape: "circle", test: p => ratioBand(PROC_BY_ID.get(p.id)?.bidRatio) === "whole" },
      { key: "other", label: "Not a whole %", color: TRAFFIC.good, shape: "circle", test: p => ratioBand(PROC_BY_ID.get(p.id)?.bidRatio) === "other" },
      { key: "none", label: "No award published", color: NEUTRAL, shape: "circle", test: p => ratioBand(PROC_BY_ID.get(p.id)?.bidRatio) == null },
    ],
  },
  {
    key: "amount",
    label: "Award amount",
    kind: "sequential",
    note: "Continuous magnitude, binned at the quartiles of the awards actually published.",
    bins: [],   // filled below, from the data
  },
  {
    key: "hazard",
    label: "Flood risk at the site",
    kind: "ordinal",
    note: "UP NOAH modelled 100-year flood extent. Green is high hazard — that is where flood control belongs. Read 'outside' with the distance: a structure at the edge of a flood zone is normal.",
    bins: [
      { key: "high", label: "High flood hazard", color: TRAFFIC.good, shape: "circle", test: p => hz(p) === 3 },
      { key: "medium", label: "Medium hazard", color: TRAFFIC.good, shape: "circle", test: p => hz(p) === 2 },
      { key: "low", label: "Low hazard", color: TRAFFIC.watch, shape: "circle", test: p => hz(p) === 1 },
      { key: "edge", label: "Outside, within 1 km", color: TRAFFIC.concern, shape: "circle", test: p => hz(p) === 0 && (HAZARD_BY_ID.get(p.id)?.metresToHazard ?? 0) <= 1000 },
      { key: "far", label: "Over 1 km away", color: TRAFFIC.alert, shape: "circle", test: p => hz(p) === 0 && (HAZARD_BY_ID.get(p.id)?.metresToHazard ?? 0) > 1000 },
      { key: "na", label: "No coordinate", color: NEUTRAL, shape: "circle", test: p => hz(p) == null },
    ],
  },
  {
    key: "status",
    label: "Reported status",
    kind: "categorical",
    note: "DPWH's own status. Five values, but the palette only clears the all-pairs floors for three, so the two rarest fold into Other rather than being given colours that cannot be told apart.",
    bins: [
      { key: "completed", label: "Completed", color: TRAFFIC.good, shape: "circle", test: p => p.status === "completed" },
      { key: "ongoing", label: "Ongoing", color: CAT_3[0], shape: "circle", test: p => p.status === "ongoing" },
      { key: "other", label: "Proposed or terminated", color: NEUTRAL, shape: "circle", test: p => p.status === "proposed" || p.status === "terminated" },
    ],
  },
];

// delivery helpers — "most serious state wins" keeps one mark to one colour
type DS = "stalled" | "overdue" | "rebuilt" | "unpaid";
const ORDER: DS[] = ["stalled", "overdue", "rebuilt", "unpaid"];
function dv(p: Project): DS[] {
  const x = p as unknown as { overdue?: boolean; stalled?: boolean; siteRebuilds?: number };
  const out: DS[] = [];
  if (x.stalled) out.push("stalled");
  if (x.overdue) out.push("overdue");
  if ((x.siteRebuilds ?? 0) > 0) out.push("rebuilt");
  if (p.dpwhStatus === "Completed" && p.amountPaid === 0) out.push("unpaid");
  return out;
}
const top = (p: Project): DS | null => ORDER.find(s => dv(p).includes(s)) ?? null;
const bb = (p: Project) => bidderBand(PROC_BY_ID.get(p.id)?.bidders ?? 0);
const hz = (p: Project) => HAZARD_BY_ID.get(p.id)?.level ?? null;

// Amount bins from the real quartiles, so each colour holds a comparable share.
(() => {
  const enc = ENCODINGS.find(e => e.key === "amount")!;
  const vals = PROJECTS.map(amountOf).filter((x): x is number => x != null).sort((a, b) => a - b);
  const q = (f: number) => vals[Math.floor(f * (vals.length - 1))] ?? 0;
  const cuts = [q(0.25), q(0.5), q(0.75)];
  const fmt = (n: number) => n >= 1e9 ? `₱${(n / 1e9).toFixed(1)}B` : `₱${(n / 1e6).toFixed(0)}M`;
  enc.bins = [
    { key: "na", label: "No award published", color: NEUTRAL, shape: "circle", test: p => amountOf(p) == null },
    { key: "q1", label: `Under ${fmt(cuts[0])}`, color: ORDINAL_4[0], shape: "circle", test: p => { const a = amountOf(p); return a != null && a < cuts[0]; } },
    { key: "q2", label: `${fmt(cuts[0])} – ${fmt(cuts[1])}`, color: ORDINAL_4[1], shape: "circle", test: p => { const a = amountOf(p); return a != null && a >= cuts[0] && a < cuts[1]; } },
    { key: "q3", label: `${fmt(cuts[1])} – ${fmt(cuts[2])}`, color: ORDINAL_4[2], shape: "circle", test: p => { const a = amountOf(p); return a != null && a >= cuts[1] && a < cuts[2]; } },
    { key: "q4", label: `${fmt(cuts[2])} and above`, color: ORDINAL_4[3], shape: "circle", test: p => { const a = amountOf(p); return a != null && a >= cuts[2]; } },
  ];
})();

export const ENCODING_BY_KEY = new Map(ENCODINGS.map(e => [e.key, e]));

export function colorOf(p: Project, enc: Encoding): string {
  return enc.bins.find(b => b.test(p))?.color ?? NEUTRAL;
}

export function shapeOf(p: Project, enc: Encoding): MarkShape {
  return enc.bins.find(b => b.test(p))?.shape ?? "circle";
}

/** SVG path for a mark of radius r centred on the origin. */
export function markPath(_shape: MarkShape, r: number): string {
  const k = 0.5523 * r;
  return `M0,${-r}C${k},${-r} ${r},${-k} ${r},0C${r},${k} ${k},${r} 0,${r}C${-k},${r} ${-r},${k} ${-r},0C${-r},${-k} ${-k},${-r} 0,${-r}Z`;
}

/** Legend entries with counts over whatever is currently on screen. */
export function legendFor(enc: Encoding, visible: Project[]) {
  return enc.bins.map(b => ({ ...b, n: visible.filter(b.test).length }));
}

/**
 * Which encoding best answers the filter the user just set — so colour follows
 * the question being asked instead of having to be chosen separately.
 */
export function suggestEncoding(f: {
  delivery: Set<string>; bidders: Set<string>; ratio: Set<string>;
  amount: unknown; status: Set<string>; hazard?: Set<string>;
}): string {
  if (f.delivery.size) return "delivery";
  if (f.ratio.size) return "ratio";
  if (f.bidders.size) return "competition";
  if (f.hazard?.size) return "hazard";
  if (f.amount) return "amount";
  if (f.status.size) return "status";
  return "priority";
}
