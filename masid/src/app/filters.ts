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
  PROJECTS, PROC_BY_ID, SAT_BY_ID, FUSED_BY_ID, HAZARD_BY_ID, FLAG_LABELS, PROC_FLAG_LABELS,
  type Project, type ProjectStatus, type Quadrant, type Verdict,
} from "./data";

export type DeliveryState = "overdue" | "stalled" | "rebuilt" | "unpaid";
export type BidderBand = "1" | "2" | "3-5" | "6+";
export type RatioBand = "at96" | "whole" | "other";
export type CoordState = "published" | "missing" | "mismatch" | "outside";
export type DocState = "complete" | "partial" | "none";
export type HazardState = "high" | "medium" | "low" | "edge" | "far" | "unknown";

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
  hazard: Set<HazardState>;
  concerns: Set<ConcernKey>;
  /** One switch standing in for the whole condition list. */
  onlyProblems: boolean;
}

export const emptyFilters = (): Filters => ({
  q: "", contractor: "",
  status: new Set(), delivery: new Set(), municipality: new Set(),
  years: null, amount: null,
  bidders: new Set(), ratio: new Set(), recordFlags: new Set(),
  procFlags: new Set(), quadrant: new Set(), satellite: new Set(),
  coords: new Set(), docs: new Set(), hazard: new Set(), concerns: new Set(),
  onlyProblems: false,
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

/** Hazard at the coordinate, with "outside but adjacent" kept separate from
 *  "nowhere near" — the distinction that stops a normal edge-sited revetment
 *  being read as a misplaced one. */
export const hazardState = (p: Project): HazardState => {
  const h = HAZARD_BY_ID.get(p.id);
  if (!h || h.level == null) return "unknown";
  if (h.level >= 3) return "high";
  if (h.level === 2) return "medium";
  if (h.level === 1) return "low";
  return (h.metresToHazard ?? 0) > 1000 ? "far" : "edge";
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
  hazard: p => f.hazard.size === 0 || f.hazard.has(hazardState(p)),
  // Chips are OR'd with each other: ticking two concerns widens the result,
  // which is what "show me late OR rebuilt projects" means to a reader.
  concerns: p => f.concerns.size === 0 ||
    CONCERNS.some(c => f.concerns.has(c.key) && c.test(p)),
  // The condition list collapsed to one switch.
  //
  // Deliberately the RECORDS checks only, not the bidding ones. Including
  // procurement flags takes this from 310 contracts to 1,123 — 87% of the
  // register — because round-number bids alone are 709 and contractor
  // concentration another 366. A switch that selects seven contracts in eight
  // is not a filter, and "has a problem" would stop meaning anything.
  //
  // Bidding patterns are still shown on every contract's detail panel; they are
  // a property of how it was bought, not of the structure.
  onlyProblems: p => !f.onlyProblems || p.auditFlags.length > 0,
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
  hazard: (f: Filters) => facetCounts(f, "hazard", p => [hazardState(p)]),
  concerns: (f: Filters) => facetCounts(f, "concerns",
    p => CONCERNS.filter(c => c.test(p)).map(c => c.key)),
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
    key: "problems", label: "Something looks wrong",
    hint: "Every project where at least one check found a problem",
    build: () => ({ ...emptyFilters(), quadrant: new Set<Quadrant>(["both", "records-only", "procurement-only"]) }),
  },
  {
    key: "attention", label: "Running late",
    hint: "Past its finish date and still unfinished, or barely started",
    build: () => ({ ...emptyFilters(), delivery: new Set<DeliveryState>(["overdue", "stalled"]) }),
  },
  {
    key: "rebuilt", label: "Built more than once",
    hint: "The same spot was built again in a later year — usually because the first one failed or was never there",
    build: () => ({ ...emptyFilters(), delivery: new Set<DeliveryState>(["rebuilt"]) }),
  },
  {
    key: "nocomp", label: "Barely any competition",
    hint: "Only one or two companies bid for the work",
    build: () => ({ ...emptyFilters(), bidders: new Set<BidderBand>(["1", "2"]) }),
  },
  {
    key: "at96", label: "Suspiciously round bids",
    hint: "Won at exactly 96% of the approved budget. Nearly 4 in 10 contracts here do this, against 4 in 100 nationally",
    build: () => ({ ...emptyFilters(), ratio: new Set<RatioBand>(["at96"]) }),
  },
  {
    key: "badcoord", label: "Can't be found on a map",
    hint: "No location published, or one that contradicts the written description",
    build: () => ({ ...emptyFilters(), coords: new Set<CoordState>(["missing", "mismatch", "outside"]) }),
  },
  {
    key: "nodocs", label: "No paperwork",
    hint: "Not one contract document was published",
    build: () => ({ ...emptyFilters(), docs: new Set<DocState>(["none"]) }),
  },
  {
    key: "offhazard", label: "Nowhere near a flood zone",
    hint: "Over a kilometre from any area the government's own flood model covers",
    build: () => ({ ...emptyFilters(), hazard: new Set<HazardState>(["far"]) }),
  },
];

/**
 * Concern bundles — six chips that stand in for eighteen tickboxes.
 *
 * The individual flags are still there and still filterable; this is the layer
 * above them. Nobody arrives at a public register wanting to tick
 * "UNLOCATABLE_COORD" — they want to know whether the thing is late, whether it
 * has been built twice, or whether it can be found at all.
 *
 * Deliberately split into what is wrong with the STRUCTURE and what is odd about
 * the DEAL, because those are different questions with different audiences and
 * a citizen mostly wants the first.
 */
const at96 = (p: Project) => {
  const r = PROC_BY_ID.get(p.id)?.bidRatio;
  return r != null && Math.abs(r * 100 - 96) < 0.01;
};
const allCodes = (p: Project) => new Set([
  ...p.auditFlags.map(f => f.code),
  ...(PROC_BY_ID.get(p.id)?.procurementFlags ?? []).map(f => f.code),
]);
const anyOf = (p: Project, codes: string[]) => {
  const s = allCodes(p);
  return codes.some(c => s.has(c));
};

export type ConcernKey = "late" | "rebuilt" | "lost" | "nopaper" | "deal" | "dryland";

export interface Concern {
  key: ConcernKey;
  label: string;
  group: "structure" | "deal";
  hint: string;
  test: (p: Project) => boolean;
}

export const CONCERNS: Concern[] = [
  { key: "late", label: "Running late", group: "structure",
    hint: "Past its finish date and still unfinished",
    test: p => Boolean((p as never as { overdue?: boolean }).overdue) },
  { key: "rebuilt", label: "Built more than once", group: "structure",
    hint: "The same spot was built again in a later year. A structure that had to be redone is one that failed, washed away, or was never there — this is inferred from repeat contracts, not recorded anywhere",
    test: p => ((p as never as { siteRebuilds?: number }).siteRebuilds ?? 0) > 0 },
  { key: "lost", label: "Can't be found on a map", group: "structure",
    hint: "No location published, or one that contradicts the written description",
    test: p => anyOf(p, ["MISSING_COORDS", "MUNI_MISMATCH", "UNLOCATABLE_COORD",
                         "OUTSIDE_PROVINCE", "COORD_DUPLICATE"]) },
  { key: "nopaper", label: "No paperwork published", group: "structure",
    hint: "Not one contract document was published, against roughly 95% coverage",
    test: p => anyOf(p, ["NO_DOCUMENTS_PUBLISHED"]) },
  { key: "dryland", label: "Nowhere near flooding", group: "structure",
    hint: "Over a kilometre from any area the government's own flood model covers",
    test: p => {
      const h = HAZARD_BY_ID.get(p.id);
      return Boolean(h && h.level === 0 && (h.metresToHazard ?? 0) > 1000);
    } },
  { key: "deal", label: "Something odd about the deal", group: "deal",
    hint: "Won at exactly 96% of the budget, or only one bidder, or a very short bid window, or a contractor whose registration was revoked",
    test: p => at96(p) || anyOf(p, ["SINGLE_BIDDER", "SHORT_BID_WINDOW", "CONTRACTOR_REVOKED"]) },
];

export const CONCERN_BY_KEY = new Map(CONCERNS.map(c => [c.key, c]));

/** All problems, records and procurement alike, as one list a citizen can scan. */
export function problemCounts(f: Filters): Map<string, number> {
  const a = facetCounts(f, "recordFlags", p => p.auditFlags.map(x => x.code));
  const b = facetCounts(f, "procFlags", p => (PROC_BY_ID.get(p.id)?.procurementFlags ?? []).map(x => x.code));
  const out = new Map(a);
  for (const [k, v] of b) out.set(k, (out.get(k) ?? 0) + v);
  return out;
}

/** Which filter set a problem code belongs to, so one merged list can drive both. */
export const PROC_CODES = new Set(["SINGLE_BIDDER", "TWO_BIDDERS", "BID_AT_ROUND_PERCENT",
  "AWARD_CONCENTRATION", "SHORT_BID_WINDOW", "NO_DOCUMENTS_PUBLISHED"]);


// ─── URL state ────────────────────────────────────────────────────────────────

const SETS: (keyof Filters)[] = ["status", "delivery", "municipality", "bidders",
  "ratio", "recordFlags", "procFlags", "quadrant", "satellite", "coords", "docs", "hazard", "concerns"];

export function toQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.onlyProblems) p.set("problems", "1");
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
  f.onlyProblems = p.get("problems") === "1";
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
  if (f.onlyProblems) n++;
  for (const k of SETS) n += (f[k] as Set<string>).size ? 1 : 0;
  return n;
}

