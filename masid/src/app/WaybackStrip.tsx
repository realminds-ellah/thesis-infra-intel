/**
 * The imagery a contract can be checked against, in time order.
 *
 * WHY THIS IS NOT CALLED A PROGRESS SLIDER
 *
 * It started out as one. Esri publishes 196 archived versions of its World
 * Imagery basemap, 28 of which return imagery over Bulacan, and 28 dated frames
 * across twelve years looks like a construction timeline.
 *
 * It is not. Reading the acquisition metadata for each version shows that the 28
 * are republications of SIX photographs — the 2019-10-05 flight alone appears in
 * twelve of them — and the gap between the last two flights is FIVE AND A HALF
 * YEARS, from October 2019 to April 2025. That gap contains this district
 * office's entire spending surge: the 2022, 2023 and 2024 contracts, which are
 * the largest bars on the dashboard, were awarded, built and completed without a
 * single high-resolution photograph being taken over them.
 *
 * A slider over 28 frames would have shown a reader twelve identical pictures
 * and implied a cadence that does not exist. So this shows the six real flights,
 * says when each was taken rather than when Esri published it, and states for
 * each contract whether any of them fall inside its construction window.
 *
 * WHAT IT IS GOOD FOR, which is a lot
 *
 * Measured across the 962 contracts carrying both a start and an end date:
 *
 *   136  (14%)  have a flight DURING construction
 *   826  (86%)  have a clean BEFORE and AFTER pair straddling the whole build
 *     0   (0%)  have neither
 *
 * Every single dated contract in this register can be looked at before and
 * after. That answers the question this project actually asks — did a structure
 * appear here — at 0.34 to 0.5 m per pixel, which is thirty times finer than the
 * Sentinel-2 tier that was measured to have no discriminative power at all.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Circle, CircleMarker, ScaleControl, useMap } from "react-leaflet";
import { Camera, ChevronLeft, ChevronRight, Info } from "lucide-react";
import "leaflet/dist/leaflet.css";

import WAYBACK from "./data/wayback.json";
import { tint, accent } from "./theme";

interface Frame {
  release: number;
  published: string;
  tileUrl: string;
  flown?: string | null;
  resolutionMetres?: number | null;
  accuracyMetres?: number | null;
  provider?: string | null;
  republishedAs?: number;
}

const FRAMES = (WAYBACK.frames as Frame[]).filter(f => f.flown || f.published);
const COVERAGE = WAYBACK.coverage as {
  contractsWithDates: number; flightDuringConstruction: number;
  cleanBeforeAndAfter: number; neither: number;
};

const dateOf = (f: Frame) => (f.flown || f.published).slice(0, 10);
const pretty = (d: string) =>
  new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Where a frame sits relative to this contract's construction window. */
type Phase = "before" | "during" | "after" | "unknown";
const PHASE_CFG: Record<Phase, { label: string; color: string }> = {
  before:  { label: "before it started", color: "#1c5cab" },
  during:  { label: "while it was being built", color: "#b45309" },
  after:   { label: "after it was due to finish", color: "#046b04" },
  unknown: { label: "contract has no dates", color: "#6b6b64" },
};

/** Keep the view when the tile layer swaps, so frames compare like for like. */
function HoldView({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    map.setView([lat, lng], map.getZoom(), { animate: false });
  }, [lat, lng, map]);
  return null;
}

