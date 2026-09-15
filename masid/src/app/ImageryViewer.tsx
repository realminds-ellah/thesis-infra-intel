/**
 * Every view of one coordinate, in one frame, with the option to split it in two.
 *
 * WHY THIS REPLACED FOUR PANELS
 *
 * This screen used to stack four map panels for a single selected contract —
 * a Leaflet map of current Esri imagery, the dated Wayback strip, a Google
 * embed, and the Mapillary ground viewer — carrying FOUR basemaps behind TWO
 * different layer controls in two different idioms. Two pairs of those simply
 * repeated each other: OpenStreetMap against Google's road map, and Esri's
 * aerial against Google's. So the views became one labelled list over one
 * frame, and the screen got shorter by three panels.
 *
 * THE LIVE ESRI LAYER IS GONE ON PURPOSE
 *
 * It showed "what is there now" without saying when now was. Every Wayback
 * frame carries the date it was FLOWN, and the most recent — 7 April 2025 at
 * 0.34 m — is the same imagery the live basemap was serving. A dated frame is
 * strictly better than an undated one in a project whose entire argument is
 * about what can be established from the record, so the undated one went.
 *
 * WHY SPLIT VIEW IS THE POINT AND NOT A FLOURISH
 *
 * One frame at a time answers "what is there". The question this project asks
 * is "did something APPEAR", and that needs two frames at once. Split mode
 * opens on the contract's own construction window — the last flight before it
 * started beside the first flight after it was due to finish — which is
 * available for 826 of the 962 dated contracts. The two maps are pan- and
 * zoom-locked, so what you move on one you move on both and the comparison
 * stays like for like.
 *
 * That is also the year-by-year comparison Google cannot give. Its historical
 * slider lives inside Google Earth and inside the Street View interface, is
 * exposed by no documented API — the JS API's StreetViewPanoramaData carries
 * `imageDate` for the CURRENT panorama and nothing else — and cannot be driven
 * from an embed. Esri publishes its archive; Google does not. So the dated
 * comparison runs on Esri, and Google is here as a second undated source.
 *
 * WHAT EACH VIEW COSTS
 *
 * Nothing. Esri and OSM tiles are fetched by Leaflet as they are panned into
 * view and are never stored by this project; the Google views are the classic
 * keyless embed; Mapillary needs an optional free read-only token and degrades
 * to links without one.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  MapContainer, TileLayer, Circle, CircleMarker, ScaleControl, useMap, useMapEvents,
} from "react-leaflet";
import {
  Camera, Info, Columns2, Minimize2, ExternalLink, Map as MapIcon, Satellite,
  PersonStanding, Footprints,
} from "lucide-react";
import "leaflet/dist/leaflet.css";

import WAYBACK from "./data/wayback.json";
import { StreetLevel } from "./StreetLevel";
import { imageryLinks } from "./satReview";

interface Frame {
  release: number; published: string; tileUrl: string;
  flown?: string | null; resolutionMetres?: number | null;
  accuracyMetres?: number | null; provider?: string | null; republishedAs?: number;
}

const FRAMES = (WAYBACK.frames as Frame[]).filter(f => f.flown || f.published);
const COVERAGE = WAYBACK.coverage as {
  contractsWithDates: number; flightDuringConstruction: number;
  cleanBeforeAndAfter: number; neither: number;
};
const PUBLISHED = (WAYBACK as unknown as { publishedVersions: number }).publishedVersions;

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

type ViewId = "wayback" | "osm" | "google" | "street" | "ground";

const VIEWS: { id: ViewId; label: string; icon: ReactNode; hint: string }[] = [
  { id: "wayback", label: "Dated aerial", icon: <Camera size={11} />,
    hint: "Esri, 0.34–0.5 m, six flights — the only view here that carries a date" },
  { id: "osm",     label: "Street map",   icon: <MapIcon size={11} />,
    hint: "place names — is this coordinate near the barangay the contract names?" },
  { id: "google",  label: "Google aerial", icon: <Satellite size={11} />,
    hint: "a second source, flown on Google's schedule and undated in this frame" },
  { id: "street",  label: "Street View",  icon: <PersonStanding size={11} />,
    hint: "Google's panorama, if a road passes near enough" },
  { id: "ground",  label: "Ground level", icon: <Footprints size={11} />,
    hint: "Mapillary, dated and openly licensed — needs a free token" },
];

const NOTE: Record<ViewId, string> = {
  wayback:
    "Dated by when the photograph was TAKEN, not when Esri published it. Use split view to put two dates side by side.",
  osm:
    "© OpenStreetMap contributors. Here for place names, not for imagery.",
  google:
    "Google's own aerial, keyless. Often a different date from the Esri frames — where the two disagree about what is on the ground, that is worth noticing. No date is exposed in this embed.",
  street:
    "A grey frame means Google has no panorama within range, which is ordinary for a riverbank — street imagery follows roads, and “no ground photographs of this site” is a finding in itself.",
  ground:
    "Mapillary imagery is dated and CC BY-SA, so a frame can be cited rather than merely linked to. Coverage over these sites is thin and the panel says so rather than erroring.",
};

/** Both maps hold one view, so a pan on either is a pan on both. */
type MapView = { center: [number, number]; zoom: number };

