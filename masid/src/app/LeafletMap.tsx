/**
 * The real map.
 *
 * Replaces a hand-drawn SVG of Bulacan whose zoom buttons did nothing, whose
 * 1,189 dots overlapped into an unreadable smear, and which showed no ground at
 * all — just municipal outlines on a flat fill.
 *
 * Follows BetterGov.ph's flood-control map (CC0) on the parts they got right:
 * Leaflet, OpenStreetMap tiles, marker clustering, popups. Two things are added
 * that a register does not need but an audit tool does:
 *
 *  - A SATELLITE BASEMAP. Being able to see the ground under a contract is the
 *    whole premise here. A coordinate that sits in open water, or in the middle
 *    of a subdivision, or on a riverbank with no structure, is legible at a
 *    glance in a way no amount of tabular flagging achieves.
 *  - The municipal boundaries the coordinate checks are computed against, drawn
 *    as an overlay, so a "location doesn't match the description" flag can be
 *    seen rather than taken on trust.
 */

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, Polygon, LayersControl, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { BOUNDARIES, META, type Project } from "./data";
import { colorOf, type Encoding } from "./mapColor";

const BULACAN_CENTRE: [number, number] = [14.86, 120.83];

/**
 * Recentre when the filtered set changes, so a filter never leaves you staring
 * at an empty frame.
 *
 * Fits the 2nd-98th percentile of coordinates rather than all of them. Three
 * contracts in this register carry coordinates tens of kilometres outside
 * Bulacan — that is the point of the location checks — and fitting to those
 * zooms the map out to Batangas and makes the other 1,188 unreadable. The
 * outliers are still plotted; they just do not get to set the frame.
 */
function FitToProjects({ projects }: { projects: Project[] }) {
  const map = useMap();
  useEffect(() => {
    const pts = projects.filter(p => p.lat != null && p.lng != null)
      .map(p => [p.lat!, p.lng!] as [number, number]);
    if (!pts.length) return;
    if (pts.length === 1) { map.setView(pts[0], 15, { animate: true }); return; }
    const q = (arr: number[], f: number) => [...arr].sort((a, b) => a - b)[Math.floor(f * (arr.length - 1))];
    const lats = pts.map(p => p[0]), lngs = pts.map(p => p[1]);
    map.fitBounds(L.latLngBounds(
      [q(lats, 0.02), q(lngs, 0.02)], [q(lats, 0.98), q(lngs, 0.98)],
    ).pad(0.15), { animate: true, maxZoom: 15 });
  }, [projects, map]);
  return null;
}

/**
 * Cluster bubbles that say how many, and nothing else.
 *
 * They used to be coloured by the share of contracts inside that were flagged,
 * on the same traffic light the dots use. That was better than leaflet's default
 * — which colours by COUNT, in the same three hues, so a green bubble reading
 * "clean" actually meant "small" — but it was still wrong for a subtler reason.
 *
 * A bubble can hold forty contracts spread over three municipalities. Averaging
 * them into one colour produces a number that is true of no single contract and
 * cannot be acted on: an amber bubble tells you neither which contracts are
 * flagged nor where they are. It required a legend to decode and, decoded, said
 * nothing. So the bubble is now neutral and carries the count alone, and the
 * colour language belongs entirely to the dots, which are the things a reader
 * can actually click.
 */
function clusterIcon(cluster: { getChildCount(): number }) {
  const n = cluster.getChildCount();
  const size = n < 10 ? 32 : n < 100 ? 40 : 48;
  return L.divIcon({
    className: "masid-cluster",
    iconSize: L.point(size, size),
    html: `<div title="${n} contracts here — zoom in to see them"
        style="width:${size}px;height:${size}px;border-radius:50%;
        background:#5b6472;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);
        display:flex;align-items:center;justify-content:center;
        color:#fff;font-family:Inter,sans-serif;font-weight:700;
        font-size:${n > 999 ? 12 : n > 99 ? 14 : 15}px">${n}</div>`,
  });
}

