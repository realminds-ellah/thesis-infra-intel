/**
 * Faceted filtering for the project register.
 *
 * Design follows what infrastructure-transparency tooling actually needs, rather
 * than what is easy to build:
 *
 *  - Every facet is MULTI-select. Single-select dropdowns force a user to choose
 *    between "show me Calumpit" and "show me Hagonoy" when the real question is
 *    usually about several places at once.
 *  - Every option carries a LIVE COUNT computed against all *other* active
 *    filters. Options that would return nothing are visibly zero instead of
 *    leading someone into an empty screen.
 *  - Filters cover DELIVERY and INTEGRITY, not just metadata. DPWH's five status
 *    values describe paperwork; "overdue", "stalled" and "rebuilt on the same
 *    site" describe what is happening on the ground, which is what an inspector
 *    triages on.
 *  - State is URL-encodable, because a transparency finding that cannot be sent
 *    to someone else as a link is not much of a finding.
 *
 * Money is filtered on `awardAmount` — never on `budget`, which pipeline
 * verification showed matches the approved budget on 55% of contracts and the
 * award on 43%, and is reliably neither.
 */

import {
  PROJECTS, PROC_BY_ID, SAT_BY_ID, FUSED_BY_ID, FLAG_LABELS, PROC_FLAG_LABELS,
  type Project, type ProjectStatus, type Quadrant, type Verdict,
} from "./data";

export type DeliveryState = "overdue" | "stalled" | "rebuilt" | "unpaid";
export type BidderBand = "1" | "2" | "3-5" | "6+";
export type RatioBand = "at96" | "whole" | "other";
export type CoordState = "published" | "missing" | "mismatch" | "outside";
export type DocState = "complete" | "partial" | "none";

export interface Filters {
  q: string;
  contractor: string;
  status: Set<ProjectStatus>;
  delivery: Set<DeliveryState>;
  municipality: Set<string>;
  years: [number, number] | null;
  amount: [number, number] | null;
  bidders: Set<BidderBand>;
  ratio: Set<RatioBand>;
  recordFlags: Set<string>;
  procFlags: Set<string>;
  quadrant: Set<Quadrant>;
  satellite: Set<Verdict | "not-assessed">;
  coords: Set<CoordState>;
  docs: Set<DocState>;
}

export const emptyFilters = (): Filters => ({
  q: "", contractor: "",
  status: new Set(), delivery: new Set(), municipality: new Set(),
  years: null, amount: null,
  bidders: new Set(), ratio: new Set(), recordFlags: new Set(),
  procFlags: new Set(), quadrant: new Set(), satellite: new Set(),
  coords: new Set(), docs: new Set(),
});

// ─── derived per-project attributes ───────────────────────────────────────────

export const amountOf = (p: Project): number | null => {
  const pr = PROC_BY_ID.get(p.id);
  return pr?.awardAmount ?? (p as unknown as { awardAmount?: number }).awardAmount ?? null;
};

export const bidderBand = (n: number): BidderBand =>
  n <= 1 ? "1" : n === 2 ? "2" : n <= 5 ? "3-5" : "6+";

export const ratioBand = (r: number | null | undefined): RatioBand | null => {
  if (r == null) return null;
  if (Math.abs(r * 100 - 96) < 0.01) return "at96";
  return Math.abs(r * 100 - Math.round(r * 100)) < 0.01 ? "whole" : "other";
};

export const coordState = (p: Project): CoordState => {
  if (p.lat == null || p.lng == null) return "missing";
  const codes = p.auditFlags.map(f => f.code);
  if (codes.includes("OUTSIDE_PROVINCE") || codes.includes("UNLOCATABLE_COORD")) return "outside";
  if (codes.includes("MUNI_MISMATCH")) return "mismatch";
  return "published";
};

export const docState = (p: Project): DocState => {
  const d = PROC_BY_ID.get(p.id)?.documents;
  if (!d) return "none";
  const core = [d.contractAgreement, d.noticeOfAward, d.noticeToProceed, d.advertisement];
  const have = core.filter(Boolean).length;
  return have === 0 ? "none" : have === core.length ? "complete" : "partial";
};

const deliveryStates = (p: Project): DeliveryState[] => {
  const x = p as unknown as { overdue?: boolean; stalled?: boolean; siteRebuilds?: number };
  const out: DeliveryState[] = [];
  if (x.overdue) out.push("overdue");
  if (x.stalled) out.push("stalled");
  if ((x.siteRebuilds ?? 0) > 0) out.push("rebuilt");
  if (p.dpwhStatus === "Completed" && p.amountPaid === 0) out.push("unpaid");
  return out;
};

// ─── predicates, one per facet ────────────────────────────────────────────────
// Split out so facet counting can exclude exactly one dimension at a time, which
// is what makes the displayed counts honest rather than decorative.

type Pred = (p: Project) => boolean;

