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

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Search, Satellite as SatIcon, ExternalLink, Check, Eye,
  Download, ChevronRight, X,
} from "lucide-react";

import {
  SATELLITE, SAT_BY_ID, VERDICT_CFG, VALIDATION, PROJECTS, PROC_BY_ID,
  type Verdict, type Project,
} from "./data";
import {
  EYE_CFG, EYE_ORDER, loadReviews, saveReviews, reviewsToCsv,
  type EyeVerdict, type Review,
} from "./satReview";
import { tint, accent } from "./theme";
import { ImageryViewer } from "./ImageryViewer";

const VERDICT_ORDER: Verdict[] = ["change-at-point", "change-offset", "no-change-signal", "not-assessable"];
type Sort = "value" | "verdict" | "id" | "clear";

export function SatelliteScreen({ initialId, onOpenRecord, reviewerLabel = "Reviewer" }:
  { initialId?: string | null; onOpenRecord: (id: string) => void; reviewerLabel?: string }) {
  const assessed = useMemo(
    () => SATELLITE.results
      .map(r => ({ r, p: PROJECTS.find(x => x.id === r.id) }))
      .filter((x): x is { r: typeof SATELLITE.results[0]; p: Project } => Boolean(x.p)),
    []);

  const [verdicts, setVerdicts] = useState<Set<Verdict>>(new Set());
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("value");
  const [unreviewedOnly, setUnreviewedOnly] = useState(false);
  const [town, setTown] = useState("");
  // Empty rather than assessed[0]: with no explicit pick, the selection falls
  // through to the top of the SORTED list below. Seeding it from the unsorted
  // array landed you on a contract sitting somewhere off-screen in the sidebar.
  const [selId, setSelId] = useState<string>(
    initialId && SAT_BY_ID.has(initialId) ? initialId : "");

  // Reviews are read once and written on every change; there is no server.
  const [reviews, setReviews] = useState<Record<string, Review>>(() => loadReviews());
  useEffect(() => { saveReviews(reviews); }, [reviews]);
  const [note, setNote] = useState("");

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const { r } of assessed) m.set(r.verdict, (m.get(r.verdict) ?? 0) + 1);
    return m;
  }, [assessed]);

  const value = (p: Project) => PROC_BY_ID.get(p.id)?.awardAmount ?? p.budget ?? 0;

  /**
   * Two hundred sites is more than anyone reviews in one sitting, so the order
   * decides which ones actually get looked at. Highest award value first by
   * default: if only forty get reviewed, they should be the forty carrying the
   * most public money, not the forty whose contract ids sort first.
   */
  /** Towns that actually have assessed sites, with counts. */
  const towns = useMemo(() => {
    const m = new Map<string, number>();
    for (const { p } of assessed) m.set(p.municipality, (m.get(p.municipality) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [assessed]);

  const list = useMemo(() => {
    const out = assessed.filter(({ r, p }) =>
      (verdicts.size === 0 || verdicts.has(r.verdict)) &&
      (!town || p.municipality === town) &&
      (!unreviewedOnly || !reviews[r.id]) &&
      (!q || `${p.id} ${p.municipality} ${p.description}`.toLowerCase().includes(q.toLowerCase()))
    );
    const byVerdict = (v: Verdict) => VERDICT_ORDER.indexOf(v);
    return out.sort((a, b) =>
      sort === "value" ? value(b.p) - value(a.p)
      : sort === "clear" ? b.r.cloudFreeFraction - a.r.cloudFreeFraction
      : sort === "verdict" ? byVerdict(a.r.verdict) - byVerdict(b.r.verdict) || value(b.p) - value(a.p)
      : a.p.id.localeCompare(b.p.id));
  }, [assessed, verdicts, q, sort, unreviewedOnly, reviews, town]);

  const sel = assessed.find(x => x.r.id === selId) ?? list[0] ?? assessed[0];
  const cfg = sel ? VERDICT_CFG[sel.r.verdict] : null;
  const pr = sel ? PROC_BY_ID.get(sel.p.id) : undefined;
  const mine = sel ? reviews[sel.p.id] : undefined;

  // The note box follows the selection rather than persisting across it, so a
  // half-typed remark can never be saved against the wrong contract.
  useEffect(() => { setNote(reviews[selId]?.note ?? ""); }, [selId]); // eslint-disable-line react-hooks/exhaustive-deps

  const record = (verdict: EyeVerdict) => {
    if (!sel) return;
    setReviews(r => ({ ...r, [sel.p.id]: {
      id: sel.p.id, verdict, note,
      by: reviewerLabel, at: new Date().toISOString(),
    }}));
  };

  const clearReview = () => {
    if (!sel) return;
    setReviews(r => { const n = { ...r }; delete n[sel.p.id]; return n; });
    setNote("");
  };

  const exportCsv = () => {
    const csv = reviewsToCsv(reviews, id => {
      const p = PROJECTS.find(x => x.id === id);
      return {
        municipality: p?.municipality ?? "", description: p?.description ?? "",
        lat: p?.lat ?? null, lng: p?.lng ?? null,
        autoVerdict: SAT_BY_ID.get(id)?.verdict ?? "",
      };
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `masid-imagery-review-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /** Step to the next unreviewed site, so reviewing 200 is one button. */
  const queue = useMemo(
    () => list.filter(x => !reviews[x.r.id] && x.r.id !== sel?.r.id),
    [list, reviews, sel]);
  const nextUnreviewed = () => { if (queue.length) setSelId(queue[0].r.id); };

  const reviewed = Object.keys(reviews).length;

  const toggle = (v: Verdict) => {
    const n = new Set(verdicts);
    n.has(v) ? n.delete(v) : n.add(v);
    setVerdicts(n);
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-gray-50">
      {/* ── picking a site to inspect ───────────────────────────────────
          Rebuilt around the person using it. This panel used to open with
          review bookkeeping — a progress bar and a CSV export — before the
          reader had chosen anything, and its primary filter was the DETECTOR
          VERDICT: four chips reading "Change at point", "No signal", "Not
          assessable". Filtering by that verdict is worse than useless, because
          this project measured the tier and it cannot tell a flagged contract
          from an ordinary one. Offering it first invited people to narrow by a
          number that means nothing.

          An inspector picks a site by WHERE it is, HOW BIG it is and WHETHER
          ANYONE HAS LOOKED YET. Those are the controls now. The detector's own
          categories are still reachable, folded away and carrying the warning.
      ─────────────────────────────────────────────────────────────────── */}
      <aside className="w-72 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="text-[13px] font-bold text-gray-900 flex items-center gap-1.5">
            <SatIcon size={14} style={{ color: "#1e3a7b" }} />Pick a site to inspect
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            {list.length.toLocaleString()} of {assessed.length} sites with imagery
          </div>
        </div>

        <div className="px-4 py-3 border-b border-gray-100 space-y-2.5">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={e => setQ(e.target.value)}
              placeholder="A town, a company, a contract…"
              className="w-full pl-8 pr-7 py-2 text-[12px] border border-gray-200 rounded bg-gray-50 focus:outline-none focus:border-[#1e3a7b]" />
            {q && <button onClick={() => setQ("")} aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={12}/></button>}
          </div>

          {/* Where. An inspection is a trip, and trips are planned by town. */}
          <select value={town} onChange={e => setTown(e.target.value)}
            className="w-full text-[12px] border border-gray-200 rounded px-2.5 py-2 bg-gray-50 text-gray-700 focus:outline-none focus:border-[#1e3a7b]">
            <option value="">Every town ({assessed.length})</option>
            {towns.map(([t, n]) => <option key={t} value={t}>{t} ({n})</option>)}
          </select>

          {/* Order. Plain sentences, not column names. */}
          <select value={sort} onChange={e => setSort(e.target.value as Sort)}
            className="w-full text-[12px] border border-gray-200 rounded px-2.5 py-2 bg-gray-50 text-gray-700 focus:outline-none focus:border-[#1e3a7b]">
            <option value="value">Biggest contracts first</option>
            <option value="clear">Clearest imagery first</option>
            <option value="id">Contract number</option>
            <option value="verdict">What the detector said</option>
          </select>

          <button onClick={() => setUnreviewedOnly(v => !v)}
            aria-pressed={unreviewedOnly}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded border text-left transition-colors"
            style={unreviewedOnly ? { background: tint("#1e3a7b", 12), borderColor: accent("#1e3a7b") } : { borderColor: "#e5e7eb" }}>
            <span className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0"
              style={unreviewedOnly ? { background: accent("#1e3a7b"), borderColor: accent("#1e3a7b") } : { borderColor: "#d1d5db" }}>
              {unreviewedOnly && <Check size={9} color="#fff"/>}
            </span>
            <span className="text-[12px]" style={{ color: unreviewedOnly ? accent("#1e3a7b") : "#374151" }}>
              Hide ones already looked at
            </span>
            <span className="ml-auto text-[10px] font-mono text-gray-400">{assessed.length - reviewed}</span>
          </button>

          {/* The detector's categories, folded away and labelled for what they
              are worth. Reachable for an analyst; not offered to an inspector
              as if it were a useful way to narrow a list. */}
          <details>
            <summary className="text-[11px] text-gray-500 cursor-pointer list-none select-none hover:text-gray-700">
              ▸ Filter by what the detector said
            </summary>
            <div className="mt-2">
              <p className="text-[10px] leading-snug mb-1.5" style={{ color: accent("#c0272d") }}>
                The detector does not discriminate — it fires on ordinary contracts at the same rate.
                Narrowing by it selects nothing meaningful.
              </p>
              <div className="flex flex-wrap gap-1">
                {VERDICT_ORDER.map(v => {
                  const n = counts.get(v) ?? 0, on = verdicts.has(v);
                  return (
                    <button key={v} onClick={() => toggle(v)} disabled={n === 0}
                      className={`text-[10px] px-2 py-1 rounded-full border flex items-center gap-1 whitespace-nowrap ${
                        on ? "text-white" : n === 0 ? "border-gray-100 text-gray-300" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                      style={on ? { background: VERDICT_CFG[v].color, borderColor: VERDICT_CFG[v].color } : undefined}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? "#fff" : accent(VERDICT_CFG[v].color) }} />
                      {VERDICT_CFG[v].short}<span className="font-mono opacity-70">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </details>
        </div>

        {/* The list. Place first, because that is how a site is recognised. */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {list.map(({ r, p }) => {
            const mine = reviews[r.id];
            return (
              <button key={r.id} onClick={() => setSelId(r.id)}
                className={`w-full text-left px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 ${
                  r.id === sel?.r.id ? "bg-blue-50" : ""}`}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[12px] font-semibold text-gray-800">{p.municipality}</span>
                  <span className="ml-auto text-[11px] font-mono font-semibold text-gray-600 shrink-0">
                    {value(p) ? `₱${(value(p) / 1e6).toFixed(0)}M` : "—"}
                  </span>
                </div>
                <div className="text-[11px] text-gray-600 leading-tight mt-0.5">
                  {(p as unknown as { structureType?: string | null }).structureType ?? p.description.slice(0, 40)}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] font-mono text-gray-400">{r.id}</span>
                  {mine && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5"
                      style={{ background: tint(EYE_CFG[mine.verdict].color), color: accent(EYE_CFG[mine.verdict].color) }}
                      title={`Looked at: ${EYE_CFG[mine.verdict].label}`}>
                      <Check size={8}/>{EYE_CFG[mine.verdict].short}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          {list.length === 0 && (
            <div className="px-4 py-8 text-center text-[12px] text-gray-400">
              {unreviewedOnly && reviewed > 0 ? "Everything matching has been looked at." : "Nothing matches"}
            </div>
          )}
        </div>

        {/* Bookkeeping, at the bottom where it belongs — it is a record of work
            done, not a control for choosing what to do next. */}
        <div className="px-4 py-2.5 border-t border-gray-100">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-gray-500 flex items-center gap-1"><Eye size={11}/>Looked at by a person</span>
            <span className="font-mono font-semibold text-gray-700">{reviewed}/{assessed.length}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${assessed.length ? (reviewed / assessed.length) * 100 : 0}%`, background: "#1e3a7b" }} />
          </div>
          <button onClick={exportCsv} disabled={reviewed === 0}
            className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] border border-gray-200 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
            <Download size={11}/>Export reviews (CSV)
          </button>
        </div>
      </aside>

      {/* ── the assessment ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div className="max-w-5xl mx-auto p-6 space-y-4">
          {/* Never below the fold. A verdict here is not a finding. */}
          <div className="rounded border p-3.5" style={VALIDATION.discriminates
            ? { background: tint("#046b04"), borderColor: tint("#046b04", 42) }
            : { background: tint("#c0272d"), borderColor: tint("#c0272d", 42) }}>
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" style={{ color: accent("#c0272d") }} />
              <div>
                <div className="text-[12px] font-bold" style={{ color: accent("#c0272d") }}>
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
                    style={{ background: tint(cfg.color), color: accent(cfg.color) }}>{cfg.short}</span>
                </div>
                <p className="text-[12px] text-gray-700 leading-relaxed mt-3">{sel.r.detail}</p>
                <p className="text-[11px] text-gray-500 leading-relaxed mt-2">{cfg.note}</p>
              </div>

              {/* ── the imagery, in one frame ────────────────────────────
                  Four panels used to stand here — a Leaflet map of current Esri
                  imagery, the dated Wayback strip, a Google embed and the
                  Mapillary ground viewer — carrying four basemaps behind two
                  different layer controls. Two pairs of them repeated each
                  other, and a reader who wanted to compare two views had to
                  scroll between panels rather than see them together. One
                  frame, one list of views, and a split mode that opens on this
                  contract's own before-and-after pair. ─────────────────── */}
              {sel.p.lat != null && sel.p.lng != null ? (
                <ImageryViewer lat={sel.p.lat} lng={sel.p.lng} id={sel.p.id}
                  startDate={sel.p.startDate} endDate={sel.p.endDate}
                  verdictColor={cfg.color} />
              ) : (
                <div className="bg-white rounded border border-gray-200 px-4 py-8 text-center text-[12px] text-gray-400">
                  No coordinate published — there is nothing to point a camera at
                </div>
              )}

              {/* ── what a person makes of it ────────────────────────────
                  The detector cannot separate flagged contracts from ordinary
                  ones. A person looking at sub-metre imagery can at least say
                  what is visible, and that answer — attributed, dated and
                  exportable — is the ground-truth set this project never had.

                  REBUILT, because the first version asked an unanswerable
                  question. It said "what do you see?" without ever saying what
                  SHOULD be there, put five terse labels in a row whose meanings
                  only appeared on hover — invisible on a touch screen and
                  undiscoverable on a laptop — and opened a free-text box before
                  the multiple choice above it had been answered.

                  Now: the contract's own words first, so the question can be
                  answered; every option's meaning always visible; the note
                  appears only after a choice and asks something specific to it;
                  and recording one says plainly what it is for. ────────── */}
              <div className="bg-white rounded border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2 flex-wrap">
                  <Eye size={13} className="text-[#1e3a7b]" />
                  <span className="text-[12px] font-bold text-gray-700">What do you see at this coordinate?</span>
                  <span className="text-[11px] text-gray-400">an observation of the imagery, not a finding about the contract</span>
                  <span className="ml-auto text-[11px] font-mono text-gray-400">{reviewed}/{assessed.length} reviewed</span>
                </div>

                {/* What the paperwork says should be here. Without this the
                    reviewer is guessing at what counts as "the structure". */}
                <div className="px-4 py-2.5 border-b border-gray-100 flex items-start gap-2 flex-wrap"
                  style={{ background: tint("#1e3a7b", 7) }}>
                  <span className="text-[11px] font-semibold shrink-0" style={{ color: accent("#1e3a7b") }}>
                    The contract says:
                  </span>
                  <span className="text-[11px] text-gray-700 flex-1 leading-relaxed">
                    {(sel.p as unknown as { structureType?: string | null }).structureType
                      ?? sel.p.description.slice(0, 60) + "…"}
                    {(sel.p as unknown as { lengthMetres?: number | null }).lengthMetres != null && (
                      <> · <strong>{(sel.p as unknown as { lengthMetres: number }).lengthMetres.toLocaleString()} m</strong></>
                    )}
                    {(sel.p as unknown as { stationFrom?: string | null }).stationFrom && (
                      <> · STA {(sel.p as unknown as { stationFrom: string }).stationFrom} → {(sel.p as unknown as { stationTo: string }).stationTo}</>
                    )}
                    {(sel.p as unknown as { barangay?: string | null }).barangay && (
                      <> · Brgy. {(sel.p as unknown as { barangay: string }).barangay}</>
                    )}
                    {(sel.p as unknown as { lengthMetres?: number | null }).lengthMetres == null && (
                      <span className="text-gray-400"> · no dimension published — you cannot check a size that was never stated</span>
                    )}
                  </span>
                </div>

                <div className="p-4">
                  {/* One per row, meaning always visible. A five-across grid of
                      bare labels made "Structure visible" and "Built,
                      unidentified" look interchangeable. */}
                  <div className="space-y-1.5">
                    {EYE_ORDER.map(v => {
                      const c = EYE_CFG[v], on = mine?.verdict === v;
                      return (
                        <button key={v} onClick={() => record(v)}
                          className={`w-full text-left px-3 py-2 rounded border flex items-start gap-2.5 transition-colors ${
                            on ? "" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 bg-white"}`}
                          style={on ? { background: tint(c.color), borderColor: accent(c.color) } : undefined}>
                          <span className="w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center"
                            style={on ? { background: accent(c.color), borderColor: accent(c.color) }
                                      : { borderColor: accent(c.color) }}>
                            {on && <Check size={10} color="#fff" />}
                          </span>
                          <span className="min-w-0">
                            <span className="text-[12px] font-semibold block leading-tight"
                              style={{ color: on ? accent(c.color) : "var(--color-gray-800)" }}>
                              {c.label}
                            </span>
                            <span className="text-[11px] text-gray-500 block leading-snug mt-0.5">{c.help}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* The note only after a choice, and asking something specific
                      to that choice rather than the same generic prompt. */}
                  {mine && (
                    <div className="mt-3">
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        {mine.verdict === "nothing" ? "What is there instead?"
                          : mine.verdict === "wrong-place" ? "What is at this point?"
                          : mine.verdict === "cannot-tell" ? "What is in the way?"
                          : "Anything useful for someone going to site?"}
                      </label>
                      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                        placeholder={
                          mine.verdict === "nothing" ? "Bare ground, open water, farmland, houses, an existing road…"
                          : mine.verdict === "wrong-place" ? "Mid-subdivision, far from any waterway, inside a building…"
                          : mine.verdict === "cannot-tell" ? "Cloud, tree canopy over the channel, imagery predating the contract…"
                          : "Landmarks, the state of the bank, how much of the stated length looks covered…"}
                        className="w-full px-2.5 py-2 text-[12px] border border-gray-200 rounded resize-none focus:outline-none focus:border-[#1e3a7b]" />
                    </div>
                  )}

                  {/* What recording it is FOR. Without this the reviewer does
                      work and watches nothing happen. */}
                  {mine ? (
                    <div className="mt-3 rounded border px-3 py-2.5"
                      style={{ background: tint("#046b04", 9), borderColor: tint("#046b04", 30) }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Check size={12} style={{ color: accent("#046b04") }} />
                        <span className="text-[11px]" style={{ color: accent("#046b04") }}>
                          Recorded by <strong>{mine.by}</strong> ·{" "}
                          {new Date(mine.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <button onClick={() => record(mine.verdict)}
                          className="ml-auto text-[11px] px-2.5 py-1 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">
                          Save note
                        </button>
                        <button onClick={clearReview}
                          className="text-[11px] px-2.5 py-1 rounded border border-gray-200 bg-white text-gray-500 hover:bg-gray-50">
                          Clear
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-500 leading-relaxed mt-1.5">
                        This is the ground truth the detector never had. Export the set from the
                        sidebar — it is what any future model would have to be measured against.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-500 mt-3">
                      Not looked at yet. Every option above describes the <strong>picture</strong> —
                      none of them says whether the contract was delivered.
                    </p>
                  )}

                  <button onClick={nextUnreviewed} disabled={queue.length === 0}
                    title={queue.length ? `${queue.length} left in the current list` : "Nothing left unreviewed in the current list"}
                    className="w-full mt-3 py-2 rounded text-[12px] font-semibold text-white flex items-center justify-center gap-1.5 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: "var(--masid-navy)" }}>
                    {queue.length
                      ? <>Next site to review<span className="font-mono opacity-70">{queue.length} left</span><ChevronRight size={13} /></>
                      : "All reviewed"}
                  </button>
                </div>
              </div>

              {/* ── what the detector compared ─────────────────────────── */}
              <div className="bg-white rounded border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                  <span className="text-[12px] font-bold text-gray-700">What the detector compared</span>
                  <span className="text-[11px] text-gray-400 ml-2">
                    Sentinel-2 at 10 m per pixel — one pixel is wider than most of these structures
                  </span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-gray-100">
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
                  <div className="overflow-x-auto">
                    {/* Scrolls rather than clips. The card around this table is
                        overflow-hidden, so on a 390px phone columns four onward were
                        not merely cramped, they were invisible and unreachable. */}
                  <table className="w-full text-[12px] min-w-[760px]">
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
                    style={{ background: "var(--masid-navy)" }}>
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
