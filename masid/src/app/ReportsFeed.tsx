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
  MessageSquare, CornerDownRight, Link2, Send,
} from "lucide-react";

import { PROJECTS, PROC_BY_ID, type Project } from "./data";

const KEY = "masid.reports.v1";

/**
 * How the feed can be ordered.
 *
 * Only one of these is a measurement. "Furthest from the coordinate" ranks by
 * the gap between where the reporter's device says they stood and where DPWH
 * says the project is — a number neither party chose, and the most useful thing
 * this feed produces. A report taken 3 km from the published point is worth
 * looking at whether or not anybody upvoted it.
 *
 * Masid and comment counts measure attention. They are offered because people
 * expect them, and labelled so nobody mistakes a busy thread for a verified one.
 */
export type SortKey = "new" | "masid" | "discussed" | "distance" | "value";

const SORTS: { key: SortKey; label: string; hint: string }[] = [
  { key: "new", label: "Newest", hint: "Most recently captured first" },
  { key: "distance", label: "Furthest from the coordinate",
    hint: "Ranked by the gap between where the photo was taken and where DPWH says the project is — the one ordering here backed by a measurement rather than by opinion" },
  { key: "masid", label: "Most masid", hint: "Most marked as worth attention. Measures attention, not accuracy" },
  { key: "discussed", label: "Most discussed", hint: "Most comments. Also attention, not accuracy" },
  { key: "value", label: "Biggest contract", hint: "Largest awarded amount of the contract reported on" },
];

export interface Comment {
  id: string;
  author: string;          // the role the commenter was signed in as
  text: string;
  at: number;
  masid: number;
  replyTo?: string;        // one level deep; threads beyond that stop being read
  demo?: boolean;
}

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
  comments: Comment[];
  /** Seeded example, never a real submission. Badged wherever it appears. */
  demo?: boolean;
}

/**
 * Seeded sample reports, so the feed shows what it is for before anyone has
 * posted to it.
 *
 * Two rules held here, because these attach to REAL contracts with REAL named
 * contractors:
 *
 *  1. The photos are obvious placeholders — flat panels with the word SAMPLE
 *    across them — not fabricated site imagery. A synthetic photograph of a
 *    riverbank, attached to a named company's contract, is exactly the kind of
 *    thing this tool exists to catch. It is not going to manufacture one.
 *  2. The notes are observational and make no accusation. Every card carries a
 *    DEMO badge, and demo reports never count toward anything.
 *
 * They exist to show the range of the interaction: a report that lands on the
 * coordinate, one that lands a long way off it, one about condition.
 */
