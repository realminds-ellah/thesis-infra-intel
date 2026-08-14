/**
 * Where a coordinate is, answered without asking anybody.
 *
 * A report that says "14.81240, 120.71600" is unreadable to the person filing
 * it and to the person reading it. A report that says "Hagonoy" can be checked
 * against the contract in one glance.
 *
 * This resolves the name LOCALLY, by point-in-polygon against the 24 municipal
 * boundaries the app already ships — the same geoBoundaries PHL ADM3 set the
 * pipeline used to check every published coordinate. That matters for three
 * reasons beyond speed:
 *
 *  1. NOTHING LEAVES THE DEVICE. Handing a citizen's live GPS fix to Google or
 *     Nominatim to get a place name would mean this tool quietly reporting the
 *     locations of the people using it to a third party. For a tool whose users
 *     may be photographing contracts belonging to powerful people, that is not
 *     a small thing.
 *  2. IT WORKS WITH NO SIGNAL. Flood control sites are riverbanks. A geocoder
 *     that needs a network answers nothing at the exact moment it is needed.
 *  3. IT IS THE SAME ANSWER THE AUDIT USES. The coordinate checks in the
 *     pipeline are computed against these very polygons, so a report saying
 *     "you are in Calumpit" and a flag saying "this coordinate is in Calumpit"
 *     can never disagree by using different maps.
 *
 * The limit, stated plainly: this resolves to MUNICIPALITY and no finer. There
 * is no barangay layer in the shipped data, so it will not tell you which
 * barangay you are standing in.
 */

import { BOUNDARIES } from "./data";

/**
 * Even-odd ray casting.
 *
 * Counted across every ring of a municipality rather than per ring, so an
 * enclave sitting inside another polygon cancels out correctly instead of
 * reporting both. Rings are [lng, lat] — the GeoJSON order, not the spoken one.
 */
function inRings(rings: number[][][], lat: number, lng: number): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) &&
          lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
  }
  return inside;
}

/** Cheap reject before the expensive test: most points miss most polygons. */
const boxes = BOUNDARIES.map(b => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ring of b.rings) for (const [x, y] of ring) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { b, minX, minY, maxX, maxY };
});

/**
 * The municipality containing a point, or null when it is outside all of them.
 *
 * Null is a real answer and is shown as one. Bulacan's boundary is where this
 * district office's remit stops, and a report taken outside it is not an error
 * to be papered over with the nearest name — it is a fact about the report.
 */
export function municipalityAt(lat: number, lng: number): string | null {
  for (const { b, minX, minY, maxX, maxY } of boxes) {
    if (lng < minX || lng > maxX || lat < minY || lat > maxY) continue;
    if (inRings(b.rings, lat, lng)) return b.name;
  }
  return null;
}

/** Metres between two coordinates, equirectangular — exact enough under 50 km. */
export function metresBetween(a: [number, number], b: [number, number]): number {
  const R = 6371000, t = Math.PI / 180;
  const dLat = (b[0] - a[0]) * t, dLng = (b[1] - a[1]) * t;
  const x = dLng * Math.cos(((a[0] + b[0]) / 2) * t);
  return Math.round(Math.sqrt(dLat * dLat + x * x) * R);
}