const preds = (f: Filters): Record<keyof Filters, Pred> => ({
  q: p => !f.q || `${p.id} ${p.description} ${p.municipality}`.toLowerCase().includes(f.q.toLowerCase()),
  contractor: p => !f.contractor || p.contractor.toLowerCase().includes(f.contractor.toLowerCase()),
  status: p => f.status.size === 0 || f.status.has(p.status),
  delivery: p => f.delivery.size === 0 || deliveryStates(p).some(s => f.delivery.has(s)),
  municipality: p => f.municipality.size === 0 || f.municipality.has(p.municipality),
  years: p => !f.years || (p.infraYear != null && p.infraYear >= f.years[0] && p.infraYear <= f.years[1]),
  amount: p => {
    if (!f.amount) return true;
    const a = amountOf(p);
    return a != null && a >= f.amount[0] && a <= f.amount[1];
  },
  bidders: p => f.bidders.size === 0 || f.bidders.has(bidderBand(PROC_BY_ID.get(p.id)?.bidders ?? 0)),
  ratio: p => {
    if (f.ratio.size === 0) return true;
    const b = ratioBand(PROC_BY_ID.get(p.id)?.bidRatio);
    return b != null && f.ratio.has(b);
  },
  recordFlags: p => f.recordFlags.size === 0 || p.auditFlags.some(x => f.recordFlags.has(x.code)),
  procFlags: p => f.procFlags.size === 0 ||
    (PROC_BY_ID.get(p.id)?.procurementFlags ?? []).some(x => f.procFlags.has(x.code)),
  quadrant: p => f.quadrant.size === 0 || f.quadrant.has(FUSED_BY_ID.get(p.id)?.quadrant ?? "neither"),
  satellite: p => f.satellite.size === 0 ||
    f.satellite.has((SAT_BY_ID.get(p.id)?.verdict ?? "not-assessed") as Verdict | "not-assessed"),
  coords: p => f.coords.size === 0 || f.coords.has(coordState(p)),
  docs: p => f.docs.size === 0 || f.docs.has(docState(p)),
});

export function applyFilters(f: Filters, source: Project[] = PROJECTS): Project[] {
  const P = preds(f);
  const keys = Object.keys(P) as (keyof Filters)[];
  return source.filter(p => keys.every(k => P[k](p)));
}

/**
 * Counts for one facet's options, computed with that facet's own filter removed.
 * Without the exclusion, selecting "Completed" would drop every other status to
 * zero and the panel would stop telling you anything.
 */
export function facetCounts<T extends string>(
  f: Filters, dim: keyof Filters, valuesOf: (p: Project) => T[],
): Map<T, number> {
  const P = preds(f);
  const keys = (Object.keys(P) as (keyof Filters)[]).filter(k => k !== dim);
  const out = new Map<T, number>();
  for (const p of PROJECTS) {
    if (!keys.every(k => P[k](p))) continue;
    for (const v of valuesOf(p)) out.set(v, (out.get(v) ?? 0) + 1);
  }
  return out;
}

export const countBy = {
  status: (f: Filters) => facetCounts(f, "status", p => [p.status]),
  delivery: (f: Filters) => facetCounts(f, "delivery", deliveryStates),
  municipality: (f: Filters) => facetCounts(f, "municipality", p => [p.municipality]),
  bidders: (f: Filters) => facetCounts(f, "bidders", p => [bidderBand(PROC_BY_ID.get(p.id)?.bidders ?? 0)]),
  ratio: (f: Filters) => facetCounts(f, "ratio", p => {
    const b = ratioBand(PROC_BY_ID.get(p.id)?.bidRatio); return b ? [b] : [];
  }),
  recordFlags: (f: Filters) => facetCounts(f, "recordFlags", p => p.auditFlags.map(x => x.code)),
  procFlags: (f: Filters) => facetCounts(f, "procFlags",
    p => (PROC_BY_ID.get(p.id)?.procurementFlags ?? []).map(x => x.code)),
  quadrant: (f: Filters) => facetCounts(f, "quadrant", p => [FUSED_BY_ID.get(p.id)?.quadrant ?? "neither"]),
  satellite: (f: Filters) => facetCounts(f, "satellite",
    p => [(SAT_BY_ID.get(p.id)?.verdict ?? "not-assessed") as string]),
  coords: (f: Filters) => facetCounts(f, "coords", p => [coordState(p)]),
  docs: (f: Filters) => facetCounts(f, "docs", p => [docState(p)]),
};

// ─── bounds, taken from the data rather than hard-coded ───────────────────────
// The old slider ran a fixed PHP 5M-100M+, which silently excluded the twelve
// largest contracts in the register — PHP 1.66 B, 3% of all value, and exactly
// the end of the distribution an auditor cares about most.

export const AMOUNT_BOUNDS: [number, number] = (() => {
  const a = PROJECTS.map(amountOf).filter((x): x is number => x != null);
  return a.length ? [Math.floor(Math.min(...a)), Math.ceil(Math.max(...a))] : [0, 1];
})();

export const YEAR_BOUNDS: [number, number] = (() => {
  const y = PROJECTS.map(p => p.infraYear).filter((x): x is number => x != null);
  return y.length ? [Math.min(...y), Math.max(...y)] : [2016, 2026];
})();

