/**
 * The map sidebar, written for the person it was built for.
 *
 * This was an auditor's control panel — municipality dropdown, status boxes, a
 * contractor field, an awarded-amount slider, an infrastructure-year select, a
 * "colour dots by" encoding picker, four layer switches and a CSV export. Nine
 * controls, in the vocabulary of someone who already knows what an encoding is.
 *
 * A resident in Hagonoy asks three things: what is near my town, who built it,
 * and is anything wrong with it. So the panel now asks those three, in that
 * order, in words, and everything else is folded behind "More options" — still
 * there for an analyst, no longer the first thing a citizen meets.
 *
 * THREE SPECIFIC CHANGES AND THE REASON FOR EACH
 *
 *  - ONE SEARCH BOX, not two. There was a general search and a separate
 *    Contractor field, which required the reader to classify their own words
 *    before typing them. Nobody thinks "I am about to type a contractor name".
 *    Contractor, barangay, town, contract id and description are one haystack.
 *  - THE AWARDED-AMOUNT SLIDER IS GONE. "Show me contracts under ₱62M" is not a
 *    question anyone has. It occupied the most prominent slot in the panel for
 *    a filter that answers nothing a citizen wants to know.
 *  - PLAIN LABELS. "Infrastructure year" became "Year it was funded";
 *    "Colour dots by" became "What the colours mean". The words were accurate
 *    and unreadable.
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
  type Filters, applyFilters, countBy, YEAR_BOUNDS, LABELS, activeCount,
  emptyFilters, toQuery,
} from "./filters";
import { META, PROJECTS, PROC_BY_ID, HAZARD_BY_ID, type ProjectStatus } from "./data";
import { Download } from "lucide-react";
import type { Role } from "./roles";
import { ROLE_VIEWS } from "./roleFilters";
import { type Lang, makeT, EN as EN_STRINGS } from "./i18n";
import { ENCODINGS } from "./mapColor";
import { suggestEncoding } from "./mapColor";

const STATUS_TINT: Record<ProjectStatus, { dot: string; bg: string; text: string }> = {
  completed: { dot: "#046b04", bg: "#e6f2e6", text: "#046b04" },
  ongoing: { dot: "#2a78d6", bg: "#e6eefa", text: "#1c5cab" },
  proposed: { dot: "#9a9a94", bg: "#f0f0ee", text: "#6b6b64" },
  terminated: { dot: "#c0272d", bg: "#fbe9ea", text: "#c0272d" },
};

/**
 * `markers` used to be wired straight to the map's CLUSTER prop, so a switch
 * labelled "Project Markers" did not hide markers — it un-grouped them. The two
 * are separate now and named for what they do.
 */
export interface MapLayers { markers: boolean; boundaries: boolean; labels: boolean; cluster: boolean }

/**
 * Download whatever is currently filtered, with the derived columns included —
 * flags, bid ratio, hazard — so the export carries the analysis and not just the
 * portal's own fields. A register you cannot take away with you is half a
 * register.
 */
