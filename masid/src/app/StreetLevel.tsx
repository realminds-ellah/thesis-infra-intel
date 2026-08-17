/**
 * Ground level — what the structure looks like from beside it.
 *
 * A sky view answers "is something there". It is bad at "is it any good": a
 * revetment that is cracked, undermined or half the height it should be reads
 * as an intact grey line from 400 km up, and reads as a problem instantly from
 * the bank. So a ground-level view is worth more per photograph than anything
 * above it for the question this project actually asks.
 *
 * WHY THIS IS LINKS AND NOT AN EMBEDDED VIEWER
 *
 * Three limits, all of them real, none of them a shortcut:
 *
 *  1. HISTORICAL STREET VIEW IS NOT EXPOSED BY ANY API. Google's "see more
 *     dates" time slider is a feature of the Maps interface, not of the Maps
 *     Platform. `StreetViewService` returns the CURRENT panorama and its
 *     `imageDate`, and there is no documented way to enumerate the older ones.
 *     A year-by-year comparison therefore cannot be built inside this app — it
 *     can only be handed to the viewer that already has it. That is exactly
 *     what these links do, and it is the honest shape of the feature.
 *  2. EMBEDDING NEEDS A BILLED KEY. Maps Embed and Street View Static both
 *     require an API key on a billing-enabled account. Putting one in a public
 *     static site means shipping a spendable credential to every visitor. A
 *     link costs nothing and leaks nothing.
 *  3. COVERAGE IS THE REAL CONSTRAINT AND IS UNKNOWN. Flood control sits on
 *     riverbanks; Street View follows roads. Many of these sites will have no
 *     panorama at any date, and that cannot be measured without a key — so the
 *     panel says the coverage is unknown rather than implying it is there.
 *
 * MAPILLARY IS HERE FOR A REASON BEYOND REDUNDANCY
 *
 * It is openly licensed (CC BY-SA), its sequences carry capture dates, and
 * anyone can ADD to it from a phone. That last part matters more than the
 * coverage it has today: an inspector walking a bank with Mapillary recording
 * creates the dated ground-level series that does not otherwise exist for these
 * sites, and it stays public rather than living in this browser. It is the one
 * route on this screen by which the imagery gap can actually be closed rather
 * than worked around.
 */

import { Footprints, ExternalLink } from "lucide-react";

export function StreetLevel({ lat, lng, compact = false }: {
  lat: number; lng: number; compact?: boolean;
}) {
  const links = [
    {
      label: "Google Street View",
      note: "Opens at the nearest panorama looking toward this point. Where Google has flown it more than once, its own “see more dates” slider compares the years — that time travel lives in Google's viewer and cannot be rebuilt here.",
      href: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`,
    },
    {
      label: "Mapillary",
      note: "Openly licensed street-level imagery with capture dates, and the one source on this list anyone can add to from a phone.",
      href: `https://www.mapillary.com/app/?lat=${lat}&lng=${lng}&z=18`,
    },
  ];

  if (compact) {
    return (
      <span className="flex items-center gap-3 flex-wrap">
        {links.map(l => (
          <a key={l.label} href={l.href} target="_blank" rel="noreferrer" title={l.note}
            className="text-[11px] text-[#1e3a7b] hover:underline flex items-center gap-1">
            {l.label}<ExternalLink size={9} />
          </a>
        ))}
      </span>
    );
  }

  return (
    <div className="rounded border border-gray-200 overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-1.5">
        <Footprints size={12} className="text-[#1e3a7b]" />
        <span className="text-[12px] font-bold text-gray-700">From the ground</span>
      </div>
      <div className="p-3 space-y-2">
        <p className="text-[11px] text-gray-600 leading-relaxed">
          A sky view can say whether something is there. Whether it is cracked, undermined or half the
          height it should be is a question for eye level.
        </p>
        {links.map(l => (
          <a key={l.label} href={l.href} target="_blank" rel="noreferrer"
            className="block rounded border border-gray-200 px-2.5 py-2 hover:border-[#1e3a7b]/40">
            <div className="text-[12px] font-semibold text-[#1e3a7b] flex items-center gap-1">
              {l.label}<ExternalLink size={10} />
            </div>
            <p className="text-[10px] text-gray-500 leading-snug mt-0.5">{l.note}</p>
          </a>
        ))}
        <p className="text-[10px] text-gray-400 leading-relaxed">
          Coverage is unknown and likely patchy: these sites are riverbanks and street-level imagery
          follows roads. A link that opens on an empty road is itself an answer — nobody has
          photographed this site from the ground.
        </p>
      </div>
    </div>
  );
}
