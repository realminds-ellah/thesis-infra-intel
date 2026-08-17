/**
 * Ground level — what the structure looks like from beside it.
 *
 * A sky view answers "is something there". It is bad at "is it any good": a
 * revetment that is cracked, undermined or half its designed height reads as an
 * intact grey line from orbit and reads as a problem instantly from the bank.
 *
 * WHY MAPILLARY AND NOT GOOGLE
 *
 * Google was the obvious choice and it is ruled out by one requirement: no
 * billing. Every Maps Platform API key — including the Embed API, whose basic
 * usage is not charged — has to sit on a project with billing enabled. There is
 * no free-standing free tier to opt into, and a public static site would in any
 * case be shipping a spendable credential to every visitor.
 *
 * Mapillary needs a token and does not need billing. It is also the better fit
 * on the merits, for three reasons that have nothing to do with cost:
 *
 *  - ITS IMAGERY IS DATED. Every image carries a capture time, so the years can
 *    be listed and compared — which is the whole point of the request. Google's
 *    "see more dates" slider is a feature of the Maps interface and is exposed
 *    by no API, so even a billed key could not rebuild it here.
 *  - IT IS OPENLY LICENSED. CC BY-SA, so a frame can be cited in a thesis
 *    rather than merely linked to.
 *  - ANYONE CAN ADD TO IT. That matters more than the coverage it has today.
 *    An inspector walking a bank with Mapillary recording creates the dated
 *    ground-level series that does not otherwise exist for these sites, and it
 *    stays public instead of living in one browser. It is the only route here
 *    by which the imagery gap gets closed rather than worked around.
 *
 * WITHOUT A TOKEN THIS DEGRADES TO LINKS, DELIBERATELY
 *
 * `VITE_MAPILLARY_TOKEN` is optional. Absent, the component shows the same
 * out-links it always did plus one line on how to enable the viewer — no broken
 * frame, no dead spinner, no pretending. The token is a read-only client token
 * and is safe in a public bundle; that is what Mapillary issues it for.
 *
 * COVERAGE IS UNKNOWN AND THE PANEL SAYS SO. These sites are riverbanks and
 * street-level imagery follows roads. "No ground photographs of this site" is
 * itself a finding, and is reported as one rather than as an error.
 */

import { useEffect, useState } from "react";
import { Footprints, ExternalLink, Camera, ChevronLeft, ChevronRight } from "lucide-react";

const TOKEN = (import.meta.env?.VITE_MAPILLARY_TOKEN ?? "") as string;

interface Frame { id: string; captured: number; }

/** Metres → degrees, near enough at this latitude for a search box. */
const boxAround = (lat: number, lng: number, m: number) => {
  const dLat = m / 111_320;
  const dLng = m / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat].map(v => v.toFixed(6)).join(",");
};

