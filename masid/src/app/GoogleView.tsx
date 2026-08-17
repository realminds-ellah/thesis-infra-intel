/**
 * Google Maps, embedded, with no API key and no billing account.
 *
 * HOW THIS IS POSSIBLE WHEN THE REST OF GOOGLE MAPS IS NOT
 *
 * Maps Platform — the Embed API, Street View Static, the JavaScript SDK — all
 * require a key on a billing-enabled project, which is why the dated
 * ground-level viewer on this screen runs on Mapillary instead.
 *
 * The CLASSIC embed is a different thing and predates all of that:
 * `maps.google.com/maps?q=…&output=embed` returns an ordinary iframe document
 * with no key, no quota to sign up for and nothing to bill. It gives Google's
 * own map with Google's own controls — the satellite toggle, the pegman, zoom,
 * and a route out to full Maps — which is exactly the "easier access" this is
 * for. `output=svembed` does the same for Street View.
 *
 * WHY BOTH THIS AND THE ESRI MAP ABOVE IT
 *
 * They are not redundant. The Esri panel is the one this project measures
 * against: it is the same basemap the Wayback strip steps through, so what you
 * see there is what the dated comparison is comparing. Google's is the one
 * people already know how to use, is often flown on a different date, and
 * carries the pegman — one drag and you are standing on the road beside the
 * site. Two independent sources over the same coordinate is also a check in
 * itself: where they disagree about what is on the ground, that is worth
 * noticing.
 *
 * WHAT IT CANNOT DO, STATED WHERE IT IS ASKED
 *
 * There is no month-by-month view here and none is possible. Google's historical
 * imagery slider lives in Google Earth and in the Street View interface, is
 * exposed by no API, and cannot be driven from an embed. The dated comparisons
 * this project can offer are the two already on this screen: the sky strip
 * above, six flights in sixteen years, and the ground strip below, whatever
 * Mapillary holds. The panel says so rather than leaving someone hunting for a
 * control that does not exist.
 */

import { useState } from "react";
import { ExternalLink, Navigation, Map as MapIcon, PersonStanding, History } from "lucide-react";

type Mode = "map" | "street";

export function GoogleView({ lat, lng, label }: { lat: number; lng: number; label?: string }) {
  const [mode, setMode] = useState<Mode>("map");

  const src = mode === "map"
    ? `https://maps.google.com/maps?q=${lat},${lng}&z=18&hl=en&output=embed`
    : `https://maps.google.com/maps?q=${lat},${lng}&layer=c&cbll=${lat},${lng}&cbp=12,0,0,0,0&hl=en&output=svembed`;

  const out = mode === "street"
    ? [
        // The one control people are looking for. It exists — in Google's own
        // Street View interface, as the clock pill beside the location name —
        // and it is reachable in one click from here even though it can never
        // be rendered inside this iframe.
        { label: "See other dates", icon: <History size={11} />, primary: true,
          href: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}` },
        { label: "Directions", icon: <Navigation size={11} />,
          href: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` },
      ]
    : [
        { label: "Open in Google Maps", icon: <ExternalLink size={11} />,
          href: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` },
        { label: "Directions", icon: <Navigation size={11} />,
          href: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` },
      ];

  return (
    <div className="bg-white rounded border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2 flex-wrap">
        <MapIcon size={13} className="text-[#1e3a7b]" />
        <span className="text-[12px] font-bold text-gray-700">On Google Maps</span>
        <span className="text-[11px] text-gray-400">a second source, and the pegman</span>

        <div className="ml-auto flex items-center gap-0.5 p-0.5 rounded border border-gray-200">
          {([["map", "Map", <MapIcon size={11} key="m" />],
             ["street", "Street View", <PersonStanding size={11} key="s" />]] as const).map(([m, t, ic]) => (
            <button key={m} onClick={() => setMode(m as Mode)}
              aria-pressed={mode === m}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${
                mode === m ? "bg-[#1e3a7b] text-white" : "text-gray-600 hover:bg-gray-50"}`}>
              {ic}{t}
            </button>
          ))}
        </div>
      </div>

      {/* No key, no quota, nothing to bill — the classic embed endpoint. */}
      <iframe
        key={`${mode}-${lat}-${lng}`}
        title={`Google ${mode === "map" ? "map" : "Street View"} at ${lat.toFixed(5)}, ${lng.toFixed(5)}${label ? ` — ${label}` : ""}`}
        src={src}
        style={{ width: "100%", height: 340, border: 0 }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen />

      <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-3 flex-wrap">
        {out.map(o => (
          <a key={o.label} href={o.href} target="_blank" rel="noreferrer"
            className={("primary" in o && o.primary)
              ? "text-[11px] font-semibold px-2.5 py-1.5 rounded text-white flex items-center gap-1.5 hover:opacity-90"
              : "text-[11px] text-[#1e3a7b] hover:underline flex items-center gap-1"}
            style={("primary" in o && o.primary) ? { background: "var(--masid-navy)" } : undefined}>
            {o.icon}{o.label}
          </a>
        ))}
        <span className="ml-auto text-[10px] text-gray-400 leading-snug" style={{ maxWidth: 400 }}>
          {mode === "street"
            ? "Google keeps older passes of this road, but the date control only exists in its own viewer — no API exposes it, so it cannot be drawn in this frame. \u201cSee other dates\u201d opens it there."
            : "Google publishes no month-by-month view that can be embedded. The dated comparisons here are the sky strip above and the ground strip below."}
        </span>
      </div>
    </div>
  );
}
