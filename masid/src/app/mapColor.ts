/**
 * Colour encodings for the map.
 *
 * Every palette here was run through the data-viz validator against the map's
 * actual surface (#f2f2f0) rather than against white, and against ALL pairs
 * rather than adjacent ones — map markers are a scatter form, so any two
 * categories can end up side by side.
 *
 * Two findings from that validation shaped the design:
 *
 *  1. The obvious choice — the status palette's green/amber/orange/red — FAILS
 *     badly as a map encoding: red↔green separate by only ΔE 4.1 under deutan
 *     simulation, and orange↔amber by 13.6 even under normal vision. It is kept
 *     for badges, where an icon and a word carry the meaning, and is not used to
 *     colour marks.
 *
 *  2. Almost every dimension worth colouring by here is ORDINAL — audit
 *     priority, delivery concern, thinness of competition, award size. Ordered
 *     data wants a single-hue ramp, light to dark, not a set of distinct hues.
 *     That sidesteps the categorical three-slot ceiling entirely, because a ramp
 *     is validated on monotone lightness rather than on pairwise separation.
 *
 * The one genuinely nominal dimension, reported status, has five values. Past
 * three the palette cannot clear the all-pairs floors, so the two rarest fold
 * into "Other" exactly as the method prescribes.
 *
 * Ramps validated on 2026-08-04, light mode, surface #f2f2f0:
 *   4-step ordinal  #6da7ec #3987e5 #256abf #104281                 ALL PASS
 *   5-step ordinal  #6da7ec #3987e5 #256abf #184f95 #0d366b         ALL PASS
 *   3-slot categorical #2a78d6 #eb6834 #1baf7a  (--pairs all)       ALL PASS
 *
 * The categorical set carries a contrast WARN (orange 2.85:1, aqua 2.51:1
 * against the surface). The method's relief rule applies and is satisfied: the
 * legend is always visible, always labelled, and always carries counts, so
 * identity is never colour-alone.
 */

import { PROJECTS, PROC_BY_ID, FUSED_BY_ID, type Project } from "./data";
import { amountOf, bidderBand, ratioBand } from "./filters";

/** Neutral for "no signal" / "Other". Deliberately low-chroma so it recedes. */
export const NEUTRAL = "#9a9a94";