/**
 * Plain-language names for everything the register can flag.
 *
 * These replace the internal codes (MUNI_MISMATCH, BID_AT_ROUND_PERCENT) that
 * only make sense to whoever wrote the pipeline. A resident looking up the
 * project outside their house should be able to read every option here once and
 * know what it means.
 *
 * Records-tier and procurement-tier flags are deliberately merged into one list.
 * The distinction matters to the method and not at all to the person asking
 * whether something is wrong with a project on their street.
 */
export const PROBLEM_LABELS: Record<string, string> = {
  // where it is
  MISSING_COORDS: "No location was published",
  MUNI_MISMATCH: "Location doesn't match the written description",
  OUTSIDE_PROVINCE: "Location falls outside Bulacan",
  UNLOCATABLE_COORD: "Location isn't a real place on the map",
  OUTSIDE_DEO_AREA: "Location is outside this district's area",
  COORD_DUPLICATE: "Exact same spot as another project",
  BOUNDARY_ADJACENT: "Location sits just over a town border",
  // who built it
  CONTRACTOR_REVOKED: "Contractor's registration was revoked",
  AWARD_CONCENTRATION: "Contractor wins an unusually large share of work here",
  // how it was awarded
  SINGLE_BIDDER: "Only one company bid",
  TWO_BIDDERS: "Only two companies bid",
  BID_AT_ROUND_PERCENT: "Winning bid was a suspiciously round number",
  SHORT_BID_WINDOW: "Very little time was given to bid",
  // paperwork
  NO_DOCUMENTS_PUBLISHED: "No documents published",
  STATUS_PROGRESS_CONFLICT: "Marked finished, but progress says otherwise",
  DATE_ANOMALY: "Finish date is before the start date",
};