function Sync({ view, onChange }: { view: MapView; onChange: (v: MapView) => void }) {
  const map = useMap();
  useEffect(() => {
    const c = map.getCenter();
    const same =
      Math.abs(c.lat - view.center[0]) < 1e-6 &&
      Math.abs(c.lng - view.center[1]) < 1e-6 &&
      map.getZoom() === view.zoom;
    if (!same) map.setView(view.center, view.zoom, { animate: false });
  }, [view, map]);
  useMapEvents({
    moveend() {
      const c = map.getCenter();
      onChange({ center: [c.lat, c.lng], zoom: map.getZoom() });
    },
  });
  return null;
}

/** Leaflet measures itself on mount; splitting the frame changes its width. */
function Resize({ dep }: { dep: unknown }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 80);
    return () => clearTimeout(t);
  }, [dep, map]);
  return null;
}

function LeafletPane({ lat, lng, tile, attribution, verdictColor, view, onView, dep, maxZoom = 19 }: {
  lat: number; lng: number; tile: string; attribution: string; verdictColor: string;
  view: MapView; onView: (v: MapView) => void; dep: unknown; maxZoom?: number;
}) {
  return (
    <MapContainer center={view.center} zoom={view.zoom}
      style={{ height: "100%", width: "100%" }} scrollWheelZoom>
      <TileLayer key={tile} url={tile} attribution={attribution}
        maxZoom={maxZoom} maxNativeZoom={maxZoom} />
      {/* The radii the detector sampled, so what it looked at is visible on the
          ground rather than only in the table. */}
      {[30, 90, 150].map(m => (
        <Circle key={m} center={[lat, lng]} radius={m}
          pathOptions={{ color: "#fff", weight: 1.2, opacity: 0.75, fill: false, dashArray: "4 4" }} />
      ))}
      <CircleMarker center={[lat, lng]} radius={6}
        pathOptions={{ color: "#fff", weight: 2, fillColor: verdictColor, fillOpacity: 1 }} />
      <ScaleControl position="bottomleft" imperial={false} />
      <Sync view={view} onChange={onView} />
      <Resize dep={dep} />
    </MapContainer>
  );
}

interface PaneState { view: ViewId; frame: number }