/** Equal-width histogram of award amounts, for context behind the range control. */
export const AMOUNT_HISTOGRAM = (() => {
  const bins = 32;
  const [lo, hi] = AMOUNT_BOUNDS;
  const step = (hi - lo) / bins || 1;
  const counts = new Array(bins).fill(0);
  for (const p of PROJECTS) {
    const a = amountOf(p);
    if (a == null) continue;
    counts[Math.min(bins - 1, Math.floor((a - lo) / step))]++;
  }
  return { lo, hi, step, counts, max: Math.max(...counts, 1) };
})();

// ─── presets ──────────────────────────────────────────────────────────────────
// Named entry points for the questions people actually arrive with, so the first
// useful view is one click away instead of six.

export interface Preset { key: string; label: string; hint: string; build: () => Filters }

export const PRESETS: Preset[] = [
  {
    key: "attention", label: "Needs attention",
    hint: "Past its completion date and still unfinished, or barely started",
    build: () => ({ ...emptyFilters(), delivery: new Set<DeliveryState>(["overdue", "stalled"]) }),
  },
  {
    key: "rebuilt", label: "Rebuilt sites",
    hint: "Work done again at the same coordinate in a later year — the closest signal in this data that a structure failed or was never there",
    build: () => ({ ...emptyFilters(), delivery: new Set<DeliveryState>(["rebuilt"]) }),
  },
  {
    key: "both", label: "Both signals",
    hint: "Contract record and bidding pattern both flagged — the top of the audit queue",
    build: () => ({ ...emptyFilters(), quadrant: new Set<Quadrant>(["both"]) }),
  },
  {
    key: "at96", label: "The 96.00% club",
    hint: "Won at exactly 96.00% of the approved budget, against a 3.9% national rate",
    build: () => ({ ...emptyFilters(), ratio: new Set<RatioBand>(["at96"]) }),
  },
  {
    key: "nocomp", label: "Thin competition",
    hint: "One or two bidders",
    build: () => ({ ...emptyFilters(), bidders: new Set<BidderBand>(["1", "2"]) }),
  },
  {
    key: "badcoord", label: "Location problems",
    hint: "No coordinate published, or one that contradicts the contract description",
    build: () => ({ ...emptyFilters(), coords: new Set<CoordState>(["missing", "mismatch", "outside"]) }),
  },
  {
    key: "nodocs", label: "Undocumented",
    hint: "No contract document published",
    build: () => ({ ...emptyFilters(), docs: new Set<DocState>(["none"]) }),
  },
];

// ─── URL state ────────────────────────────────────────────────────────────────

const SETS: (keyof Filters)[] = ["status", "delivery", "municipality", "bidders",
  "ratio", "recordFlags", "procFlags", "quadrant", "satellite", "coords", "docs"];

export function toQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.contractor) p.set("c", f.contractor);
  for (const k of SETS) {
    const s = f[k] as Set<string>;
    if (s.size) p.set(k, [...s].join(","));
  }
  if (f.years) p.set("years", f.years.join("-"));
  if (f.amount) p.set("amount", f.amount.join("-"));
  return p.toString();
}

export function fromQuery(qs: string): Filters {
  const p = new URLSearchParams(qs);
  const f = emptyFilters();
  f.q = p.get("q") ?? "";
  f.contractor = p.get("c") ?? "";
  for (const k of SETS) {
    const v = p.get(k);
    if (v) (f[k] as Set<string>) = new Set(v.split(",").filter(Boolean));
  }
  const y = p.get("years")?.split("-").map(Number);
  if (y?.length === 2 && y.every(Number.isFinite)) f.years = [y[0], y[1]];
  const a = p.get("amount")?.split("-").map(Number);
  if (a?.length === 2 && a.every(Number.isFinite)) f.amount = [a[0], a[1]];
  return f;
}

export function activeCount(f: Filters): number {
  let n = 0;
  if (f.q) n++;
  if (f.contractor) n++;
  if (f.years) n++;
  if (f.amount) n++;
  for (const k of SETS) n += (f[k] as Set<string>).size ? 1 : 0;
  return n;
}

export const LABELS = {
  delivery: {
    overdue: "Overdue", stalled: "Stalled",
    rebuilt: "Rebuilt at same site", unpaid: "Completed, nothing disbursed",
  } as Record<DeliveryState, string>,
  bidders: { "1": "1 bidder", "2": "2 bidders", "3-5": "3–5 bidders", "6+": "6 or more" } as Record<BidderBand, string>,
  ratio: { at96: "Exactly 96.00% of ABC", whole: "Other whole percentage", other: "Not a whole percentage" } as Record<RatioBand, string>,
  coords: { published: "Published and consistent", missing: "No coordinate", mismatch: "Contradicts description", outside: "Outside the province" } as Record<CoordState, string>,
  docs: { complete: "All four documents", partial: "Some documents", none: "None published" } as Record<DocState, string>,
  flags: FLAG_LABELS,
  procFlags: PROC_FLAG_LABELS,
};