const placeholder = (label: string, tint: string) =>
  "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420">
      <rect width="640" height="420" fill="${tint}"/>
      <text x="320" y="196" text-anchor="middle" font-family="Inter,sans-serif"
        font-size="30" font-weight="700" fill="#ffffff" opacity="0.9">SAMPLE</text>
      <text x="320" y="228" text-anchor="middle" font-family="Inter,sans-serif"
        font-size="15" fill="#ffffff" opacity="0.75">${label}</text>
      <text x="320" y="256" text-anchor="middle" font-family="Inter,sans-serif"
        font-size="12" fill="#ffffff" opacity="0.6">not a real photograph</text>
    </svg>`);

const HOUR = 3600_000;
const DEMO: CitizenReport[] = [
  {
    id: "demo-1", projectId: "23CC0190", demo: true,
    note: "Walked the stretch this morning. A concrete revetment is here and looks continuous along the bank. No project billboard that I could find.",
    image: placeholder("placeholder for a site photo", "#4a6b52"),
    capturedAt: Date.now() - 5 * HOUR,
    lat: 14.81240, lng: 120.71600, metresFromContract: 42, masid: 12,
    comments: [
      { id: "c1", author: "LGU Coordinator", at: Date.now() - 4 * HOUR, masid: 3, demo: true,
        text: "Billboards get taken down after handover in a lot of these, so the absence is not unusual on its own." },
      { id: "c2", author: "Public", at: Date.now() - 2 * HOUR, masid: 1, replyTo: "c1", demo: true,
        text: "Good to know. Is there a rule on how long they have to stay up?" },
    ],
  },
  {
    id: "demo-2", projectId: "24CC0546", demo: true,
    note: "Went to the coordinate given for this one. It is a rice field. The pumping station the title describes is not at this spot — asking around, people point further up the road.",
    image: placeholder("placeholder for a site photo", "#8a7a4a"),
    capturedAt: Date.now() - 26 * HOUR,
    lat: 14.85210, lng: 120.83140, metresFromContract: 3120, masid: 47,
    comments: [
      { id: "c3", author: "Field Inspector", at: Date.now() - 20 * HOUR, masid: 9, demo: true,
        text: "This contract is already flagged in the register for the same reason — the description names Calumpit and the published point falls in Malolos. Worth checking the actual structure before concluding anything." },
      { id: "c4", author: "Public", at: Date.now() - 14 * HOUR, masid: 4, replyTo: "c3", demo: true,
        text: "So the coordinate is wrong rather than the project missing? Those are very different things." },
      { id: "c5", author: "DPWH Engineer", at: Date.now() - 9 * HOUR, masid: 6, replyTo: "c3", demo: true,
        text: "Both are possible from this alone. Needs a site visit against the chainage in the contract, not a photo of one spot." },
    ],
  },
  {
    id: "demo-3", projectId: "18CC0051", demo: true,
    note: "Section of the dike here is cracked and the edge has slumped toward the water. Same spot was worked on again in a later contract, which matches what the register says.",
    image: placeholder("placeholder for a site photo", "#6b5a4a"),
    capturedAt: Date.now() - 3 * 24 * HOUR,
    lat: 14.77230, lng: 120.75310, metresFromContract: 18, masid: 31,
    comments: [
      { id: "c6", author: "Public", at: Date.now() - 2 * 24 * HOUR, masid: 8, demo: true,
        text: "It floods along here every wet season. Whatever was built the first time did not hold." },
    ],
  },
];

const load = (): CitizenReport[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return Array.isArray(saved) && saved.length ? saved : DEMO;
  } catch { return DEMO; }
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
      metresFromContract: d, masid: 0, comments: [],
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

/**
 * The discussion under a report.
 *
 * Flat with a single level of reply, deliberately. Deeper nesting is where
 * threads stop being read, and on a register naming real contractors a long
 * argument buried four levels down is worse than no argument at all.
 *
 * The commenter's ROLE is shown rather than a username. Whether a remark comes
 * from a resident, a district engineer or a field inspector changes how it should
 * be weighed, and this app already knows which one is signed in.
 */
function Thread({ report, role, onComment, onVote }: {
  report: CitizenReport;
  role: string;
  onComment: (text: string, replyTo?: string) => void;
  onVote: (commentId: string) => void;
}) {
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const top = report.comments.filter(c => !c.replyTo);
  const repliesOf = (id: string) => report.comments.filter(c => c.replyTo === id);

  const Row = ({ c, nested }: { c: Comment; nested?: boolean }) => (
    <div className={`flex gap-2.5 ${nested ? "ml-7 mt-2" : "mt-3"}`}>
      <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
        style={{ background: nested ? "#94a3b8" : "#1e3a7b" }}>{c.author.charAt(0)}</div>
      <div className="flex-1 min-w-0">
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-gray-800">{c.author}</span>
            <span className="text-[10px] text-gray-400">{ago(c.at)}</span>
            {c.demo && <span className="text-[9px] px-1.5 rounded" style={{ background: "#fef9e7", color: "#b45309" }}>demo</span>}
          </div>
          <p className="text-[12px] text-gray-700 leading-relaxed mt-0.5">{c.text}</p>
        </div>
        <div className="flex items-center gap-3 mt-1 ml-1">
          <button onClick={() => onVote(c.id)} className="text-[10px] text-gray-400 hover:text-[#1e3a7b] flex items-center gap-1">
            <Eye size={10} />{c.masid}
          </button>
          {!nested && (
            <button onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
              className="text-[10px] text-gray-400 hover:text-[#1e3a7b] flex items-center gap-1">
              <CornerDownRight size={10} />Reply
            </button>
          )}
        </div>
        {replyTo === c.id && (
          <div className="flex gap-2 mt-2">
            <input autoFocus value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && text.trim()) { onComment(text.trim(), c.id); setText(""); setReplyTo(null); } }}
              placeholder={`Reply to ${c.author}…`}
              className="flex-1 px-2.5 py-1.5 text-[12px] border border-gray-200 rounded bg-white focus:outline-none focus:border-[#1e3a7b]" />
            <button onClick={() => { if (text.trim()) { onComment(text.trim(), c.id); setText(""); setReplyTo(null); } }}
              className="px-2.5 rounded text-white" style={{ background: "#1e3a7b" }}><Send size={12} /></button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="border-t border-gray-100 px-4 pb-4">
      {top.map(c => (
        <div key={c.id}>
          <Row c={c} />
          {repliesOf(c.id).map(r => <Row key={r.id} c={r} nested />)}
        </div>
      ))}
      {replyTo === null && (
        <div className="flex gap-2 mt-3">
          <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "#1e3a7b" }}>{role.charAt(0)}</div>
          <input value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && text.trim()) { onComment(text.trim()); setText(""); } }}
            placeholder="Add what you know about this site…"
            className="flex-1 px-3 py-1.5 text-[12px] border border-gray-200 rounded-full bg-white focus:outline-none focus:border-[#1e3a7b]" />
          <button onClick={() => { if (text.trim()) { onComment(text.trim()); setText(""); } }} disabled={!text.trim()}
            className="px-3 rounded-full text-white disabled:opacity-30" style={{ background: "#1e3a7b" }}><Send size={13} /></button>
        </div>
      )}
    </div>
  );
}

export function ReportsFeed({ onOpenProject, role = "Public" }: { onOpenProject: (id: string) => void; role?: string }) {
  const [reports, setReports] = useState<CitizenReport[]>(load);
  const [sort, setSort] = useState<SortKey>("new");
  const [capturing, setCapturing] = useState(false);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  const addComment = (reportId: string, text: string, replyTo?: string) =>
    setReports(reports.map(r => r.id === reportId ? {
      ...r, comments: [...r.comments,
        { id: `c${Date.now()}`, author: role, text, at: Date.now(), masid: 0, replyTo }],
    } : r));

  const voteComment = (reportId: string, cid: string) => {
    const k = `${reportId}:${cid}`;
    if (voted.has(k)) return;
    setVoted(new Set(voted).add(k));
    setReports(reports.map(r => r.id === reportId ? {
      ...r, comments: r.comments.map(c => c.id === cid ? { ...c, masid: c.masid + 1 } : c),
    } : r));
  };

  useEffect(() => save(reports), [reports]);

  const sorted = useMemo(() => {
    const value = (r: CitizenReport) =>
      PROC_BY_ID.get(r.projectId)?.awardAmount ?? 0;
    const cmp: Record<SortKey, (a: CitizenReport, b: CitizenReport) => number> = {
      new: (a, b) => b.capturedAt - a.capturedAt,
      masid: (a, b) => b.masid - a.masid,
      discussed: (a, b) => b.comments.length - a.comments.length,
      // The only sort here backed by a measurement rather than by opinion.
      distance: (a, b) => (b.metresFromContract ?? -1) - (a.metresFromContract ?? -1),
      value: (a, b) => value(b) - value(a),
    };
    return [...reports].sort(cmp[sort]);
  }, [reports, sort]);

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
              deployment needs submission, moderation, an audit trail and a takedown route — which matters
              more once there are comments, since these threads name real companies. None of that is
              here.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400">Sort</span>
          {SORTS.map(({ key, label, hint }) => (
            <button key={key} onClick={() => setSort(key)} title={hint}
              className={`text-[12px] px-2.5 py-1 rounded-full border ${sort === key
                ? "border-[#1e3a7b] bg-[#1e3a7b] text-white" : "border-gray-200 text-gray-600 hover:bg-white"}`}>{label}</button>
          ))}
          <span className="ml-auto text-[11px] text-gray-400">{reports.length} report{reports.length === 1 ? "" : "s"}</span>
        </div>
        {sort === "distance" && (
          <p className="text-[11px] text-gray-500 -mt-1">
            The only ordering here that is measured rather than voted on: how far the reporter&apos;s
            device was from the coordinate DPWH published.
          </p>
        )}
        <div className="hidden">
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
                  {r.demo && (
                    <div className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded mb-2"
                      style={{ background: "#fef9e7", color: "#b45309" }}>
                      <AlertTriangle size={9}/>DEMO — seeded example, not a real report
                    </div>
                  )}
                  {r.note && <p className="text-[13px] text-gray-800 leading-relaxed mb-2.5">{r.note}</p>}
                  {p && (
                    <button onClick={() => onOpenProject(p.id)}
                      className="text-left w-full rounded border border-gray-100 px-3 py-2 hover:border-[#1e3a7b]/30 hover:bg-blue-50/30 mb-2.5">
                      <div className="text-[10px] font-mono text-gray-400">{p.id}</div>
                      <div className="text-[12px] text-gray-700 leading-tight">{p.description.slice(0, 80)}…</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{p.municipality} · {p.dpwhStatus}</div>
                    </button>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-gray-400 flex-wrap mb-2.5">
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

                  <div className="flex items-center gap-1 pt-2.5 border-t border-gray-100">
                    <button onClick={() => {
                        const n = new Set(open); n.has(r.id) ? n.delete(r.id) : n.add(r.id); setOpen(n);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[12px] text-gray-500 hover:bg-gray-50 hover:text-[#1e3a7b]">
                      <MessageSquare size={13} />
                      {r.comments.length} comment{r.comments.length === 1 ? "" : "s"}
                    </button>
                    <button onClick={() => {
                        navigator.clipboard?.writeText(`${location.origin}${location.pathname}#report-${r.id}`);
                        setCopied(r.id); setTimeout(() => setCopied(null), 1400);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[12px] text-gray-500 hover:bg-gray-50 hover:text-[#1e3a7b]">
                      <Link2 size={13} />{copied === r.id ? "Copied" : "Share"}
                    </button>
                  </div>
                </div>

                {open.has(r.id) && (
                  <Thread report={r} role={role}
                    onComment={(t, to) => addComment(r.id, t, to)}
                    onVote={cid => voteComment(r.id, cid)} />
                )}
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
