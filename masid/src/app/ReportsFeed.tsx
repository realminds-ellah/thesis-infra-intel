/**
 * Citizen reports, as a feed.
 *
 * Reports are only worth anything if someone can tell a real one from a made-up
 * one, so two things sit at the centre of this:
 *
 *  1. LIVE CAPTURE ONLY. The camera opens in the page and a frame is taken from
 *     the live stream. There is no file picker, so a photo saved from somewhere
 *     else cannot be attached. Each capture records the time it was taken and,
 *     if permitted, the device's own GPS fix — which is then compared against
 *     the coordinate DPWH published for that contract.
 *
 *     Being straight about the limit: this raises the bar, it does not close the
 *     door. A determined person can feed a virtual camera device. It stops the
 *     easy case — someone attaching an old or borrowed photo — and nothing more.
 *     Anything that matters still needs a human to verify it.
 *
 *  2. "MASID" VOTES. Readers mark reports they judge worth attention, and the
 *     feed can sort by it.
 *
 *     Also being straight: votes measure attention, not truth. A well-shared
 *     wrong report outranks an accurate one nobody saw, and any public vote can
 *     be brigaded. The count is shown as what it is — how many people looked and
 *     agreed — never as a verification status.
 *
 * PROTOTYPE. There is no server. Reports live in this browser's localStorage and
 * go nowhere. A real deployment needs submission, moderation, an audit trail and
 * a takedown route, none of which exist here — and the banner says so rather
 * than letting anyone believe they have filed something.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera, X, Eye, Clock, MapPin, AlertTriangle, Video, Loader2, Search,
} from "lucide-react";

import { PROJECTS, type Project } from "./data";

const KEY = "masid.reports.v1";

export interface CitizenReport {
  id: string;
  projectId: string;
  note: string;
  image: string;             // data URL, captured in-page
  capturedAt: number;
  lat: number | null;        // the device's own fix at capture time
  lng: number | null;
  metresFromContract: number | null;
  masid: number;
}

const load = (): CitizenReport[] => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
};
const save = (r: CitizenReport[]) => localStorage.setItem(KEY, JSON.stringify(r));

const metres = (a: [number, number], b: [number, number]) => {
  const R = 6371000, t = Math.PI / 180;
  const dLat = (b[0] - a[0]) * t, dLng = (b[1] - a[1]) * t;
  const q = Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(q)));
};

const ago = (t: number) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};

/** Camera sheet — live stream in, single frame out. No file input anywhere. */
function CaptureSheet({ onClose, onDone }:
  { onClose: () => void; onDone: (r: CitizenReport) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [fix, setFix] = useState<[number, number] | null>(null);
  const [projectId, setProjectId] = useState("");
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live: MediaStream | null = null;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(s => { live = s; setStream(s); if (videoRef.current) videoRef.current.srcObject = s; })
      .catch(() => setErr("The camera could not be opened. Reports must be taken live, so there is no way to attach an existing photo."));
    navigator.geolocation?.getCurrentPosition(
      p => setFix([p.coords.latitude, p.coords.longitude]), () => setFix(null),
      { enableHighAccuracy: true, timeout: 8000 });
    return () => { live?.getTracks().forEach(t => t.stop()); };
  }, []);

  const capture = () => {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth || 720; c.height = v.videoHeight || 540;
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    setShot(c.toDataURL("image/jpeg", 0.8));
    stream?.getTracks().forEach(t => t.stop());
  };

  const matches = useMemo(() => {
    if (!q) return [];
    const t = q.toLowerCase();
    return PROJECTS.filter(p => `${p.id} ${p.municipality} ${p.description}`.toLowerCase().includes(t)).slice(0, 6);
  }, [q]);
  const chosen = PROJECTS.find(p => p.id === projectId) ?? null;

  const submit = () => {
    if (!shot || !chosen) return;
    setBusy(true);
    const d = fix && chosen.lat != null && chosen.lng != null
      ? metres(fix, [chosen.lat, chosen.lng]) : null;
    onDone({
      id: `r${Date.now()}`, projectId: chosen.id, note: note.trim(), image: shot,
      capturedAt: Date.now(), lat: fix?.[0] ?? null, lng: fix?.[1] ?? null,
      metresFromContract: d, masid: 0,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6" style={{ zIndex: 2000 }}>
      <div className="bg-white rounded-lg shadow-2xl w-full flex flex-col" style={{ maxWidth: 520, maxHeight: "90vh" }}>
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
          <Camera size={15} style={{ color: "#1e3a7b" }} />
          <span className="text-[13px] font-bold text-gray-900">Report from the site</span>
          <button onClick={onClose} className="ml-auto p-1 text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3" style={{ scrollbarWidth: "none" }}>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            The photo has to be taken here and now — the camera opens in the page and there is no
            option to attach an existing file. That stops the easy case; it is not proof, and a
            report still has to be checked by a person.
          </p>

          <div className="rounded overflow-hidden bg-gray-900 relative" style={{ aspectRatio: "4/3" }}>
            {err ? (
              <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-[12px] text-white/80">{err}</div>
            ) : shot ? (
              <img src={shot} alt="Captured" className="w-full h-full object-cover" />
            ) : (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            )}
            {!shot && !err && (
              <button onClick={capture} aria-label="Take the photo"
                className="absolute bottom-3 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-white border-4 border-white/60 shadow-lg" />
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span className="flex items-center gap-1"><Clock size={11} />{shot ? new Date().toLocaleTimeString() : "not taken yet"}</span>
            <span className="flex items-center gap-1"><MapPin size={11} />
              {fix ? `${fix[0].toFixed(5)}, ${fix[1].toFixed(5)}` : "no location fix"}</span>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Which project?</label>
            {chosen ? (
              <div className="flex items-start gap-2 p-2.5 rounded border border-gray-200 bg-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-mono text-gray-500">{chosen.id}</div>
                  <div className="text-[12px] text-gray-800 leading-tight">{chosen.description.slice(0, 80)}…</div>
                  {chosen.lat != null && fix && (
                    <div className="text-[11px] mt-1" style={{ color: metres(fix, [chosen.lat, chosen.lng!]) > 300 ? "#c0272d" : "#046b04" }}>
                      You are {metres(fix, [chosen.lat, chosen.lng!]).toLocaleString()} m from the published coordinate
                    </div>
                  )}
                </div>
                <button onClick={() => { setProjectId(""); setQ(""); }} className="text-gray-400"><X size={13} /></button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="Contract ID or place…"
                    className="w-full pl-7 pr-3 py-1.5 text-[12px] border border-gray-200 rounded bg-gray-50 focus:outline-none focus:border-[#1e3a7b]" />
                </div>
                {matches.map(m => (
                  <button key={m.id} onClick={() => { setProjectId(m.id); setQ(""); }}
                    className="w-full text-left px-2.5 py-2 mt-1 rounded border border-gray-100 hover:bg-gray-50">
                    <span className="text-[11px] font-mono text-gray-500">{m.id}</span>
                    <span className="block text-[11px] text-gray-700">{m.municipality} · {m.description.slice(0, 50)}…</span>
                  </button>
                ))}
              </>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">What did you see?</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              placeholder="Describe what is there, or what is missing."
              className="w-full px-2.5 py-2 text-[12px] border border-gray-200 rounded bg-gray-50 focus:outline-none focus:border-[#1e3a7b]" />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100">
          <button onClick={submit} disabled={!shot || !chosen || busy}
            className="w-full py-2.5 rounded text-[13px] font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: "#1e3a7b" }}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            Post report
          </button>
          <p className="text-[10px] text-gray-400 text-center mt-2">
            Prototype — this stays in your browser and is not sent anywhere.
          </p>
        </div>
      </div>
    </div>
  );
}

export function ReportsFeed({ onOpenProject }: { onOpenProject: (id: string) => void }) {
  const [reports, setReports] = useState<CitizenReport[]>(load);
  const [sort, setSort] = useState<"new" | "masid">("new");
  const [capturing, setCapturing] = useState(false);
  const [voted, setVoted] = useState<Set<string>>(new Set());

  useEffect(() => save(reports), [reports]);

  const sorted = useMemo(() => [...reports].sort(
    sort === "new" ? (a, b) => b.capturedAt - a.capturedAt : (a, b) => b.masid - a.masid
  ), [reports, sort]);

  const vote = (id: string) => {
    if (voted.has(id)) return;
    setVoted(new Set(voted).add(id));
    setReports(reports.map(r => r.id === id ? { ...r, masid: r.masid + 1 } : r));
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50" style={{ scrollbarWidth: "none" }}>
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Reports from the ground</h1>
            <p className="text-[13px] text-gray-500">What people can see that the paperwork does not say</p>
          </div>
          <button onClick={() => setCapturing(true)}
            className="ml-auto flex items-center gap-1.5 px-3.5 py-2 rounded text-[13px] font-semibold text-white hover:opacity-90"
            style={{ background: "#1e3a7b" }}>
            <Camera size={14} />Report from the site
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <div className="rounded border p-3.5" style={{ background: "#fef9e7", borderColor: "#f7c94855" }}>
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: "#b45309" }} />
            <div className="text-[11px] text-gray-700 leading-relaxed">
              <strong>Prototype.</strong> Reports are held in this browser and sent nowhere. Photos must be
              taken live — there is no way to attach an existing file — which stops the easy case but is not
              proof, since a virtual camera can defeat it. <strong>Masid counts measure attention, not
              truth</strong>: a widely shared wrong report will outrank an accurate one nobody saw. A real
              deployment needs submission, moderation, an audit trail and a takedown route. None of that is
              here.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400">Sort</span>
          {([["new", "Newest"], ["masid", "Most masid"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setSort(k)}
              className={`text-[12px] px-2.5 py-1 rounded-full border ${sort === k
                ? "border-[#1e3a7b] bg-[#1e3a7b] text-white" : "border-gray-200 text-gray-600 hover:bg-white"}`}>{l}</button>
          ))}
          <span className="ml-auto text-[11px] text-gray-400">{reports.length} report{reports.length === 1 ? "" : "s"}</span>
        </div>

        {sorted.length === 0 && (
          <div className="bg-white rounded border border-gray-200 py-14 text-center">
            <Video size={26} className="text-gray-300 mx-auto mb-2" />
            <div className="text-[13px] font-semibold text-gray-600">No reports yet</div>
            <p className="text-[12px] text-gray-400 mt-1 max-w-xs mx-auto">
              Stand at a flood-control site, open the camera, and say what is there.
            </p>
          </div>
        )}

        {sorted.map(r => {
          const p: Project | undefined = PROJECTS.find(x => x.id === r.projectId);
          const far = r.metresFromContract != null && r.metresFromContract > 300;
          return (
            <article key={r.id} className="bg-white rounded border border-gray-200 overflow-hidden flex">
              {/* Vote rail, Reddit-style: the count is the point, not a score. */}
              <div className="w-14 shrink-0 bg-gray-50 flex flex-col items-center pt-3 gap-1 border-r border-gray-100">
                <button onClick={() => vote(r.id)} disabled={voted.has(r.id)}
                  title="Mark this as worth attention" aria-label="Masid"
                  className={`p-1.5 rounded ${voted.has(r.id) ? "text-[#1e3a7b]" : "text-gray-400 hover:text-[#1e3a7b] hover:bg-white"}`}>
                  <Eye size={17} />
                </button>
                <span className="text-[13px] font-mono font-bold text-gray-700">{r.masid}</span>
                <span className="text-[9px] text-gray-400">masid</span>
              </div>

              <div className="flex-1 min-w-0">
                <img src={r.image} alt="" className="w-full object-cover" style={{ maxHeight: 320 }} />
                <div className="p-4">
                  {r.note && <p className="text-[13px] text-gray-800 leading-relaxed mb-2.5">{r.note}</p>}
                  {p && (
                    <button onClick={() => onOpenProject(p.id)}
                      className="text-left w-full rounded border border-gray-100 px-3 py-2 hover:border-[#1e3a7b]/30 hover:bg-blue-50/30 mb-2.5">
                      <div className="text-[10px] font-mono text-gray-400">{p.id}</div>
                      <div className="text-[12px] text-gray-700 leading-tight">{p.description.slice(0, 80)}…</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{p.municipality} · {p.dpwhStatus}</div>
                    </button>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-gray-400 flex-wrap">
                    <span className="flex items-center gap-1"><Clock size={10} />{ago(r.capturedAt)}</span>
                    {r.metresFromContract != null && (
                      <span className="flex items-center gap-1" style={{ color: far ? "#c0272d" : "#046b04" }}>
                        <MapPin size={10} />
                        {far
                          ? `taken ${r.metresFromContract.toLocaleString()} m from the published coordinate`
                          : `taken ${r.metresFromContract} m from the published coordinate`}
                      </span>
                    )}
                    {r.lat == null && <span className="flex items-center gap-1"><MapPin size={10} />no location fix — unverified</span>}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {capturing && (
        <CaptureSheet onClose={() => setCapturing(false)}
          onDone={r => { setReports([r, ...reports]); setCapturing(false); }} />
      )}
    </div>
  );
}
