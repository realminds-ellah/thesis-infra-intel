/**
 * The filter panel for the project register.
 *
 * Replaces a sidebar whose only real controls were five status checkboxes and a
 * single-handle budget slider running a hard-coded PHP 5M–100M — a range that
 * silently excluded the twelve largest contracts in the register.
 *
 * Every group below shows live counts and collapses; the panel opens on the
 * groups that answer the first question most people have.
 */

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search, X, Link2, RotateCcw } from "lucide-react";

import {
  type Filters, type DeliveryState, type BidderBand, type RatioBand,
  type CoordState, type DocState, type HazardState,
  applyFilters, countBy, AMOUNT_BOUNDS, YEAR_BOUNDS, AMOUNT_HISTOGRAM,
  PRESETS, LABELS, PROBLEM_LABELS, PROC_CODES, problemCounts, activeCount, emptyFilters, toQuery,
  CONCERNS, type ConcernKey,
} from "./filters";
import { META, VERDICT_CFG, type Verdict, type ProjectStatus } from "./data";
import type { Role } from "./roles";
import { ROLE_VIEWS, GROUP_TITLES, type GroupKey } from "./roleFilters";

const peso = (n: number) =>
  n >= 1e9 ? `₱${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `₱${(n / 1e6).toFixed(1)}M` : `₱${(n / 1e3).toFixed(0)}K`;

function Group({ title, count, defaultOpen = false, children }:
  { title: string; count?: number; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-3 py-2.5 text-left hover:bg-gray-50">
        {open ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex-1">{title}</span>
        {count ? <span className="text-[10px] font-mono px-1.5 rounded bg-[#1e3a7b] text-white">{count}</span> : null}
      </button>
      {open && <div className="px-3 pb-3 space-y-1.5">{children}</div>}
    </div>
  );
}

/** A checkbox whose count is computed with its own facet excluded. */
function Opt({ label, n, on, toggle, hint }:
  { label: string; n: number; on: boolean; toggle: () => void; hint?: string }) {
  const dead = n === 0 && !on;
  return (
    <button onClick={toggle} disabled={dead} title={hint}
      className={`w-full flex items-center gap-2 text-left group ${dead ? "opacity-35 cursor-default" : ""}`}>
      <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${
        on ? "bg-[#1e3a7b] border-[#1e3a7b]" : "border-gray-300 group-hover:border-gray-400"}`}>
        {on && <svg width="9" height="9" viewBox="0 0 10 10"><path d="M1 5l2.5 2.5L9 2" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
      <span className="text-[12px] text-gray-700 flex-1 leading-tight">{label}</span>
      <span className="text-[10px] font-mono text-gray-400 tabular-nums">{n.toLocaleString()}</span>
    </button>
  );
}

