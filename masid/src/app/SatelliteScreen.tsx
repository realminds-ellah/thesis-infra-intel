/**
 * The satellite workbench.
 *
 * The previous version could only show a contract you had already selected
 * somewhere else, so arriving here directly showed nothing at all. It also had
 * no way to compare what the pipeline computed against what the ground looks
 * like now — the one comparison a reader actually wants to make.
 *
 * Three panels, side by side, for every assessed contract:
 *
 *   BEFORE   NDVI composite from the year running up to construction
 *   AFTER    NDVI composite from the year after it was due to finish
 *   TODAY    live high-resolution imagery at the same coordinate
 *
 * The first two are what the detector measured. The third is the check on it: if
 * the pipeline reports no change and the current imagery plainly shows a
 * concrete revetment, that is the detector failing, and it should be visible
 * rather than buried in a recall statistic.
 *
 * The validation result stays pinned above all of it. This tier does not work —
 * flagged records and controls detect at the same rate — and no amount of
 * presentation should let someone read a verdict here as a finding.
 */

import { useMemo, useState } from "react";
import { MapContainer, TileLayer, Circle, CircleMarker } from "react-leaflet";
import { AlertTriangle, Search, Satellite as SatIcon, ExternalLink } from "lucide-react";
import "leaflet/dist/leaflet.css";

import {
  SATELLITE, SAT_BY_ID, VERDICT_CFG, VALIDATION, PROJECTS, PROC_BY_ID,
  type Verdict, type Project,
} from "./data";

const VERDICT_ORDER: Verdict[] = ["change-at-point", "change-offset", "no-change-signal", "not-assessable"];