export function LeafletMap({
  projects, enc, selectedId, onSelect, showBoundaries, cluster = true,
}: {
  projects: Project[];
  enc: Encoding;
  selectedId: string;
  onSelect: (id: string) => void;
  showBoundaries: boolean;
  cluster?: boolean;
}) {
  const mappable = useMemo(
    () => projects.filter(p => p.lat != null && p.lng != null) as (Project & { lat: number; lng: number })[],
    [projects]);

  const served = useMemo(
    () => new Set(META.coverage.municipalitiesServed), []);

  /**
   * A ring of DPWH-REPORTED progress around each dot.
   *
   * Still a circle — the mark language does not change — but the white outline
   * now carries a second fact for free. A full ring is 100% reported complete, a
   * quarter ring is 25%, and the gap is legible at a glance without a legend,
   * because "how much of the circle is drawn" needs no key.
   *
   * The word REPORTED is doing real work. This is the percentage DPWH publishes,
   * not an observation of the ground, and the popup and detail panel both say so.
   * A ring that looked like measured progress would be the app asserting exactly
   * the thing this project exists to question.
   */
  const ring = (pct: number, r: number) => {
    const c = 2 * Math.PI * r;
    const done = Math.max(0, Math.min(100, pct)) / 100;
    return { dash: `${(c * done).toFixed(1)} ${(c * (1 - done)).toFixed(1)}` };
  };

  const markers = mappable.map(p => (
    <CircleMarker key={p.id} center={[p.lat, p.lng]}
      radius={selectedId === p.id ? 9 : 5}
      pathOptions={{
        color: "#ffffff", weight: selectedId === p.id ? 3 : 2,
        // A dash pattern around the circumference: drawn for the reported share,
        // absent for the rest. No extra DOM, and it survives clustering.
        dashArray: ring(p.completion, selectedId === p.id ? 9 : 5).dash,
        lineCap: "butt",
        fillColor: colorOf(p, enc), fillOpacity: 0.95,
      }}
      // read back by clusterIcon to colour the bubble by contents
      {...{ flagged: p.auditFlags.length > 0 } as object}
      eventHandlers={{ click: () => onSelect(p.id) }}>
      <Popup>
        <div style={{ minWidth: 190 }}>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "var(--color-gray-500)" }}>{p.id}</div>
          <div style={{ fontWeight: 600, fontSize: 12, margin: "2px 0 4px", color: "var(--color-gray-900)" }}>{p.description.slice(0, 90)}</div>
          <div style={{ fontSize: 11, color: "var(--color-gray-600)" }}>{p.municipality} · {p.dpwhStatus}</div>
          <div style={{ fontSize: 11, color: "var(--color-gray-500)", marginTop: 2 }}>
            {p.completion}% complete <span style={{ opacity: 0.7 }}>— as reported by DPWH</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--color-gray-500)" }}>
            {(p as unknown as { lengthMetres?: number|null }).lengthMetres
              ? `contract states ${(p as unknown as { lengthMetres: number }).lengthMetres.toLocaleString()} m of work`
              : "no extent published — the description states no chainage"}
          </div>
          {p.auditFlags.length > 0 && (
            <div style={{ fontSize: 11, color: "#c05621", marginTop: 4, fontWeight: 600 }}>
              Flagged for review — {p.auditFlags.length} check{p.auditFlags.length === 1 ? "" : "s"} tripped
            </div>
          )}
          <button onClick={() => onSelect(p.id)}
            style={{ marginTop: 6, fontSize: 11, color: "#1e3a7b", textDecoration: "underline", background: "none", border: 0, padding: 0, cursor: "pointer" }}>
            Open details
          </button>
        </div>
      </Popup>
    </CircleMarker>
  ));

  return (
    // No preferCanvas: clustering already keeps the DOM small, and SVG markers
    // stay inspectable, hoverable and testable in a way canvas ones do not.
    // No inline background: the void behind the tiles is themed in dark.css so
    // it follows light and dark instead of staying a hardcoded near-white.
    <MapContainer center={BULACAN_CENTRE} zoom={11} className="w-full h-full">
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Street map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        </LayersControl.BaseLayer>
        {/* The reason a flood-control register wants a map at all: you can see
            whether there is anything there. */}
        <LayersControl.BaseLayer name="Satellite">
          <TileLayer
            attribution='Imagery &copy; Esri, Maxar, Earthstar Geographics'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19} />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Plain">
          <TileLayer
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png" maxZoom={19} />
        </LayersControl.BaseLayer>
      </LayersControl>

      {showBoundaries && BOUNDARIES.map(b => (
        <Polygon key={b.name}
          positions={b.rings.map(r => r.map(([lng, lat]) => [lat, lng] as [number, number]))}
          pathOptions={{
            color: "#1e3a7b", weight: served.has(b.name) ? 1.4 : 0.6,
            opacity: served.has(b.name) ? 0.7 : 0.3, fill: false,
          }}>
          <Popup>{b.name}</Popup>
        </Polygon>
      ))}

      {/* The selected contract's stated extent, so the scale of the work is
          visible without opening the detail panel. Same reasoning as
          ProjectMap: a circle of half the stated length, because the register
          publishes a point and no bearing. */}
      {(() => {
        const sel = mappable.find(p => p.id === selectedId);
        const m = sel && (sel as unknown as { lengthMetres?: number | null }).lengthMetres;
        return sel && m && m > 0 ? (
          <Circle center={[sel.lat, sel.lng]} radius={m / 2}
            pathOptions={{ color: "#f7c948", weight: 2, opacity: 0.9, fillColor: "#f7c948", fillOpacity: 0.10 }} />
        ) : null;
      })()}

      {cluster
        ? <MarkerClusterGroup chunkedLoading maxClusterRadius={45} spiderfyOnMaxZoom
            showCoverageOnHover={false} iconCreateFunction={clusterIcon}>{markers}</MarkerClusterGroup>
        : markers}

      <FitToProjects projects={projects} />
    </MapContainer>
  );
}

/** Toggle kept next to the map so the reader can turn clustering off when they
 *  want to see the raw density rather than tidy circles. */
export function useClusterToggle(initial = true) {
  return useState(initial);
}
