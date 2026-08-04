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
import { MapContainer, TileLayer, CircleMarker, Popup, Polygon, LayersControl, useMap } from "react-leaflet";
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

  const markers = mappable.map(p => (
    <CircleMarker key={p.id} center={[p.lat, p.lng]}
      radius={selectedId === p.id ? 9 : 5}
      pathOptions={{
        color: "#ffffff", weight: 1.5,
        fillColor: colorOf(p, enc), fillOpacity: 0.95,
      }}
      eventHandlers={{ click: () => onSelect(p.id) }}>
      <Popup>
        <div style={{ minWidth: 190 }}>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#64748b" }}>{p.id}</div>
          <div style={{ fontWeight: 600, fontSize: 12, margin: "2px 0 4px" }}>{p.description.slice(0, 90)}</div>
          <div style={{ fontSize: 11, color: "#475569" }}>{p.municipality} · {p.dpwhStatus}</div>
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
    <MapContainer center={BULACAN_CENTRE} zoom={11} className="w-full h-full"
      style={{ background: "#f2f2f0" }}>
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

      {cluster
        ? <MarkerClusterGroup chunkedLoading maxClusterRadius={45} spiderfyOnMaxZoom
            showCoverageOnHover={false}>{markers}</MarkerClusterGroup>
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