/** Dual-handle range with the real distribution drawn behind it. */
function RangeControl({ bounds, value, onChange, format, histogram }: {
  bounds: [number, number];
  value: [number, number] | null;
  onChange: (v: [number, number] | null) => void;
  format: (n: number) => string;
  histogram?: { counts: number[]; max: number };
}) {
  const [lo, hi] = value ?? bounds;
  const set = (a: number, b: number) =>
    onChange(a <= bounds[0] && b >= bounds[1] ? null : [Math.min(a, b), Math.max(a, b)]);
  return (
    <div>
      {histogram && (
        <div className="flex items-end gap-px h-9 mb-1" aria-hidden>
          {histogram.counts.map((c, i) => {
            const x0 = bounds[0] + (i / histogram.counts.length) * (bounds[1] - bounds[0]);
            const inRange = x0 >= lo && x0 <= hi;
            return <div key={i} className="flex-1 rounded-sm"
              style={{ height: `${Math.max(3, (c / histogram.max) * 100)}%`, background: inRange ? "#1e3a7b" : "#dbe2ec" }} />;
          })}
        </div>
      )}
      <div className="relative h-4">
        {(["lo", "hi"] as const).map(which => (
          <input key={which} type="range" min={bounds[0]} max={bounds[1]}
            step={Math.max(1, Math.round((bounds[1] - bounds[0]) / 400))}
            value={which === "lo" ? lo : hi}
            aria-label={which === "lo" ? "Minimum" : "Maximum"}
            onChange={e => {
              const v = Number(e.target.value);
              which === "lo" ? set(v, hi) : set(lo, v);
            }}
            className="absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none
                       [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none
                       [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                       [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                       [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#1e3a7b]
                       [&::-webkit-slider-thumb]:shadow" />
        ))}
        <div className="absolute top-1.5 inset-x-0 h-1 rounded bg-gray-200" />
        <div className="absolute top-1.5 h-1 rounded bg-[#1e3a7b]" style={{
          left: `${((lo - bounds[0]) / (bounds[1] - bounds[0])) * 100}%`,
          right: `${100 - ((hi - bounds[0]) / (bounds[1] - bounds[0])) * 100}%`,
        }} />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-gray-500 mt-1">
        <span>{format(lo)}</span><span>{format(hi)}</span>
      </div>
    </div>
  );
}

export function FilterPanel({ filters, setFilters, collapsed, role = "dpwh-admin" }:
  { filters: Filters; setFilters: (f: Filters) => void; collapsed?: boolean; role?: Role }) {
  const view = ROLE_VIEWS[role] ?? ROLE_VIEWS["dpwh-admin"];
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const result = useMemo(() => applyFilters(filters), [filters]);
  const c = useMemo(() => ({
    status: countBy.status(filters), delivery: countBy.delivery(filters),
    municipality: countBy.municipality(filters), bidders: countBy.bidders(filters),
    ratio: countBy.ratio(filters), recordFlags: countBy.recordFlags(filters),
    procFlags: countBy.procFlags(filters), quadrant: countBy.quadrant(filters),
    satellite: countBy.satellite(filters), coords: countBy.coords(filters),
    docs: countBy.docs(filters), hazard: countBy.hazard(filters),
    problems: problemCounts(filters), concerns: countBy.concerns(filters),
  }), [filters]);

  const toggle = <K extends keyof Filters>(dim: K, v: string) => {
    const next = { ...filters, [dim]: new Set(filters[dim] as Set<string>) } as Filters;
    const s = next[dim] as Set<string>;
    s.has(v) ? s.delete(v) : s.add(v);
    setFilters(next);
  };
  const active = activeCount(filters);

  if (collapsed) return null;

  return (
    <aside className="w-64 shrink-0 border-r border-gray-200 bg-white flex flex-col" aria-label="Filters">
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-2">
        <span className="text-[12px] font-bold text-gray-800">Filters</span>
        {active > 0 && <span className="text-[10px] font-mono px-1.5 rounded bg-amber-100 text-amber-700">{active}</span>}
        <div className="ml-auto flex items-center gap-1">
          <button title="Copy a link to this exact view"
            onClick={() => {
              const url = `${location.origin}${location.pathname}?${toQuery(filters)}`;
              navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1400);
            }}
            className="p-1 text-gray-400 hover:text-[#1e3a7b] rounded"><Link2 size={13} /></button>
          {active > 0 && (
            <button onClick={() => setFilters(emptyFilters())} title="Clear all filters"
              className="p-1 text-gray-400 hover:text-red-500 rounded"><RotateCcw size={13} /></button>
          )}
        </div>
      </div>

      <div className="px-3 py-2 border-b border-gray-100">
        <div className="text-[11px] text-gray-500">
          <span className="font-mono font-bold text-[#1e3a7b] text-[13px]">{result.length.toLocaleString()}</span>
          <span> of {META.coverage.projects.toLocaleString()} contracts</span>
        </div>
        <p className="text-[10px] text-gray-400 leading-snug mt-1">{view.blurb}</p>
        {copied && <div className="text-[10px] text-green-600 mt-0.5">Link copied</div>}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div className="px-3 py-2.5 border-b border-gray-100">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Common questions</div>
          <div className="flex flex-wrap gap-1.5">
            {view.presets.map(k => PRESETS.find(p => p.key === k)).filter(Boolean).map(p => p!).map(p => (
              <button key={p.key} title={p.hint} onClick={() => setFilters(p.build())}
                className="text-[11px] px-2 py-1 rounded border border-gray-200 text-gray-600 hover:border-[#1e3a7b]/40 hover:bg-blue-50 hover:text-[#1e3a7b]">
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-3 py-2.5 border-b border-gray-100 space-y-2">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })}
              placeholder="Search by place or project…" aria-label="Search contracts"
              className="w-full pl-7 pr-6 py-1.5 text-[12px] border border-gray-200 rounded bg-gray-50 focus:outline-none focus:border-[#1e3a7b]" />
            {filters.q && <button onClick={() => setFilters({ ...filters, q: "" })} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X size={11} /></button>}
          </div>
          <input value={filters.contractor} onChange={e => setFilters({ ...filters, contractor: e.target.value })}
            placeholder="Which company built it?" aria-label="Filter by contractor"
            className="w-full px-2.5 py-1.5 text-[12px] border border-gray-200 rounded bg-gray-50 focus:outline-none focus:border-[#1e3a7b]" />
        </div>

        {(() => {
          const B: Record<GroupKey, React.ReactNode> = {
            where: (<>
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1" style={{ scrollbarWidth: "none" }}>
                {[...c.municipality.keys()].sort((a, b) => (c.municipality.get(b) ?? 0) - (c.municipality.get(a) ?? 0)).map(k => (
                  <Opt key={k} label={k} n={c.municipality.get(k) ?? 0}
                    on={filters.municipality.has(k)} toggle={() => toggle("municipality", k)} />
                ))}
              </div>
            </>),
            finished: (<>
              {/* Stage is what DPWH itself reports, and every project is exactly
                  one of these — so the four together always add to the register.
                  Nothing about problems belongs here: a defective structure is
                  still a finished one, and mixing the two is what made the app
                  under-report completions by 245. */}
              <div className="grid grid-cols-2 gap-1.5">
                {(["completed", "ongoing", "proposed", "terminated"] as ProjectStatus[]).map(k => {
                  const n = c.status.get(k) ?? 0, on = filters.status.has(k);
                  return (
                    <button key={k} onClick={() => toggle("status", k)} disabled={n === 0 && !on}
                      className={`text-left px-2.5 py-2 rounded border transition-colors ${
                        on ? "border-[#1e3a7b] bg-blue-50" : n === 0 ? "border-gray-100 opacity-40" : "border-gray-200 hover:border-gray-300"}`}>
                      <div className={`font-mono text-[15px] font-bold ${on ? "text-[#1e3a7b]" : "text-gray-700"}`}>{n.toLocaleString()}</div>
                      <div className="text-[11px] text-gray-500 leading-tight">{LABELS.status[k]}</div>
                    </button>
                  );
                })}
              </div>
            </>),
            problems: (<>
              {/* Six chips instead of eighteen tickboxes. The individual checks
                  are still filterable, one disclosure down, for whoever needs
                  them — but nobody arrives at a public register wanting to tick
                  "UNLOCATABLE_COORD". */}
              <div className="flex flex-wrap gap-1.5">
                {CONCERNS.map(cn => {
                  const n = c.concerns.get(cn.key) ?? 0, on = filters.concerns.has(cn.key);
                  return (
                    <button key={cn.key} title={cn.hint} onClick={() => toggle("concerns", cn.key)}
                      disabled={n === 0 && !on}
                      className={`text-[11px] pl-2.5 pr-1.5 py-1 rounded-full border flex items-center gap-1.5 transition-colors ${
                        on ? "border-[#1e3a7b] bg-[#1e3a7b] text-white"
                           : n === 0 ? "border-gray-100 text-gray-300"
                           : "border-gray-200 text-gray-600 hover:border-[#1e3a7b]/40 hover:bg-blue-50"}`}>
                      {cn.label}
                      <span className={`font-mono text-[10px] px-1 rounded ${on ? "bg-white/20" : "bg-gray-100 text-gray-500"}`}>{n}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-400 leading-snug pt-2">
                A flag means the public record disagrees with itself. It is a reason to look,
                not proof that anything was done wrong.
              </p>
              <details className="pt-1">
                <summary className="text-[11px] text-[#1e3a7b] cursor-pointer hover:underline">Show the individual checks</summary>
                <div className="space-y-1.5 pt-2">
              {[...c.problems.keys()]
                .sort((a, b) => (c.problems.get(b) ?? 0) - (c.problems.get(a) ?? 0))
                .map(k => {
                  const dim = PROC_CODES.has(k) ? "procFlags" : "recordFlags";
                  return <Opt key={k} label={PROBLEM_LABELS[k] ?? k} n={c.problems.get(k) ?? 0}
                    on={(filters[dim] as Set<string>).has(k)} toggle={() => toggle(dim, k)} />;
                })}
                </div>
              </details>
            </>),
            cost: (<>
              <RangeControl bounds={AMOUNT_BOUNDS} value={filters.amount} format={peso}
                histogram={AMOUNT_HISTOGRAM} onChange={v => setFilters({ ...filters, amount: v })} />
              <p className="text-[10px] text-gray-400 leading-snug pt-1">The amount actually paid to the winning company.</p>
            </>),
            awarded: (<>
              {(["1", "2", "3-5", "6+"] as BidderBand[]).map(k => (
                <Opt key={k} label={LABELS.bidders[k]} n={c.bidders.get(k) ?? 0}
                  on={filters.bidders.has(k)} toggle={() => toggle("bidders", k)} />
              ))}
              <div className="pt-2 mt-1 border-t border-gray-100 space-y-1.5">
                {(["at96", "whole", "other"] as RatioBand[]).map(k => (
                  <Opt key={k} label={LABELS.ratio[k]} n={c.ratio.get(k) ?? 0}
                    on={filters.ratio.has(k)} toggle={() => toggle("ratio", k)}
                    hint={k === "at96" ? "Nearly 4 in 10 contracts here, against 4 in 100 nationally" : undefined} />
                ))}
              </div>
            </>),
            flood: (<>
              <p className="text-[10px] text-gray-400 leading-snug pb-1">
                Compared against the government&apos;s own flood model. Being just outside one is
                normal — that is where a flood wall belongs.
              </p>
              {(["high", "medium", "low", "edge", "far", "unknown"] as HazardState[]).map(k => (
                <Opt key={k} label={LABELS.hazard[k]} n={c.hazard.get(k) ?? 0}
                  on={filters.hazard.has(k)} toggle={() => toggle("hazard", k)} />
              ))}
            </>),
            documents: (<>
              {(["complete", "partial", "none"] as DocState[]).map(k => (
                <Opt key={k} label={LABELS.docs[k]} n={c.docs.get(k) ?? 0}
                  on={filters.docs.has(k)} toggle={() => toggle("docs", k)} />
              ))}
            </>),
            mappable: (<>
              {(["published", "missing", "mismatch", "outside"] as CoordState[]).map(k => (
                <Opt key={k} label={LABELS.coords[k]} n={c.coords.get(k) ?? 0}
                  on={filters.coords.has(k)} toggle={() => toggle("coords", k)} />
              ))}
            </>),
            imagery: (<>
              <p className="text-[10px] text-gray-400 leading-snug pb-1">
                The imagery tier showed no measured ability to tell flagged records from
                controls. Treat these as coverage, not as evidence.
              </p>
              {(["change-at-point", "change-offset", "no-change-signal", "not-assessable", "not-assessed"] as const).map(k => (
                <Opt key={k} label={k === "not-assessed" ? "Not assessed" : VERDICT_CFG[k as Verdict].short}
                  n={c.satellite.get(k) ?? 0} on={filters.satellite.has(k)} toggle={() => toggle("satellite", k)} />
              ))}
            </>),
            year: (<RangeControl bounds={YEAR_BOUNDS} value={filters.years}
              format={n => String(Math.round(n))} onChange={v => setFilters({ ...filters, years: v })} />),
          };
          const counts: Record<GroupKey, number> = {
            where: filters.municipality.size,
            finished: filters.status.size + filters.delivery.size,
            problems: filters.recordFlags.size + filters.procFlags.size,
            cost: filters.amount ? 1 : 0,
            awarded: filters.bidders.size + filters.ratio.size,
            flood: filters.hazard.size,
            documents: filters.docs.size,
            mappable: filters.coords.size,
            imagery: filters.satellite.size,
            year: filters.years ? 1 : 0,
          };
          const primary = view.groups.slice(0, view.openCount);
          const rest = view.groups.slice(view.openCount);
          return (<>
            {primary.map(g => (
              <Group key={g} title={GROUP_TITLES[g]} count={counts[g]} defaultOpen>{B[g]}</Group>
            ))}
            {(showAll ? rest : rest.filter(g => counts[g] > 0)).map(g => (
              <Group key={g} title={GROUP_TITLES[g]} count={counts[g]}>{B[g]}</Group>
            ))}
            {!showAll && rest.some(g => counts[g] === 0) && (
              <button onClick={() => setShowAll(true)}
                className="w-full px-3 py-2.5 text-left text-[11px] text-[#1e3a7b] hover:bg-gray-50">
                More filters …
              </button>
            )}
          </>);
        })()}
      </div>
    </aside>
  );
}
