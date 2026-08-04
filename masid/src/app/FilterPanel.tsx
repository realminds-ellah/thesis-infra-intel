/**
 * The map sidebar, back to the shape of the original design: one municipality
 * dropdown, status checkboxes, a contractor search, a budget slider, layer
 * toggles and a summary. Six controls, not sixty.
 *
 * What was carried over from the version in between is the correctness, never
 * the clutter:
 *
 *  - Status counts are the stage DPWH reports, so they add to the register
 *    (962 + 263 + 68 = 1,293). The earlier list mixed "flagged" in among the
 *    stages and hid 245 completed contracts inside it.
 *  - The budget slider reads `awardAmount` — what the contract was actually
 *    awarded for — and runs to the real maximum in the data. It used to run a
 *    hard-coded PHP 5M–100M over the ambiguous `budget` column, which silently
 *    excluded the twelve largest contracts in the register.
 *  - Counts are live against the other filters rather than fixed.
 *  - The whole condition list collapses to one switch, because finding the
 *    projects something is wrong with is still the point of the register.
 *
 * Layer toggles now drive the map instead of decorating the panel.
 */

import { useMemo } from "react";
import { Check, Filter, Layers, Search, X } from "lucide-react";

import {
  type Filters, applyFilters, countBy, AMOUNT_BOUNDS, LABELS, activeCount,
  emptyFilters, toQuery,
} from "./filters";
import { META, PROJECTS, type ProjectStatus } from "./data";
import type { Role } from "./roles";
import { ROLE_VIEWS } from "./roleFilters";

const peso = (n: number) =>
  n >= 1e9 ? `₱${(n / 1e9).toFixed(2)}B` : `₱${Math.round(n / 1e6)}M`;

const STATUS_TINT: Record<ProjectStatus, { dot: string; bg: string; text: string }> = {
  completed: { dot: "#046b04", bg: "#e6f2e6", text: "#046b04" },
  ongoing: { dot: "#2a78d6", bg: "#e6eefa", text: "#1c5cab" },
  proposed: { dot: "#9a9a94", bg: "#f0f0ee", text: "#6b6b64" },
  terminated: { dot: "#c0272d", bg: "#fbe9ea", text: "#c0272d" },
};

export interface MapLayers { markers: boolean; boundaries: boolean; labels: boolean }