export function WaybackStrip({ lat, lng, startDate, endDate, verdictColor }: {
  lat: number; lng: number;
  startDate?: string | null; endDate?: string | null;
  verdictColor: string;
}) {
  const [i, setI] = useState(FRAMES.length - 1);   // open on the most recent
  const [why, setWhy] = useState(false);

  const phased = useMemo(() => FRAMES.map(f => {
    const d = dateOf(f);
    let phase: Phase = "unknown";
    if (startDate && endDate) {
      const s = startDate.slice(0, 10), e = endDate.slice(0, 10);
      phase = d < s ? "before" : d > e ? "after" : "during";
    }
    return { f, d, phase };
  }), [startDate, endDate]);

  const during = phased.filter(p => p.phase === "during").length;
  const cur = phased[Math.min(i, phased.length - 1)];

  // Nothing in this component fetches. Tiles are requested by Leaflet from Esri
  // as they are panned into view and are never stored by this project.
  const tileUrl = cur.f.tileUrl
    .replace("{level}", "{z}").replace("{row}", "{y}").replace("{col}", "{x}");

  return (
    <div className="bg-white rounded border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2 flex-wrap">
        <Camera size={13} className="text-[#1e3a7b]" />
        <span className="text-[12px] font-bold text-gray-700">The same spot, photographed over time</span>
        <span className="text-[11px] text-gray-400">
          {FRAMES.length} flights over Bulacan since {dateOf(FRAMES[0]).slice(0, 4)}
        </span>
        <button onClick={() => setWhy(v => !v)} aria-label="Why only six?"
          className="text-gray-300 hover:text-[#1e3a7b]"><Info size={13} /></button>
      </div>

      {why && (
        <div className="px-4 py-3 border-b border-gray-100 text-[11px] text-gray-600 leading-relaxed space-y-1.5">
          <p>
            Esri publishes {String((WAYBACK as { publishedVersions: number }).publishedVersions)} archived
            versions of its imagery that return something over Bulacan, but they are republications
            of <strong>{FRAMES.length} actual photographs</strong> — the 5 October 2019 flight alone appears
            in twelve of them. Only the distinct flights are shown here, dated by when they were
            <em> taken</em>, not when they were published.
          </p>
          <p>
            <strong>There is a five-and-a-half-year gap between October 2019 and April 2025</strong>, which
            covers this office&apos;s entire spending surge. That is why this is not a progress view: for most
            contracts there is no photograph from during the build, only one before and one after.
          </p>
          <p className="text-gray-500">
            Across the {COVERAGE.contractsWithDates.toLocaleString()} contracts carrying both dates,{" "}
            {COVERAGE.flightDuringConstruction} have a flight during construction,{" "}
            {COVERAGE.cleanBeforeAndAfter} have a clean before-and-after pair, and {COVERAGE.neither} have neither.
          </p>
        </div>
      )}

      <div style={{ height: 380 }} className="relative">
        <MapContainer center={[lat, lng]} zoom={17} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          {/* Keyed by release: React remounts the layer on a frame change rather
              than mutating a URL Leaflet has already cached tiles for. */}
          <TileLayer key={cur.f.release} url={tileUrl} maxZoom={19} maxNativeZoom={19}
            attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics" />
          {[30, 90].map(m => (
            <Circle key={m} center={[lat, lng]} radius={m}
              pathOptions={{ color: "#fff", weight: 1.2, opacity: 0.75, fill: false, dashArray: "4 4" }} />
          ))}
          <CircleMarker center={[lat, lng]} radius={6}
            pathOptions={{ color: "#fff", weight: 2, fillColor: verdictColor, fillOpacity: 1 }} />
          <ScaleControl position="bottomleft" imperial={false} />
          <HoldView lat={lat} lng={lng} />
        </MapContainer>

        {/* Right, not left: Leaflet's zoom buttons sit top-left and were
            clipping the first word of the date. */}
        <div className="absolute top-2 right-2 px-2.5 py-1.5 rounded text-[12px] font-semibold shadow max-w-[70%]"
          style={{ background: "rgba(0,0,0,0.62)", color: "#fff", zIndex: 500 }}>
          {pretty(cur.d)}
          <span className="font-normal opacity-70 ml-1.5">
            {cur.f.resolutionMetres ? `· ${cur.f.resolutionMetres} m/px` : ""}
            {cur.f.provider ? ` · ${cur.f.provider}` : ""}
          </span>
        </div>
      </div>

      {/* The track. Each stop is a real flight; its colour says where it falls
          against this contract, so a reader can see at a glance whether any
          photograph exists from while the work was supposedly happening. */}
      <div className="px-4 pt-3 pb-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} aria-label="Earlier frame"
            className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30">
            <ChevronLeft size={14} />
          </button>
          <div className="flex-1 flex items-center gap-1">
            {phased.map((p, n) => {
              const on = n === i, c = PHASE_CFG[p.phase];
              return (
                <button key={p.f.release} onClick={() => setI(n)} title={`${pretty(p.d)} — ${c.label}`}
                  className="flex-1 group">
                  <div className="h-2 rounded-full transition-all"
                    style={{ background: on ? accent(c.color) : tint(c.color, 55), height: on ? 10 : 6 }} />
                  <div className={`text-[10px] mt-1 truncate ${on ? "font-semibold" : ""}`}
                    style={{ color: on ? accent(c.color) : undefined }}>
                    {p.d.slice(0, 7)}
                  </div>
                </button>
              );
            })}
          </div>
          <button onClick={() => setI(Math.min(phased.length - 1, i + 1))} disabled={i === phased.length - 1}
            aria-label="Later frame"
            className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30">
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap mt-2.5 text-[11px]">
          <span className="px-2 py-0.5 rounded font-medium"
            style={{ background: tint(PHASE_CFG[cur.phase].color), color: accent(PHASE_CFG[cur.phase].color) }}>
            this frame is {PHASE_CFG[cur.phase].label}
          </span>
          {startDate && endDate ? (
            during > 0
              ? <span className="text-gray-500">
                  {during} of these {FRAMES.length} flights fall inside the construction window.
                </span>
              : <span className="text-gray-500">
                  <strong className="text-gray-700">No photograph exists from during this build.</strong>{" "}
                  The nearest are before it started and after it was due to finish — enough to ask whether
                  a structure appeared, not enough to watch it being built.
                </span>
          ) : (
            <span className="text-gray-500">This contract publishes no start or end date, so the frames cannot be placed against it.</span>
          )}
          {cur.f.accuracyMetres && (
            <span className="ml-auto text-gray-400">
              positional accuracy ±{cur.f.accuracyMetres} m
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