function exportCsv(rows: ReturnType<typeof applyFilters>) {
  const head = ["contractId", "description", "municipality", "contractor", "stage",
    "approvedBudget", "awardAmount", "bidRatio", "bidders", "startDate", "endDate",
    "progress", "latitude", "longitude", "floodHazard", "metresToHazard",
    "problemCount", "problems"];
  const esc = (v: unknown) => {
    const t = v == null ? "" : String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const body = rows.map(p => {
    const pr = PROC_BY_ID.get(p.id), hz = HAZARD_BY_ID.get(p.id);
    return [p.id, p.description, p.municipality, p.contractor, p.dpwhStatus,
      pr?.abc ?? "", pr?.awardAmount ?? "", pr?.bidRatio ?? "", pr?.bidders ?? "",
      p.startDate ?? "", p.endDate ?? "", p.completion,
      p.lat ?? "", p.lng ?? "", hz?.hazard ?? "", hz?.metresToHazard ?? "",
      p.auditFlags.length, p.auditFlags.map(f => f.code).join(" ")].map(esc).join(",");
  });
  const blob = new Blob([[head.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `masid-bulacan-1st-deo-${rows.length}-contracts.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function FilterPanel({
  filters, setFilters, collapsed, role = "dpwh-admin", layers, setLayers, colorBy, setColorBy, lang = "en" }: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  collapsed?: boolean;
  role?: Role;
  lang?: Lang;
  layers: MapLayers;
  setLayers: (l: MapLayers) => void;
  colorBy: string | null;
  setColorBy: (k: string | null) => void;
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

  const tr = makeT(lang, EN_STRINGS);
  const active = activeCount(filters);

  // Collapsing hides it entirely. A 44px strip of dead icons gave back almost
  // none of the screen, which is the only reason to collapse a panel.
  if (collapsed) return null;

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

        {/* One box for everything a person might type. */}
        <div>
          <label htmlFor="q-search" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            {tr("panel.search")}
          </label>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input id="q-search" value={filters.q}
              placeholder={tr("panel.searchPlaceholder")}
              onChange={e => setFilters({ ...filters, q: e.target.value })}
              className="w-full pl-8 pr-7 py-2 text-[12px] border border-gray-200 rounded bg-gray-50 placeholder-gray-400 focus:outline-none focus:border-[#1e3a7b]" />
            {filters.q && <button onClick={() => setFilters({ ...filters, q: "" })} aria-label={tr("panel.clearSearch")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={12} /></button>}
          </div>
          <p className="text-[10px] text-gray-400 mt-1 leading-snug">
            {tr("panel.searchHint")}
          </p>
        </div>

        <div>
          <label htmlFor="muni-select" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{tr("panel.town")}</label>
          <select id="muni-select"
            value={filters.municipality.size === 1 ? [...filters.municipality][0] : "all"}
            onChange={e => setFilters({ ...filters, municipality: e.target.value === "all" ? new Set() : new Set([e.target.value]) })}
            className="w-full text-[12px] border border-gray-200 rounded px-2.5 py-2 bg-gray-50 text-gray-700 focus:outline-none focus:border-[#1e3a7b]">
            <option value="all">{tr("panel.everyTown")} ({PROJECTS.length.toLocaleString()})</option>
            {municipalities.map(m => <option key={m} value={m}>{m} ({muniCounts.get(m) ?? 0})</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">{tr("panel.howFar")}</label>
          <div className="space-y-2">
            {(["completed", "ongoing", "proposed", "terminated"] as ProjectStatus[]).map(key => {
              const t = STATUS_TINT[key], on = filters.status.has(key), n = statusCounts.get(key) ?? 0;
              return (
                <label key={key} className={`flex items-center gap-2.5 group ${n === 0 ? "opacity-45" : "cursor-pointer"}`}>
                  <button role="checkbox" aria-checked={on} aria-label={tr("status."+key, LABELS.status[key])} disabled={n === 0}
                    onClick={() => {
                      const next = new Set(filters.status);
                      next.has(key) ? next.delete(key) : next.add(key);
                      setFilters({ ...filters, status: next });
                    }}
                    className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all focus:outline-none focus:ring-2 focus:ring-[#1e3a7b]"
                    style={on ? { background: t.dot, borderColor: t.dot } : { background: "#fff", borderColor: "#d1d5db" }}>
                    {on && <Check size={9} color="#fff" />}
                  </button>
                  <span className="flex-1 text-[12px] text-gray-600 group-hover:text-gray-900">{tr("status."+key, LABELS.status[key])}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-medium" style={{ background: t.bg, color: t.text }}>{n.toLocaleString()}</span>
                </label>
              );
            })}
          </div>

          {/* The point of the register, stated as a question rather than a
              category name, and given room rather than a checkbox in a row. */}
          <button onClick={() => setFilters({ ...filters, onlyProblems: !filters.onlyProblems })}
            aria-pressed={filters.onlyProblems}
            className="w-full mt-3 px-2.5 py-2.5 rounded border text-left transition-colors"
            style={filters.onlyProblems
              ? { background: "#fdf0e8", borderColor: "#e8722c" }
              : { background: "#fff", borderColor: "#e5e7eb" }}>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0"
                style={filters.onlyProblems ? { background: "#e8722c", borderColor: "#e8722c" } : { background: "#fff", borderColor: "#d1d5db" }}>
                {filters.onlyProblems && <Check size={9} color="#fff" />}
              </span>
              <span className="text-[12px] font-semibold" style={{ color: filters.onlyProblems ? "#b4531f" : "#374151" }}>
                {tr("panel.needsCheck")}
              </span>
              <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded font-medium bg-orange-50 text-orange-700">{problemTotal}</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1 leading-snug pl-6">
              {tr("panel.needsCheckWhy")}
            </p>
          </button>
        </div>

        {/* Everything an analyst wants and a citizen does not need to meet. */}
        <details className="group">
          <summary className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer list-none flex items-center gap-1.5 select-none">
            <span className="transition-transform group-open:rotate-90">▸</span>{tr("panel.more")}
          </summary>
          <div className="space-y-4 mt-3">
            <div>
              <label htmlFor="year-select" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{tr("panel.year")}</label>
              <select id="year-select"
                value={filters.years ? String(filters.years[0]) : "all"}
                onChange={e => setFilters({ ...filters, years: e.target.value === "all" ? null : [Number(e.target.value), Number(e.target.value)] })}
                className="w-full text-[12px] border border-gray-200 rounded px-2.5 py-1.5 bg-gray-50 text-gray-700 focus:outline-none focus:border-[#1e3a7b]">
                <option value="all">{tr("panel.anyYear")}</option>
                {Array.from({ length: YEAR_BOUNDS[1] - YEAR_BOUNDS[0] + 1 }, (_, i) => YEAR_BOUNDS[0] + i)
                  .map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="colour-by" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{tr("panel.colours")}</label>
              <select id="colour-by"
                value={colorBy ?? suggestEncoding(filters as never)}
                onChange={e => setColorBy(e.target.value)}
                className="w-full text-[12px] border border-gray-200 rounded px-2.5 py-1.5 bg-gray-50 text-gray-700 focus:outline-none focus:border-[#1e3a7b]">
                {ENCODINGS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              {colorBy && <button onClick={() => setColorBy(null)} className="text-[10px] text-[#1e3a7b] hover:underline mt-1">match the filters instead</button>}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">{tr("panel.draw")}</label>
              <div className="space-y-2">
                {([["markers", tr("panel.pins")], ["cluster", tr("panel.cluster")], ["boundaries", tr("panel.boundaries")], ["labels", tr("panel.townNames")]] as const).map(([k, l]) => (
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
        </details>
      </div>

      <div className="border-t border-gray-100 px-3 pt-2.5">
        <button onClick={() => exportCsv(result)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] border border-gray-200 rounded text-gray-600 hover:border-[#1e3a7b]/40 hover:text-[#1e3a7b]">
          <Download size={12} />Export these {result.length.toLocaleString()} as CSV
        </button>
      </div>

    </aside>
  );
}
