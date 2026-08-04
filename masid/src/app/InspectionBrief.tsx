/**
 * A field brief — the page an inspector takes to site.
 *
 * Everything before this was built for reading at a desk. An inspector needs
 * something else: where to go, what should be there, what to check, and somewhere
 * to write down what they found. On paper, because sites have no signal.
 *
 * Four things it does that the rest of the app does not:
 *
 *  1. NAVIGATION. Coordinates as a tap-through to Google Maps or Waze, plus the
 *     figures written out for a handheld GPS.
 *  2. WHAT SHOULD BE THERE. Structure type, chainage limits and length pulled
 *     off the contract description, so "is it built" becomes a specific question
 *     — "is there 780 m of revetment between STA 0+000 and STA 0+780" — instead
 *     of a vague one.
 *  3. WHAT THE RECORD ALREADY DISPUTES. Every flag, so an inspector arrives
 *     knowing the coordinate may be wrong rather than discovering it on the road.
 *  4. SPACE TO RECORD. Printed fields for findings, because a brief that cannot
 *     be written on comes back empty.
 *
 * Print styling is deliberate: the app's chrome, the map tiles and the buttons
 * are all suppressed, leaving a clean A4 page.
 */

import { useMemo } from "react";
import { X, Printer, Navigation, MapPin, AlertTriangle } from "lucide-react";

import {
  PROC_BY_ID, HAZARD_BY_ID, SAT_BY_ID, FLAG_LABELS, PROC_FLAG_LABELS,
  VERDICT_CFG, type Project,
} from "./data";

const pesoFull = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
const fmt = (d?: string | null) => d
  ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  : "—";

/** What to physically check, built from whatever the contract actually states. */
function checklist(p: Project): string[] {
  const x = p as unknown as {
    structureType?: string | null; barangay?: string | null;
    stationFrom?: string | null; stationTo?: string | null; lengthMetres?: number | null;
  };
  const thing = x.structureType ? x.structureType.toLowerCase() : "flood control structure";
  const out: string[] = [];

  out.push(`Is there a ${thing} at the published coordinate?`);
  if (x.stationFrom && x.stationTo) {
    out.push(`Does it run from STA ${x.stationFrom} to STA ${x.stationTo}`
      + (x.lengthMetres ? ` — about ${x.lengthMetres.toLocaleString()} m?` : "?"));
  } else {
    out.push("What is its length, measured or paced?");
  }
  if (x.barangay) out.push(`Is the site in Barangay ${x.barangay}, as the contract states?`);
  out.push("Condition: intact, damaged, undermined, or collapsed?");
  out.push("Does it match the structure type and materials in the contract?");
  out.push("Is there any DPWH project billboard on site, and what does it say?");
  out.push("Photographs: upstream, downstream, structure face, and any billboard.");
  if (p.dpwhStatus === "Completed") out.push("If nothing is found, note what IS at the location instead.");
  return out;
}