export function FilterPanel({
  filters, setFilters, collapsed, role = "dpwh-admin", layers, setLayers,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  collapsed?: boolean;
  role?: Role;
  layers: MapLayers;
  setLayers: (l: MapLayers) => void;
}) {
  const view = ROLE_VIEWS[role] ?? ROLE_VIEWS["dpwh-admin"];
  const result = useMemo(() => applyFilters(filters), [filters]);
  const statusCounts = useMemo(() => countBy.status(filters), [filters]);
  const muniCounts = useMemo(() => countBy.municipality(filters), [filters]);

  // Same definition the filter uses, so the switch and the summary agree.
  const problemTotal = useMemo(
    () => PROJECTS.filter(p => p.auditFlags.length > 0).length, []);

  const municipalities = useMemo(
    () => [...muniCounts.keys()].sort((a, b) => a.localeCompare(b)), [muniCounts]);

  const active = activeCount(filters);
  const maxM = Math.ceil(AMOUNT_BOUNDS[1] / 1e6);
  const curM = filters.amount ? Math.round(filters.amount[1] / 1e6) : maxM;

  if (collapsed) return (
    <aside className="w-11 shrink-0 border-r border-gray-200 bg-white flex flex-col items-center py-3 gap-2" aria-label="Collapsed filter sidebar">
      <div className="w-7 h-7 flex items-center justify-center rounded text-gray-400" title="Filters"><Filter size={14} /></div>
      <div className="w-7 h-7 flex items-center justify-center rounded text-gray-400" title="Layers"><Layers size={14} /></div>
    </aside>
  );

  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden" aria-label="Filter sidebar">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          Filters {active > 0 && <span className="text-[10px] bg-[#1e3a7b] text-white rounded-full px-1.5 font-bold">{active}</span>}
        </span>
        <div className="flex items-center gap-2">
          <button title="Copy a link to this view"
            onClick={() => navigator.clipboard?.writeText(`${location.origin}${location.pathname}?${toQuery(filters)}`)}
            className="text-[11px] text-gray-400 hover:text-[#1e3a7b]">Link</button>
          {active > 0 && <button onClick={() => setFilters(emptyFilters())}
            className="text-[11px] text-[#1e3a7b] hover:underline font-medium">Reset</button>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5" style={{ scrollbarWidth: "none" }}>
        <p className="text-[10px] text-gray-400 leading-snug -mt-1">{view.blurb}</p>

        <div>
          <label htmlFor="muni-select" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Municipality</label>
          <select id="muni-select"
            value={filters.municipality.size === 1 ? [...filters.municipality][0] : "all"}
            onChange={e => setFilters({ ...filters, municipality: e.target.value === "all" ? new Set() : new Set([e.target.value]) })}
            className="w-full text-[12px] border border-gray-200 rounded px-2.5 py-1.5 bg-gray-50 text-gray-700 focus:outline-none focus:border-[#1e3a7b]">
            <option value="all">All Municipalities</option>
            {municipalities.map(m => <option key={m} value={m}>{m} ({muniCounts.get(m) ?? 0})</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Status</label>
          <div className="space-y-2">
            {(["completed", "ongoing", "proposed", "terminated"] as ProjectStatus[]).map(key => {
              const t = STATUS_TINT[key], on = filters.status.has(key), n = statusCounts.get(key) ?? 0;
              return (
                <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                  <button role="checkbox" aria-checked={on} aria-label={LABELS.status[key]}
                    onClick={() => {
                      const next = new Set(filters.status);
                      next.has(key) ? next.delete(key) : next.add(key);
                      setFilters({ ...filters, status: next });
                    }}
                    className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all focus:outline-none focus:ring-2 focus:ring-[#1e3a7b]"
                    style={on ? { background: t.dot, borderColor: t.dot } : { background: "#fff", borderColor: "#d1d5db" }}>
                    {on && <Check size={9} color="#fff" />}
                  </button>
                  <span className="flex-1 text-[12px] text-gray-600 group-hover:text-gray-900">{LABELS.status[key]}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-medium" style={{ background: t.bg, color: t.text }}>{n.toLocaleString()}</span>
                </label>
              );
            })}
          </div>

          {/* The one control that keeps this a register rather than a listing.
              Everything the pipeline checks — location, paperwork, bidding,
              delivery — behind a single switch instead of eighteen boxes. */}
          <label className="flex items-center gap-2.5 cursor-pointer group mt-3 pt-3 border-t border-gray-100">
            <button role="checkbox" aria-checked={filters.onlyProblems} aria-label="Only projects with a problem"
              onClick={() => setFilters({ ...filters, onlyProblems: !filters.onlyProblems })}
              className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 focus:outline-none focus:ring-2 focus:ring-[#1e3a7b]"
              style={filters.onlyProblems ? { background: "#e8722c", borderColor: "#e8722c" } : { background: "#fff", borderColor: "#d1d5db" }}>
              {filters.onlyProblems && <Check size={9} color="#fff" />}
            </button>
            <span className="flex-1 text-[12px] text-gray-600 group-hover:text-gray-900">Only ones with a problem</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-medium bg-orange-50 text-orange-700">{problemTotal}</span>
          </label>
        </div>

        <div>
          <label htmlFor="contractor-search" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Contractor</label>
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input id="contractor-search" value={filters.contractor} placeholder="Search contractor…"
              onChange={e => setFilters({ ...filters, contractor: e.target.value })}
              className="w-full pl-7 pr-6 py-1.5 text-[12px] border border-gray-200 rounded bg-gray-50 placeholder-gray-400 focus:outline-none focus:border-[#1e3a7b]" />
            {filters.contractor && <button onClick={() => setFilters({ ...filters, contractor: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X size={11} /></button>}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="budget-range" className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Awarded amount</label>
            <span className="text-[11px] font-mono text-gray-500">≤ ₱{curM}M</span>
          </div>
          <input id="budget-range" type="range" min={1} max={maxM} value={curM}
            onChange={e => {
              const v = Number(e.target.value);
              setFilters({ ...filters, amount: v >= maxM ? null : [AMOUNT_BOUNDS[0], v * 1e6] });
            }}
            className="w-full accent-[#1e3a7b]" />
          <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
            <span>{peso(AMOUNT_BOUNDS[0])}</span><span>{peso(AMOUNT_BOUNDS[1])}</span>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Map Layers</label>
          <div className="space-y-2">
            {([["markers", "Project Markers"], ["boundaries", "Municipal Boundaries"], ["labels", "Municipality Labels"]] as const).map(([k, l]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-[12px] text-gray-600">{l}</span>
                <button onClick={() => setLayers({ ...layers, [k]: !layers[k] })} role="switch" aria-checked={layers[k]} aria-label={`Toggle ${l}`}
                  className="w-8 rounded-full relative flex items-center transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-[#1e3a7b]"
                  style={{ background: layers[k] ? "#1e3a7b" : "#e2e8f0", height: 18 }}>
                  <div className="absolute w-3.5 h-3.5 bg-white rounded-full shadow transition-transform" style={{ left: 2, transform: layers[k] ? "translateX(14px)" : "translateX(0)" }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 p-3">
        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Bulacan Summary</div>
        <div className="grid grid-cols-2 gap-2">
          {([
            [result.length.toLocaleString(), "Shown", "#eef2f9", "#1e3a7b"],
            [String(result.filter(p => p.auditFlags.length > 0).length), "With a problem", "#fff4ec", "#c05621"],
            [String(result.filter(p => p.status === "completed").length), "Finished", "#e6f2e6", "#046b04"],
            [String(result.filter(p => p.status === "ongoing").length), "Being built", "#e6eefa", "#1c5cab"],
          ] as [string, string, string, string][]).map(([v, l, bg, col]) => (
            <div key={l} className="rounded p-2" style={{ background: bg }}>
              <div className="font-mono text-xl font-bold" style={{ color: col }}>{v}</div>
              <div className="text-[10px] text-gray-500">{l}</div>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-gray-400 mt-2">of {META.coverage.projects.toLocaleString()} contracts</div>
      </div>
    </aside>
  );
}