const ORDINAL_4 = ["#6da7ec", "#3987e5", "#256abf", "#104281"];
const ORDINAL_5 = ["#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
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

export interface Bin { key: string; label: string; color: string; test: (p: Project) => boolean }
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
      { key: "0", label: "No flags", color: NEUTRAL, test: p => flagCount(p) === 0 },
      { key: "1", label: "1 flag", color: ORDINAL_4[0], test: p => flagCount(p) === 1 },
      { key: "2", label: "2 flags", color: ORDINAL_4[1], test: p => flagCount(p) === 2 },
      { key: "3", label: "3 flags", color: ORDINAL_4[2], test: p => flagCount(p) === 3 },
      { key: "4", label: "4 or more", color: ORDINAL_4[3], test: p => flagCount(p) >= 4 },
    ],
  },
  {
    key: "delivery",
    label: "Delivery concern",
    kind: "ordinal",
    note: "What is happening on the ground, ordered by how much attention it warrants. A contract can meet several states; the most serious wins.",
    bins: [
      { key: "ok", label: "Nothing flagged", color: NEUTRAL, test: p => !dv(p).length },
      { key: "unpaid", label: "Completed, nothing disbursed", color: ORDINAL_5[0], test: p => top(p) === "unpaid" },
      { key: "rebuilt", label: "Rebuilt at same site", color: ORDINAL_5[2], test: p => top(p) === "rebuilt" },
      { key: "overdue", label: "Overdue", color: ORDINAL_5[3], test: p => top(p) === "overdue" },
      { key: "stalled", label: "Stalled", color: ORDINAL_5[4], test: p => top(p) === "stalled" },
    ],
  },
  {
    key: "competition",
    label: "Competition",
    kind: "ordinal",
    note: "Bidders on the contract. Darker is thinner competition, so the concerning end is the heavy end.",
    bins: [
      { key: "6+", label: "6 or more bidders", color: ORDINAL_4[0], test: p => bb(p) === "6+" },
      { key: "3-5", label: "3–5 bidders", color: ORDINAL_4[1], test: p => bb(p) === "3-5" },
      { key: "2", label: "2 bidders", color: ORDINAL_4[2], test: p => bb(p) === "2" },
      { key: "1", label: "1 bidder", color: ORDINAL_4[3], test: p => bb(p) === "1" },
    ],
  },
  {
    key: "ratio",
    label: "Bid vs approved budget",
    kind: "categorical",
    note: "Whether the winning bid lands on a whole percentage of the approved budget. Three genuinely distinct cases, so distinct hues rather than a ramp.",
    bins: [
      { key: "at96", label: "Exactly 96.00%", color: CAT_3[1], test: p => ratioBand(PROC_BY_ID.get(p.id)?.bidRatio) === "at96" },
      { key: "whole", label: "Another whole %", color: CAT_3[0], test: p => ratioBand(PROC_BY_ID.get(p.id)?.bidRatio) === "whole" },
      { key: "other", label: "Not a whole %", color: CAT_3[2], test: p => ratioBand(PROC_BY_ID.get(p.id)?.bidRatio) === "other" },
      { key: "none", label: "No award published", color: NEUTRAL, test: p => ratioBand(PROC_BY_ID.get(p.id)?.bidRatio) == null },
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
    key: "status",
    label: "Reported status",
    kind: "categorical",
    note: "DPWH's own status. Five values, but the palette only clears the all-pairs floors for three, so the two rarest fold into Other rather than being given colours that cannot be told apart.",
    bins: [
      { key: "completed", label: "Completed", color: CAT_3[2], test: p => p.status === "completed" },
      { key: "ongoing", label: "Ongoing", color: CAT_3[0], test: p => p.status === "ongoing" },
      { key: "flagged", label: "Flagged for review", color: CAT_3[1], test: p => p.status === "flagged" },
      { key: "other", label: "Proposed or terminated", color: NEUTRAL, test: p => p.status === "proposed" || p.status === "terminated" },
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

// Amount bins from the real quartiles, so each colour holds a comparable share.
(() => {
  const enc = ENCODINGS.find(e => e.key === "amount")!;
  const vals = PROJECTS.map(amountOf).filter((x): x is number => x != null).sort((a, b) => a - b);
  const q = (f: number) => vals[Math.floor(f * (vals.length - 1))] ?? 0;
  const cuts = [q(0.25), q(0.5), q(0.75)];
  const fmt = (n: number) => n >= 1e9 ? `₱${(n / 1e9).toFixed(1)}B` : `₱${(n / 1e6).toFixed(0)}M`;
  enc.bins = [
    { key: "na", label: "No award published", color: NEUTRAL, test: p => amountOf(p) == null },
    { key: "q1", label: `Under ${fmt(cuts[0])}`, color: ORDINAL_4[0], test: p => { const a = amountOf(p); return a != null && a < cuts[0]; } },
    { key: "q2", label: `${fmt(cuts[0])} – ${fmt(cuts[1])}`, color: ORDINAL_4[1], test: p => { const a = amountOf(p); return a != null && a >= cuts[0] && a < cuts[1]; } },
    { key: "q3", label: `${fmt(cuts[1])} – ${fmt(cuts[2])}`, color: ORDINAL_4[2], test: p => { const a = amountOf(p); return a != null && a >= cuts[1] && a < cuts[2]; } },
    { key: "q4", label: `${fmt(cuts[2])} and above`, color: ORDINAL_4[3], test: p => { const a = amountOf(p); return a != null && a >= cuts[2]; } },
  ];
})();

export const ENCODING_BY_KEY = new Map(ENCODINGS.map(e => [e.key, e]));

export function colorOf(p: Project, enc: Encoding): string {
  return enc.bins.find(b => b.test(p))?.color ?? NEUTRAL;
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
  amount: unknown; status: Set<string>;
}): string {
  if (f.delivery.size) return "delivery";
  if (f.ratio.size) return "ratio";
  if (f.bidders.size) return "competition";
  if (f.amount) return "amount";
  if (f.status.size) return "status";
  return "priority";
}