export const LABELS = {
  delivery: {
    overdue: "Past its finish date",
    stalled: "Barely started and already late",
    rebuilt: "Same spot was built again later",
    unpaid: "Marked finished, but no payment recorded",
  } as Record<DeliveryState, string>,
  bidders: { "1": "Only 1 company bid", "2": "Only 2 companies bid", "3-5": "3 to 5 companies bid", "6+": "6 or more companies bid" } as Record<BidderBand, string>,
  ratio: {
    at96: "Won at exactly 96% of the budget",
    whole: "Won at another round percentage",
    other: "Won at an ordinary amount",
  } as Record<RatioBand, string>,
  coords: {
    published: "Location looks right", missing: "No location published",
    mismatch: "Location doesn't match the description", outside: "Location is outside Bulacan",
  } as Record<CoordState, string>,
  docs: { complete: "All four documents", partial: "Some documents", none: "No documents" } as Record<DocState, string>,
  hazard: {
    high: "In a high flood-risk area", medium: "In a medium flood-risk area",
    low: "In a low flood-risk area", edge: "Just outside a flood-risk area",
    far: "Far from any flood-risk area", unknown: "No location published",
  } as Record<HazardState, string>,
  status: {
    completed: "Finished", ongoing: "Being built",
    proposed: "Not started yet", terminated: "Cancelled",
  } as Record<string, string>,
  flags: FLAG_LABELS,
  procFlags: PROC_FLAG_LABELS,
};