function Pane({ lat, lng, id, verdictColor, phased, state, setState, mapView, setMapView, split, height }: {
  lat: number; lng: number; id?: string; verdictColor: string;
  phased: { f: Frame; d: string; phase: Phase }[];
  state: PaneState; setState: (s: PaneState) => void;
  mapView: MapView; setMapView: (v: MapView) => void;
  split: boolean; height: number;
}) {
  const cur = phased[Math.min(state.frame, phased.length - 1)];
  const tileUrl = cur.f.tileUrl
    .replace("{level}", "{z}").replace("{row}", "{y}").replace("{col}", "{x}");

  const gsrc =
    state.view === "street"
      ? `https://maps.google.com/maps?q=${lat},${lng}&layer=c&cbll=${lat},${lng}&cbp=12,0,0,0,0&hl=en&output=svembed`
      : `https://maps.google.com/maps?q=${lat},${lng}&z=18&t=k&hl=en&output=embed`;

  return (
    <div className="flex flex-col min-w-0">
      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 flex-wrap bg-white">
        <select value={state.view}
          onChange={e => setState({ ...state, view: e.target.value as ViewId })}
          title={VIEWS.find(v => v.id === state.view)?.hint}
          className="text-[11px] font-semibold text-gray-700 border border-gray-200 rounded px-1.5 py-1 bg-white">
          {VIEWS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>

        {state.view === "wayback" && (
          <>
            <select value={state.frame}
              onChange={e => setState({ ...state, frame: Number(e.target.value) })}
              className="text-[11px] font-mono text-gray-700 border border-gray-200 rounded px-1.5 py-1 bg-white">
              {phased.map((p, n) => (
                <option key={p.f.release} value={n}>
                  {pretty(p.d)}{p.phase === "unknown" ? "" : ` — ${PHASE_CFG[p.phase].label}`}
                </option>
              ))}
            </select>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
              style={{ background: `${PHASE_CFG[cur.phase].color}18`, color: PHASE_CFG[cur.phase].color }}>
              {cur.f.resolutionMetres ? `${cur.f.resolutionMetres} m/px` : "Esri"}
            </span>
          </>
        )}
        {!split && (
          <span className="ml-auto text-[10px] font-mono text-gray-400">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </span>
        )}
      </div>

      <div style={{ height }} className="bg-gray-50">
        {state.view === "wayback" && (
          <LeafletPane lat={lat} lng={lng} tile={tileUrl} verdictColor={verdictColor}
            attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics"
            view={mapView} onView={setMapView} dep={split} />
        )}
        {state.view === "osm" && (
          <LeafletPane lat={lat} lng={lng} tile="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            verdictColor={verdictColor} attribution="&copy; OpenStreetMap contributors"
            view={mapView} onView={setMapView} dep={split} />
        )}
        {(state.view === "google" || state.view === "street") && (
          // No key, no quota, nothing to bill — the classic embed endpoint.
          <iframe key={`${state.view}-${lat}-${lng}`}
            title={`Google ${state.view === "street" ? "Street View" : "aerial"} at ${lat.toFixed(5)}, ${lng.toFixed(5)}${id ? ` — ${id}` : ""}`}
            src={gsrc} style={{ width: "100%", height: "100%", border: 0 }}
            loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
        )}
        {state.view === "ground" && (
          <div className="h-full overflow-auto"><StreetLevel lat={lat} lng={lng} /></div>
        )}
      </div>

      <p className="px-3 py-2 text-[10px] text-gray-400 leading-snug border-t border-gray-100 bg-white">
        {NOTE[state.view]}
      </p>
    </div>
  );
}

export function ImageryViewer({ lat, lng, id, startDate, endDate, verdictColor }: {
  lat: number; lng: number; id?: string;
  startDate?: string | null; endDate?: string | null;
  verdictColor: string;
}) {
  const phased = useMemo(() => FRAMES.map(f => {
    const d = dateOf(f);
    let phase: Phase = "unknown";
    if (startDate && endDate) {
      const s = startDate.slice(0, 10), e = endDate.slice(0, 10);
      phase = d < s ? "before" : d > e ? "after" : "during";
    }
    return { f, d, phase };
  }), [startDate, endDate]);

  // Split opens on this contract's own construction window: the last flight
  // before work started beside the first one after it was due to finish. That
  // pair exists for 826 of the 962 dated contracts, and it is the comparison
  // the whole project is built to make.
  const beforeIdx = useMemo(() => {
    const i = phased.map((p, n) => (p.phase === "before" ? n : -1)).filter(n => n >= 0);
    return i.length ? i[i.length - 1] : 0;
  }, [phased]);
  const afterIdx = useMemo(() => {
    const i = phased.findIndex(p => p.phase === "after");
    return i >= 0 ? i : phased.length - 1;
  }, [phased]);

  const [split, setSplit] = useState(false);
  const [why, setWhy] = useState(false);
  const [left, setLeft] = useState<PaneState>({ view: "wayback", frame: phased.length - 1 });
  const [right, setRight] = useState<PaneState>({ view: "google", frame: phased.length - 1 });
  const [mapView, setMapView] = useState<MapView>({ center: [lat, lng], zoom: 18 });

  // A new contract is a new coordinate; recentre and drop back to one frame.
  useEffect(() => {
    setMapView({ center: [lat, lng], zoom: 18 });
    setLeft({ view: "wayback", frame: phased.length - 1 });
    setRight({ view: "google", frame: phased.length - 1 });
  }, [lat, lng, phased.length]);

  const openSplit = () => {
    setLeft({ view: "wayback", frame: beforeIdx });
    setRight({ view: "wayback", frame: afterIdx });
    setSplit(true);
  };

  const during = phased.filter(p => p.phase === "during").length;
  const height = split ? 380 : 460;

  return (
    <div className="bg-white rounded border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2 flex-wrap">
        <Camera size={13} className="text-[#1e3a7b]" />
        <span className="text-[12px] font-bold text-gray-700">The imagery at this coordinate</span>
        <span className="text-[11px] text-gray-400">
          {FRAMES.length} dated flights since {dateOf(FRAMES[0]).slice(0, 4)}
          {startDate && endDate
            ? during ? ` · ${during} during this build` : " · none during this build"
            : ""}
        </span>
        <button onClick={() => setWhy(v => !v)} aria-label="Why only six flights?"
          className="text-gray-300 hover:text-[#1e3a7b]"><Info size={13} /></button>

        <button onClick={() => (split ? setSplit(false) : openSplit())}
          aria-pressed={split}
          title={split ? "Back to one frame" : "Put two dates side by side, pan-locked"}
          className={`ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-semibold transition-colors ${
            split ? "bg-[#1e3a7b] text-white" : "text-[#1e3a7b] border border-gray-200 hover:bg-white"}`}>
          {split ? <Minimize2 size={11} /> : <Columns2 size={11} />}
          {split ? "One frame" : "Compare"}
        </button>
      </div>

      {why && (
        <div className="px-4 py-3 border-b border-gray-100 text-[11px] text-gray-600 leading-relaxed space-y-1.5">
          <p>
            Esri publishes {String(PUBLISHED)} archived versions of its imagery that return something over
            Bulacan, but they are republications of <strong>{FRAMES.length} actual photographs</strong> — the
            5 October 2019 flight alone appears in twelve of them. Only the distinct flights are listed,
            dated by when they were <em>taken</em>, not when they were published.
          </p>
          <p>
            <strong>There is a five-and-a-half-year gap between October 2019 and April 2025</strong>, which
            covers this office&apos;s entire spending surge. That is why this is not a progress view: for most
            contracts there is no photograph from during the build, only one before and one after.
          </p>
          <p className="text-gray-500">
            Across the {COVERAGE.contractsWithDates.toLocaleString()} contracts carrying both dates,{" "}
            {COVERAGE.flightDuringConstruction} have a flight during construction,{" "}
            {COVERAGE.cleanBeforeAndAfter} have a clean before-and-after pair, and {COVERAGE.neither} have
            neither. Google publishes no comparable archive that can be embedded, which is why the dated
            comparison here runs on Esri.
          </p>
        </div>
      )}

      <div className={split ? "grid" : ""}
        style={split ? { gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 1, background: "#e5e7eb" } : undefined}>
        <Pane lat={lat} lng={lng} id={id} verdictColor={verdictColor} phased={phased}
          state={left} setState={setLeft} mapView={mapView} setMapView={setMapView}
          split={split} height={height} />
        {split && (
          <Pane lat={lat} lng={lng} id={id} verdictColor={verdictColor} phased={phased}
            state={right} setState={setRight} mapView={mapView} setMapView={setMapView}
            split={split} height={height} />
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-3 flex-wrap">
        <span className="text-[10px] text-gray-400">
          dashed rings 30 / 90 / 150 m · {split ? "both frames are pan-locked · " : ""}more dates:
        </span>
        {imageryLinks(lat, lng).map(l => (
          <a key={l.label} href={l.href} target="_blank" rel="noreferrer" title={l.note}
            className="text-[11px] text-[#1e3a7b] hover:underline flex items-center gap-1">
            {l.label}<ExternalLink size={9} />
          </a>
        ))}
      </div>
    </div>
  );
}
