/**
 * A real, zoomed map of one project's surroundings.
 *
 * Replaces a hardcoded decorative polygon that had been standing in for a map
 * since the design export — it drew the same invented shape whatever contract
 * you opened, with the marker positioned against a coastline that did not exist.
 *
 * This draws the actual municipal boundaries around the published coordinate,
 * every other contract within the frame, and a scale bar measured from the
 * extent, so the reader can see what is genuinely nearby.
 */

import { useMemo } from "react";
import { BOUNDARIES, PROJECTS, type Project } from "./data";
import { BASEMAP, colorOf, type Encoding } from "./mapColor";

/** Metres per degree of longitude at Bulacan's latitude, near enough. */
const M_PER_DEG_LNG = 111_320 * Math.cos((14.85 * Math.PI) / 180);
const M_PER_DEG_LAT = 110_570;

export function ProjectMap({
  project, enc, spanMetres = 2500, width = 400, height = 240, onPick,
}: {
  project: Project & { lat: number; lng: number };
  enc: Encoding;
  spanMetres?: number;
  width?: number;
  height?: number;
  onPick?: (id: string) => void;
}) {
  const view = useMemo(() => {
    // Half-spans chosen so the frame is geographically square even though the
    // viewport is not — otherwise everything is subtly stretched east-west.
    const halfLng = spanMetres / 2 / M_PER_DEG_LNG;
    const halfLat = (spanMetres / 2 / M_PER_DEG_LAT) * (height / width);
    const minLng = project.lng - halfLng, maxLng = project.lng + halfLng;
    const minLat = project.lat - halfLat, maxLat = project.lat + halfLat;
    const x = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * width;
    const y = (lat: number) => height - ((lat - minLat) / (maxLat - minLat)) * height;

    const paths = BOUNDARIES.map(b => ({
      name: b.name,
      d: b.rings
        .filter(r => r.some(([lo, la]) => lo > minLng - 0.05 && lo < maxLng + 0.05 &&
                                          la > minLat - 0.05 && la < maxLat + 0.05))
        .map(r => r.map(([lo, la], i) => `${i ? "L" : "M"}${x(lo).toFixed(1)},${y(la).toFixed(1)}`).join("") + "Z")
        .join(" "),
    })).filter(p => p.d);

    const near = PROJECTS.filter(p =>
      p.id !== project.id && p.lat != null && p.lng != null &&
      p.lng >= minLng && p.lng <= maxLng && p.lat >= minLat && p.lat <= maxLat
    ) as (Project & { lat: number; lng: number })[];

    // Scale bar: a round number of metres that fits comfortably in the frame.
    const perPx = spanMetres / width;
    const bar = [100, 200, 250, 500, 1000].reverse().find(m => m / perPx <= width * 0.35) ?? 100;

    return { x, y, paths, near, barM: bar, barPx: bar / perPx };
  }, [project, spanMetres, width, height]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto block"
      role="img" aria-label={`Map of the area around ${project.id}`}>
      <rect width={width} height={height} fill={BASEMAP.surface} />
      {view.paths.map(p => (
        <path key={p.name} d={p.d} fill={BASEMAP.otherFill} stroke={BASEMAP.stroke}
          strokeWidth={0.8} strokeOpacity={0.5} />
      ))}

      {/* Other contracts in frame — context, drawn quietly. */}
      {view.near.map(p => (
        <circle key={p.id} cx={view.x(p.lng)} cy={view.y(p.lat)} r={3.5}
          fill={colorOf(p, enc)} stroke={BASEMAP.surface} strokeWidth={1.5}
          opacity={0.75} style={{ cursor: onPick ? "pointer" : "default" }}
          onClick={() => onPick?.(p.id)}>
          <title>{p.id} · {p.municipality}</title>
        </circle>
      ))}

      {/* This project. Ring first so it stays findable in a dense cluster. */}
      <circle cx={view.x(project.lng)} cy={view.y(project.lat)} r={13}
        fill="none" stroke={colorOf(project, enc)} strokeWidth={1.5} opacity={0.4} />
      <circle cx={view.x(project.lng)} cy={view.y(project.lat)} r={6}
        fill={colorOf(project, enc)} stroke="#fff" strokeWidth={2.5} />

      <g transform={`translate(12,${height - 14})`}>
        <rect x={-4} y={-11} width={view.barPx + 8} height={17} rx={3} fill="#fff" opacity={0.85} />
        <line x1={0} y1={0} x2={view.barPx} y2={0} stroke={BASEMAP.label} strokeWidth={1.5} />
        <line x1={0} y1={-3} x2={0} y2={3} stroke={BASEMAP.label} strokeWidth={1.5} />
        <line x1={view.barPx} y1={-3} x2={view.barPx} y2={3} stroke={BASEMAP.label} strokeWidth={1.5} />
        <text x={view.barPx / 2} y={-4} textAnchor="middle" fontSize={8}
          fill={BASEMAP.label} fontFamily="DM Mono, monospace">{view.barM} m</text>
      </g>
    </svg>
  );
}
