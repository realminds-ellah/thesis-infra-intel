/**
 * The map inside a project's detail panel.
 *
 * Was a hand-drawn SVG: a grey rectangle, some boundary lines and small dots.
 * It told you nothing — you could see that a contract had neighbours, and
 * nothing about the place itself.
 *
 * Now a real Leaflet map opening on SATELLITE imagery, because the question
 * someone has when they click a flood-control contract is "what is actually
 * there". A revetment, a bare riverbank, an empty field, open water — all
 * readable at a glance, none of it inferable from a dot.
 *
 * Street view is one click away for anyone who wants place names instead.
 */

import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, LayersControl, ScaleControl, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { PROJECTS, type Project } from "./data";
import { colorOf, type Encoding } from "./mapColor";

export function ProjectMap({
  project, enc, onPick, height = 260,
}: {
  project: Project & { lat: number; lng: number };
  enc: Encoding;
  onPick?: (id: string) => void;
  height?: number;
}) {
  // Neighbours within roughly a kilometre, so the frame carries context without
  // becoming another cluttered overview.
  const near = useMemo(() => {
    const d = 0.011;
    return PROJECTS.filter(p =>
      p.id !== project.id && p.lat != null && p.lng != null &&
      Math.abs(p.lat - project.lat) < d && Math.abs(p.lng - project.lng) < d
    ) as (Project & { lat: number; lng: number })[];
  }, [project]);

  return (
    <MapContainer center={[project.lat, project.lng]} zoom={16}
      style={{ height, width: "100%" }} scrollWheelZoom={false}
      key={project.id}>
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Satellite">
          <TileLayer
            attribution="Esri, Maxar"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19} />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Street">
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        </LayersControl.BaseLayer>
      </LayersControl>

      {/* 30 m ring: roughly the footprint a coordinate is meant to describe, and
          the innermost radius the satellite tier samples. */}
      <Circle center={[project.lat, project.lng]} radius={30}
        pathOptions={{ color: "#ffffff", weight: 1.5, opacity: 0.85, fill: false, dashArray: "4 3" }} />

      {near.map(p => (
        <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={4}
          pathOptions={{ color: "#fff", weight: 1.5, fillColor: colorOf(p, enc), fillOpacity: 0.9 }}
          eventHandlers={{ click: () => onPick?.(p.id) }} />
      ))}

      <CircleMarker center={[project.lat, project.lng]} radius={8}
        pathOptions={{ color: "#fff", weight: 2.5, fillColor: colorOf(project, enc), fillOpacity: 1 }} />

      <ScaleControl position="bottomleft" imperial={false} />
    </MapContainer>
  );
}