export function SatelliteScreen({ initialId, onOpenRecord }:
  { initialId?: string | null; onOpenRecord: (id: string) => void }) {
  const assessed = useMemo(
    () => SATELLITE.results
      .map(r => ({ r, p: PROJECTS.find(x => x.id === r.id) }))
      .filter((x): x is { r: typeof SATELLITE.results[0]; p: Project } => Boolean(x.p)),
    []);

  const [verdicts, setVerdicts] = useState<Set<Verdict>>(new Set());
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<string>(
    initialId && SAT_BY_ID.has(initialId) ? initialId : assessed[0]?.r.id ?? "");

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const { r } of assessed) m.set(r.verdict, (m.get(r.verdict) ?? 0) + 1);
    return m;
  }, [assessed]);

  const list = useMemo(() => assessed.filter(({ r, p }) =>
    (verdicts.size === 0 || verdicts.has(r.verdict)) &&
    (!q || `${p.id} ${p.municipality} ${p.description}`.toLowerCase().includes(q.toLowerCase()))
  ), [assessed, verdicts, q]);

  const sel = assessed.find(x => x.r.id === selId) ?? list[0] ?? assessed[0];
  const cfg = sel ? VERDICT_CFG[sel.r.verdict] : null;
  const pr = sel ? PROC_BY_ID.get(sel.p.id) : undefined;

  const toggle = (v: Verdict) => {
    const n = new Set(verdicts);
    n.has(v) ? n.delete(v) : n.add(v);
    setVerdicts(n);
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-gray-50">
      {/* ── the assessed set, browsable ─────────────────────────────────── */}
      <aside className="w-72 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="text-[13px] font-bold text-gray-900 flex items-center gap-1.5">
            <SatIcon size={14} style={{ color: "#1e3a7b" }} />Assessed contracts
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            {SATELLITE.coverage.assessed} of {SATELLITE.coverage.assessable.toLocaleString()} that could be assessed
          </div>
        </div>

        <div className="px-4 py-2.5 border-b border-gray-100 space-y-2">
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Contract or place…"
              className="w-full pl-7 pr-3 py-1.5 text-[12px] border border-gray-200 rounded bg-gray-50 focus:outline-none focus:border-[#1e3a7b]" />
          </div>
          <div className="flex flex-wrap gap-1">
            {VERDICT_ORDER.map(v => {
              const n = counts.get(v) ?? 0, on = verdicts.has(v);
              return (
                <button key={v} onClick={() => toggle(v)} disabled={n === 0}
                  className={`text-[10px] px-2 py-1 rounded-full border flex items-center gap-1 whitespace-nowrap ${
                    on ? "text-white" : n === 0 ? "border-gray-100 text-gray-300" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                  style={on ? { background: VERDICT_CFG[v].color, borderColor: VERDICT_CFG[v].color } : undefined}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? "#fff" : VERDICT_CFG[v].color }} />
                  {VERDICT_CFG[v].short}<span className="font-mono opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {list.map(({ r, p }) => (
            <button key={r.id} onClick={() => setSelId(r.id)}
              className={`w-full text-left px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 ${
                r.id === sel?.r.id ? "bg-blue-50" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: VERDICT_CFG[r.verdict].color }} />
                <span className="text-[11px] font-mono text-gray-500">{r.id}</span>
                <span className="ml-auto text-[10px] font-mono text-gray-400">{Math.round(r.cloudFreeFraction * 100)}% clear</span>
              </div>
              <div className="text-[11px] text-gray-700 mt-1 leading-tight">{p.municipality} · {p.description.slice(0, 46)}…</div>
            </button>
          ))}
          {list.length === 0 && <div className="px-4 py-8 text-center text-[12px] text-gray-400">Nothing matches</div>}
        </div>
      </aside>

      {/* ── the assessment ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div className="max-w-5xl mx-auto p-6 space-y-4">
          {/* Never below the fold. A verdict here is not a finding. */}
          <div className="rounded border p-3.5" style={VALIDATION.discriminates
            ? { background: "#e6f2e6", borderColor: "#046b0444" }
            : { background: "#fbe9ea", borderColor: "#c0272d44" }}>
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" style={{ color: "#c0272d" }} />
              <div>
                <div className="text-[12px] font-bold" style={{ color: "#c0272d" }}>
                  This tier does not work — read the verdicts as context, never as evidence
                </div>
                <p className="text-[12px] text-gray-700 leading-relaxed mt-1">
                  It fires on {((VALIDATION.control.rate ?? 0) * 100).toFixed(1)}% of ordinary completed
                  contracts — projects that were, in the main, actually built. That is a recall failure,
                  and it needs no assumption about whether flagged records are ghosts. Flagged records and
                  seeded controls detect at statistically indistinguishable rates
                  ({VALIDATION.flagged.detections}/{VALIDATION.flagged.assessed} against{" "}
                  {VALIDATION.control.detections}/{VALIDATION.control.assessed}).
                </p>
              </div>
            </div>
          </div>

          {sel && cfg && (
            <>
              <div className="bg-white rounded border border-gray-200 p-4">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-mono text-gray-400">{sel.p.id}</div>
                    <h2 className="text-[15px] font-bold text-gray-900 leading-snug mt-0.5">{sel.p.name}</h2>
                    <div className="text-[12px] text-gray-500 mt-1">
                      {sel.p.municipality}, Bulacan · {sel.p.dpwhStatus}
                      {pr?.awardAmount ? ` · ₱${(pr.awardAmount / 1e6).toFixed(1)}M` : ""}
                    </div>
                  </div>
                  <span className="text-[11px] px-2.5 py-1 rounded font-semibold shrink-0"
                    style={{ background: cfg.bg, color: cfg.color }}>{cfg.short}</span>
                </div>
                <p className="text-[12px] text-gray-700 leading-relaxed mt-3">{sel.r.detail}</p>
                <p className="text-[11px] text-gray-500 leading-relaxed mt-2">{cfg.note}</p>
              </div>

              {/* ── the comparison that matters ───────────────────────── */}
              <div className="bg-white rounded border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                  <span className="text-[12px] font-bold text-gray-700">Before · After · Today</span>
                  <span className="text-[11px] text-gray-400 ml-2">
                    the two the detector compared, and what is actually there now
                  </span>
                </div>
                <div className="grid grid-cols-3 divide-x divide-gray-100">
                  {sel.r.chips ? (["before", "after"] as const).map(k => (
                    <figure key={k} className="m-0 p-3">
                      <img src={sel.r.chips![k]} alt={`NDVI ${k} for ${sel.p.id}`}
                        className="w-full rounded border border-gray-200" style={{ imageRendering: "pixelated" }} />
                      <figcaption className="mt-2">
                        <div className="text-[12px] font-semibold text-gray-700">
                          {k === "before" ? "Before construction" : "After completion"}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {(k === "before" ? sel.r.scenesBefore : sel.r.scenesAfter).length} Sentinel-2 scenes · NDVI median
                        </div>
                      </figcaption>
                    </figure>
                  )) : (
                    <div className="col-span-2 p-8 text-center text-[12px] text-gray-400">
                      No composite could be built for this contract
                    </div>
                  )}
                  <figure className="m-0 p-3">
                    {sel.p.lat != null && sel.p.lng != null ? (
                      <div className="rounded border border-gray-200 overflow-hidden" style={{ height: 200 }}>
                        <MapContainer key={sel.p.id} center={[sel.p.lat, sel.p.lng]} zoom={17}
                          style={{ height: "100%", width: "100%" }} scrollWheelZoom={false} zoomControl={false}>
                          <TileLayer attribution="Esri, Maxar"
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                            maxZoom={19} />
                          <Circle center={[sel.p.lat, sel.p.lng]} radius={30}
                            pathOptions={{ color: "#fff", weight: 1.5, fill: false, dashArray: "4 3" }} />
                          <CircleMarker center={[sel.p.lat, sel.p.lng]} radius={5}
                            pathOptions={{ color: "#fff", weight: 2, fillColor: cfg.color, fillOpacity: 1 }} />
                        </MapContainer>
                      </div>
                    ) : <div className="h-[200px] rounded border border-gray-200 flex items-center justify-center text-[11px] text-gray-400">No coordinate</div>}
                    <figcaption className="mt-2">
                      <div className="text-[12px] font-semibold text-gray-700">Today, high resolution</div>
                      <div className="text-[10px] text-gray-400">Esri World Imagery · the check on the two panels left</div>
                    </figcaption>
                  </figure>
                </div>
                <div className="px-4 pb-3 flex items-center gap-4 flex-wrap text-[10px] text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-8 h-2.5 rounded-sm" style={{ background: "linear-gradient(90deg,#6e4a2e,#a68a6a,#ded8c6,#96be78,#40914a,#12522c)" }} />
                    bare ground → dense vegetation
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-2.5 rounded-sm" style={{ background: "#8c8f94" }} />cloud-masked
                  </span>
                  <span>rings mark 30 / 90 / 150 m · 1 px = 10 m</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 bg-white rounded border border-gray-200 p-4">
                  <div className="text-[12px] font-bold text-gray-700">Change by sampling radius</div>
                  <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
                    Measured against {String(SATELLITE.method.nullSamples)} same-radius discs dropped at random
                    in this site&apos;s own surroundings. Construction reads as vegetation down and built
                    surface up; both must pass {String(SATELLITE.method.ndviZThreshold)}σ / +{String(SATELLITE.method.ndbiZThreshold)}σ.
                  </p>
                  <table className="w-full text-[12px]">
                    <thead><tr className="border-b border-gray-100">
                      {/* keyed by position: two columns are both headed σ */}
                      {["Radius", "Vegetation", "σ", "Built surface", "σ", "Reads as"].map((h, i) =>
                        <th key={i} className="text-left py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {[30, 90, 150].map(r => {
                        const v = sel.r.rings[`r${r}`];
                        if (!v) return (
                          <tr key={r} className="border-b border-gray-50">
                            <td className="py-2.5 font-mono text-gray-700">{r} m</td>
                            <td colSpan={5} className="py-2.5 text-gray-300">not enough clear pixels</td>
                          </tr>);
                        const hit = v.zNdvi <= Number(SATELLITE.method.ndviZThreshold) && v.zNdbi >= Number(SATELLITE.method.ndbiZThreshold);
                        return (
                          <tr key={r} className="border-b border-gray-50">
                            <td className="py-2.5 font-mono text-gray-700">{r} m</td>
                            <td className="py-2.5 font-mono" style={{ color: v.dNdvi < 0 ? "#046b04" : "#64748b" }}>{v.dNdvi >= 0 ? "+" : ""}{v.dNdvi.toFixed(3)}</td>
                            <td className="py-2.5 font-mono text-gray-500">{v.zNdvi >= 0 ? "+" : ""}{v.zNdvi.toFixed(2)}</td>
                            <td className="py-2.5 font-mono" style={{ color: v.dNdbi > 0 ? "#c05621" : "#64748b" }}>{v.dNdbi >= 0 ? "+" : ""}{v.dNdbi.toFixed(3)}</td>
                            <td className="py-2.5 font-mono text-gray-500">{v.zNdbi >= 0 ? "+" : ""}{v.zNdbi.toFixed(2)}</td>
                            <td className="py-2.5">{hit
                              ? <span className="text-[11px] px-2 py-0.5 rounded font-medium" style={{ background: "#fff4ec", color: "#c05621" }}>construction-consistent</span>
                              : <span className="text-[11px] text-gray-400">below threshold</span>}</td>
                          </tr>);
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="bg-white rounded border border-gray-200 p-4">
                  <div className="text-[12px] font-bold text-gray-700 mb-3">Quality</div>
                  <dl className="space-y-2.5">
                    {[["Cloud-free", `${Math.round(sel.r.cloudFreeFraction * 100)}%`],
                      ["Confidence", sel.r.confidence],
                      ["Null discs", sel.r.control ? String(sel.r.control.nullDiscs) : "—"],
                      ["Scenes used", String(sel.r.scenesBefore.length + sel.r.scenesAfter.length)]].map(([l, v]) => (
                      <div key={l} className="flex items-center justify-between">
                        <dt className="text-[12px] text-gray-500">{l}</dt>
                        <dd className="text-[12px] font-mono text-gray-800">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <button onClick={() => onOpenRecord(sel.p.id)}
                    className="w-full mt-4 py-2 rounded text-[12px] font-semibold text-white flex items-center justify-center gap-1.5 hover:opacity-90"
                    style={{ background: "#1e3a7b" }}>
                    Open full record<ExternalLink size={12} />
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-gray-400 leading-relaxed">
                <strong className="text-gray-500">What this cannot do.</strong> Sentinel-2 resolves 10 m per
                pixel. A revetment two metres wide, a drainage line, a repair to an existing structure, or
                any work on ground that was already bare produces no signal at all. Cloud over Bulacan in the
                wet season leaves {SATELLITE.coverage.skipped ? "" : ""}
                {SATELLITE.results.filter(r => r.verdict === "not-assessable").length} of{" "}
                {SATELLITE.coverage.assessed} assessed contracts unreadable. The rightmost panel above is
                there precisely so a silence from the detector can be checked against the ground.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