export function InspectionBrief({ project, onClose }:
  { project: Project; onClose: () => void }) {
  const pr = PROC_BY_ID.get(project.id);
  const hz = HAZARD_BY_ID.get(project.id);
  const sat = SAT_BY_ID.get(project.id);
  const x = project as unknown as {
    structureType?: string | null; barangay?: string | null;
    stationFrom?: string | null; stationTo?: string | null; lengthMetres?: number | null;
  };
  const checks = useMemo(() => checklist(project), [project]);

  const flags = [
    ...project.auditFlags.map(f => ({ ...f, label: FLAG_LABELS[f.code] ?? f.code })),
    ...(pr?.procurementFlags ?? []).map(f => ({ ...f, label: PROC_FLAG_LABELS[f.code] ?? f.code })),
  ];

  const hasCoord = project.lat != null && project.lng != null;
  const gmaps = hasCoord ? `https://www.google.com/maps/search/?api=1&query=${project.lat},${project.lng}` : null;
  const waze = hasCoord ? `https://waze.com/ul?ll=${project.lat},${project.lng}&navigate=yes` : null;

  const Line = ({ label, n = 1 }: { label: string; n?: number }) => (
    <div className="mb-3">
      <div className="text-[11px] text-gray-500 mb-1">{label}</div>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="border-b border-gray-300" style={{ height: 22 }} />
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center overflow-y-auto p-6 print:p-0 print:bg-white print:static"
      style={{ zIndex: 2000 }}>
      <style>{`@media print {
        .no-print { display: none !important; }
        body * { visibility: hidden; }
        .brief, .brief * { visibility: visible; }
        .brief { position: absolute; inset: 0; width: 100%; box-shadow: none; }
        @page { margin: 14mm; }
      }`}</style>

      <div className="brief bg-white rounded shadow-2xl w-full print:shadow-none" style={{ maxWidth: 820 }}>
        <div className="no-print flex items-center gap-2 px-6 py-3 border-b border-gray-200 sticky top-0 bg-white rounded-t">
          <span className="text-[13px] font-bold text-gray-900">Field inspection brief</span>
          <span className="text-[11px] text-gray-400">print it, or save as PDF — sites have no signal</span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded text-white hover:opacity-90" style={{ background: "var(--masid-navy)" }}>
              <Printer size={13} />Print
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
        </div>

        <div className="px-8 py-6 text-gray-900">
          <header className="border-b-2 border-gray-900 pb-3 mb-4">
            <div className="flex items-baseline justify-between">
              <h1 className="text-[17px] font-bold">Flood control — field inspection</h1>
              <span className="font-mono text-[12px]">{project.id}</span>
            </div>
            <div className="text-[12px] text-gray-600 mt-1">
              DPWH {project.districtOffice} · generated {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          </header>

          <h2 className="text-[13px] font-bold mb-1">{project.name}</h2>
          <p className="text-[11px] text-gray-600 leading-relaxed mb-4">{project.description}</p>

          <section className="mb-5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-1 mb-2">Where to go</h3>
            <table className="w-full text-[12px]">
              <tbody>
                <tr><td className="py-1 text-gray-500 w-40">Municipality</td><td className="font-medium">{project.municipality}, Bulacan</td></tr>
                {x.barangay && <tr><td className="py-1 text-gray-500">Barangay (per contract)</td><td className="font-medium">{x.barangay}</td></tr>}
                <tr><td className="py-1 text-gray-500">Coordinates</td>
                  <td className="font-mono font-medium">
                    {hasCoord ? `${project.lat!.toFixed(6)}, ${project.lng!.toFixed(6)}` :
                      <span className="text-red-700">NOT PUBLISHED — locate from the description</span>}
                  </td></tr>
                {x.stationFrom && <tr><td className="py-1 text-gray-500">Chainage</td>
                  <td className="font-mono font-medium">STA {x.stationFrom} → STA {x.stationTo}
                    {x.lengthMetres ? `  (≈ ${x.lengthMetres.toLocaleString()} m)` : ""}</td></tr>}
                {hz?.hazard && <tr><td className="py-1 text-gray-500">Flood hazard here</td>
                  <td className="font-medium">{hz.level ? `${hz.hazard}` : `outside the model${hz.metresToHazard != null ? `, ${hz.metresToHazard.toLocaleString()} m away` : ""}`}</td></tr>}
              </tbody>
            </table>
            {hasCoord && (
              <div className="no-print flex gap-2 mt-2">
                <a href={gmaps!} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-gray-200 rounded hover:border-[#1e3a7b]/40 text-[#1e3a7b]"><Navigation size={12} />Google Maps</a>
                <a href={waze!} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-gray-200 rounded hover:border-[#1e3a7b]/40 text-[#1e3a7b]"><MapPin size={12} />Waze</a>
              </div>
            )}
          </section>

          <section className="mb-5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-1 mb-2">What was contracted</h3>
            <table className="w-full text-[12px]">
              <tbody>
                <tr><td className="py-1 text-gray-500 w-40">Structure</td><td className="font-medium">{x.structureType ?? "not stated in the title"}</td></tr>
                <tr><td className="py-1 text-gray-500">Contractor</td><td className="font-medium">{project.contractor.replace(/\s*\(.*$/, "")}</td></tr>
                <tr><td className="py-1 text-gray-500">Approved budget</td><td className="font-mono">{pr?.abc ? pesoFull(pr.abc) : "—"}</td></tr>
                <tr><td className="py-1 text-gray-500">Awarded for</td><td className="font-mono font-medium">{pr?.awardAmount ? pesoFull(pr.awardAmount) : "—"}</td></tr>
                <tr><td className="py-1 text-gray-500">Started / due</td><td className="font-mono">{fmt(project.startDate)} → {fmt(project.endDate)}</td></tr>
                <tr><td className="py-1 text-gray-500">DPWH reports</td><td className="font-medium">{project.dpwhStatus}, {project.completion}% complete</td></tr>
              </tbody>
            </table>
          </section>

          {flags.length > 0 && (
            <section className="mb-5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-1 mb-2 flex items-center gap-1.5">
                <AlertTriangle size={11} />Know before you go — {flags.length} flagged
              </h3>
              <ul className="text-[11px] space-y-1.5">
                {flags.map(f => (
                  <li key={f.code} className="flex gap-2">
                    <span className="text-gray-400">•</span>
                    <span><strong>{f.label}.</strong> {f.detail}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {sat && (
            <section className="mb-5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-1 mb-2">Satellite, for reference only</h3>
              <p className="text-[11px]"><strong>{VERDICT_CFG[sat.verdict].short}.</strong> {sat.detail}</p>
              <p className="text-[10px] text-gray-500 mt-1">
                This tier has no measured ability to tell flagged contracts from ordinary ones. Do not let it
                shape what you look for on site.
              </p>
            </section>
          )}

          <section className="mb-5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-1 mb-2">What to check</h3>
            <ol className="text-[12px] space-y-2">
              {checks.map((c, i) => (
                <li key={i} className="flex gap-2.5 items-start">
                  <span className="border border-gray-400 rounded-sm shrink-0 mt-0.5" style={{ width: 13, height: 13 }} />
                  <span>{c}</span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-1 mb-3">Findings</h3>
            <Line label="Structure found? (yes / partly / no — describe)" n={2} />
            <Line label="Measured length and condition" n={2} />
            <Line label="Discrepancies against the contract" n={3} />
            <Line label="Photograph references" />
            <div className="grid grid-cols-2 gap-6 mt-5">
              <Line label="Inspector — name and signature" />
              <Line label="Date of inspection" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