const year = (ms: number) => new Date(ms).getFullYear();
const fullDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function StreetLevel({ lat, lng, compact = false }: {
  lat: number; lng: number; compact?: boolean;
}) {
  const [frames, setFrames] = useState<Frame[] | null>(null);
  const [i, setI] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!TOKEN || compact) return;
    let dead = false;
    setFrames(null); setErr(null); setI(0);
    const url = `https://graph.mapillary.com/images?access_token=${TOKEN}`
      + `&fields=id,captured_at&bbox=${boxAround(lat, lng, 120)}&limit=50`;
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(j => {
        if (dead) return;
        const got: Frame[] = (j.data ?? [])
          .filter((d: { captured_at?: number }) => d.captured_at)
          .map((d: { id: string; captured_at: number }) => ({ id: d.id, captured: d.captured_at }))
          // Oldest first, so stepping right moves forward in time like the
          // satellite strip does. One image per capture day is plenty; a
          // sequence can hold hundreds of near-identical frames.
          .sort((a: Frame, b: Frame) => a.captured - b.captured);
        const seen = new Set<string>();
        const daily = got.filter(f => {
          const k = new Date(f.captured).toISOString().slice(0, 10);
          if (seen.has(k)) return false;
          seen.add(k); return true;
        });
        setFrames(daily);
        setI(Math.max(0, daily.length - 1));
      })
      .catch(e => { if (!dead) setErr(String(e.message ?? e)); });
    return () => { dead = true; };
  }, [lat, lng, compact]);

  const links = [
    {
      label: "Mapillary",
      note: "Openly licensed street-level imagery with capture dates. Anyone can add to it from a phone.",
      href: `https://www.mapillary.com/app/?lat=${lat}&lng=${lng}&z=18`,
    },
    {
      label: "Google Street View",
      note: "Opens at the nearest panorama looking toward this point. Where Google has driven it more than once, its own “see more dates” slider compares the years — that lives in Google's viewer and is exposed by no API.",
      href: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`,
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

  const cur = frames && frames.length ? frames[Math.min(i, frames.length - 1)] : null;

  return (
    <div className="rounded border border-gray-200 overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-1.5">
        <Footprints size={12} className="text-[#1e3a7b]" />
        <span className="text-[12px] font-bold text-gray-700">From the ground</span>
        {cur && <span className="ml-auto text-[10px] font-mono text-gray-400">
          {frames!.length} {frames!.length === 1 ? "capture" : "captures"}
        </span>}
      </div>

      <div className="p-3 space-y-2">
        <p className="text-[11px] text-gray-600 leading-relaxed">
          A sky view can say whether something is there. Whether it is cracked, undermined or half
          the height it should be is a question for eye level.
        </p>

        {/* ── the viewer, when a token is configured ───────────────────── */}
        {TOKEN && cur && (
          <>
            <div className="rounded overflow-hidden border border-gray-200 bg-gray-900" style={{ height: 220 }}>
              <iframe key={cur.id} title={`Ground-level view, ${fullDate(cur.captured)}`}
                src={`https://www.mapillary.com/embed?image_key=${cur.id}&style=photo`}
                style={{ width: "100%", height: "100%", border: 0 }} loading="lazy" />
            </div>
            {/* One stop per capture date. This is the year-by-year comparison —
                the same spot, photographed from the road, on known dates. */}
            <div className="flex items-center gap-2">
              <button onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} aria-label="Earlier capture"
                className="p-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30">
                <ChevronLeft size={13} />
              </button>
              <div className="flex-1 flex items-center gap-1">
                {frames!.map((f, n) => (
                  <button key={f.id} onClick={() => setI(n)} title={fullDate(f.captured)} className="flex-1 group">
                    <div className="rounded-full transition-all"
                      style={{ height: n === i ? 8 : 5, background: n === i ? "#1e3a7b" : "#cbd5e1" }} />
                    <div className={`text-[9px] mt-0.5 ${n === i ? "font-semibold text-gray-700" : "text-gray-400"}`}>
                      {year(f.captured)}
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => setI(Math.min(frames!.length - 1, i + 1))}
                disabled={i >= frames!.length - 1} aria-label="Later capture"
                className="p-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30">
                <ChevronRight size={13} />
              </button>
            </div>
            <p className="text-[10px] text-gray-400">
              {fullDate(cur.captured)} · Mapillary, CC BY-SA · within 120 m of the published coordinate
            </p>
          </>
        )}

        {/* ── nothing there, which is an answer ────────────────────────── */}
        {TOKEN && frames && frames.length === 0 && (
          <div className="rounded border border-gray-200 px-2.5 py-3 text-[11px] text-gray-600 leading-relaxed">
            <strong className="text-gray-700">No ground photographs of this site.</strong> Nobody has
            driven or walked within 120 m of this coordinate with a camera running. That is common
            here — these are riverbanks and street-level imagery follows roads — and it is a gap that
            can be filled: anyone can record a Mapillary sequence from a phone.
          </div>
        )}

        {TOKEN && !frames && !err && (
          <div className="text-[11px] text-gray-400 py-2">Looking for ground photographs…</div>
        )}
        {TOKEN && err && (
          <div className="text-[11px] text-gray-500 py-1">
            Could not reach Mapillary ({err}). The links below still work.
          </div>
        )}

        {/* ── links, always ────────────────────────────────────────────── */}
        {links.map(l => (
          <a key={l.label} href={l.href} target="_blank" rel="noreferrer"
            className="block rounded border border-gray-200 px-2.5 py-2 hover:border-[#1e3a7b]/40">
            <div className="text-[12px] font-semibold text-[#1e3a7b] flex items-center gap-1">
              {l.label}<ExternalLink size={10} />
            </div>
            <p className="text-[10px] text-gray-500 leading-snug mt-0.5">{l.note}</p>
          </a>
        ))}

        {!TOKEN && (
          <div className="rounded border border-gray-200 px-2.5 py-2 text-[10px] text-gray-500 leading-relaxed">
            <span className="flex items-center gap-1 text-gray-600 font-semibold mb-0.5">
              <Camera size={10} />The dated viewer is switched off
            </span>
            Add a free Mapillary token as <code className="font-mono">VITE_MAPILLARY_TOKEN</code> and the
            ground-level captures appear here with a year-by-year stepper. No billing account is
            involved — see <code className="font-mono">masid/README.md</code>.
          </div>
        )}
      </div>
    </div>
  );
}
