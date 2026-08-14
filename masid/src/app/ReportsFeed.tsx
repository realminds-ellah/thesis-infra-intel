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
  MessageSquare, CornerDownRight, Link2, Send, Info, RotateCcw, Trash2,
} from "lucide-react";

import { PROJECTS, PROC_BY_ID, type Project } from "./data";
import { tint, accent } from "./theme";
import { municipalityAt } from "./geo";

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
export type SortKey = "new" | "masid" | "discussed" | "distance" | "value" | "status";

/**
 * What has happened to a report since it was posted.
 *
 * A feed without this is a wall of photographs — nobody can tell a report that
 * was checked and confirmed from one nobody has opened. The states follow what
 * would actually happen to a complaint: it arrives, someone reads it, it goes on
 * an inspection list, somebody visits, and the visit either bears it out or does
 * not.
 *
 * "Validated" and "Not confirmed" are both outcomes, not verdicts on the person
 * who reported. Plenty of honest reports are not confirmed — a coordinate can be
 * wrong without the structure being missing — so the wording avoids implying bad
 * faith.
 *
 * ONLY OFFICIAL ROLES CAN MOVE A REPORT ALONG. A citizen cannot mark their own
 * report validated; that would make the badge worthless the day the tool became
 * popular. The public sees the state and who set it, and cannot change it.
 */
export type ReportStatus =
  | "submitted" | "reviewing" | "queued" | "validated" | "not-confirmed" | "closed";

export const STATUS_CFG: Record<ReportStatus, { label: string; color: string; bg: string; step: number; note: string }> = {
  submitted:      { label: "Submitted",            color: "#6b6b64", bg: "#f0f0ee", step: 1, note: "Posted. Nobody has picked it up yet." },
  reviewing:      { label: "Under review",         color: "#1c5cab", bg: "#e6eefa", step: 2, note: "An office has seen it and is looking at the record." },
  queued:         { label: "Queued for inspection",color: "#b45309", bg: "#fef9e7", step: 3, note: "On the list for a site visit." },
  validated:      { label: "Validated on site",    color: "#046b04", bg: "#e6f2e6", step: 4, note: "An inspector went and found what the report described." },
  "not-confirmed":{ label: "Not confirmed",        color: "#c05621", bg: "#fff4ec", step: 4, note: "An inspector went and did not find what the report described. That is an outcome, not a judgement on the reporter." },
  closed:         { label: "Closed",               color: "#6b6b64", bg: "#f0f0ee", step: 5, note: "No further action planned." },
};

/**
 * What the report is ABOUT — chosen by the person filing it.
 *
 * A free-text note alone makes every report a small essay that somebody has to
 * read before knowing whether it matters. One required choice turns the feed
 * into something that can be filtered, counted and routed: an office can pull
 * every "nothing built here" in Hagonoy without reading three hundred notes.
 *
 * Three rules govern the wording, and they are the reason this list looks the
 * way it does rather than like a complaints menu:
 *
 *  1. EVERY OPTION DESCRIBES WHAT IS AT THE SITE, never what anyone did. There
 *     is no "corrupt", no "ghost project", no "anomalous". A citizen reporting
 *     that a riverbank is empty is stating a fact about a riverbank; the leap
 *     from that to an accusation is not theirs to make in a form field, and a
 *     tool that invites it produces evidence nobody can use.
 *  2. THERE IS A POSITIVE OPTION, and it is not last. A feed that only accepts
 *     complaints teaches people that confirming something exists is not worth
 *     the walk, and then silence becomes unreadable — you cannot tell the sites
 *     nobody checked from the sites that were fine. "It is there and looks
 *     finished" is real data and is treated as such.
 *  3. "SOMETHING ELSE" EXISTS so nobody is forced into a category that does not
 *     fit. A miscategorised report is worse than an uncategorised one.
 */
export type ReportKind =
  | "nothing-here" | "unfinished" | "damaged" | "different" | "not-working"
  | "looks-done" | "other";

export const KIND_CFG: Record<ReportKind, {
  label: string; short: string; color: string; help: string;
}> = {
  "nothing-here": {
    label: "Nothing is built at this spot", short: "Nothing here", color: "#c0272d",
    help: "You went to the location and there is no structure of any kind. Say what IS there instead — field, water, road, houses.",
  },
  unfinished: {
    label: "Work looks unfinished or stopped", short: "Unfinished", color: "#e8722c",
    help: "Something was started and left — exposed rebar, half a wall, materials sitting on site with no work going on.",
  },
  damaged: {
    label: "It is built but damaged or failing", short: "Damaged", color: "#b45309",
    help: "The structure is there but cracked, collapsed, undermined or washed out. Worth photographing the damaged part directly.",
  },
  different: {
    label: "What is here does not match the description", short: "Doesn't match", color: "#8a6d00",
    help: "There is a structure, but not the one the contract describes — a different type, a much shorter stretch, or in a different place along the river.",
  },
  "not-working": {
    label: "It is there but not doing its job", short: "Not working", color: "#1c5cab",
    help: "Silted up, blocked, gates that do not move, a pumping station with no pump. Especially useful right after a flood.",
  },
  "looks-done": {
    label: "It is there and looks finished", short: "Looks finished", color: "#046b04",
    help: "Confirming that a project exists is as useful as reporting that one does not. Without these, silence cannot be told apart from nobody having checked.",
  },
  other: {
    label: "Something else", short: "Something else", color: "#6b6b64",
    help: "Anything the options above do not cover. Describe it in your own words below.",
  },
};

export const KIND_ORDER: ReportKind[] = [
  "nothing-here", "unfinished", "damaged", "different", "not-working", "looks-done", "other",
];

/** Roles that may move a report along. A reporter cannot validate themselves. */
const OFFICIAL = new Set(["DPWH Admin", "DPWH Engineer", "Field Inspector", "LGU Coordinator"]);

const SORTS: { key: SortKey; label: string; hint: string }[] = [
  { key: "new", label: "Newest", hint: "Most recently captured first" },
  { key: "distance", label: "Furthest from the coordinate",
    hint: "Ranked by the gap between where the photo was taken and where DPWH says the project is — the one ordering here backed by a measurement rather than by opinion" },
  { key: "masid", label: "Most masid", hint: "Most marked as worth attention. Measures attention, not accuracy" },
  { key: "discussed", label: "Most discussed", hint: "Most comments. Also attention, not accuracy" },
  { key: "value", label: "Biggest contract", hint: "Largest awarded amount of the contract reported on" },
  { key: "status", label: "Furthest along", hint: "Reports that have been inspected or closed, ahead of ones nobody has opened" },
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
  kind: ReportKind;
  note: string;
  image: string;             // data URL, captured in-page
  capturedAt: number;
  lat: number | null;        // the device's own fix at capture time
  lng: number | null;
  /**
   * The municipality the fix falls in, resolved on the device against the same
   * boundaries the coordinate checks use. Null means the GPS put the reporter
   * outside every Bulacan municipality — which is information, not a failure,
   * so it is stored and shown rather than blanked.
   */
  place?: string | null;
  metresFromContract: number | null;
  masid: number;
  comments: Comment[];
  status: ReportStatus;
  statusBy: string | null;      // the role that last moved it
  statusAt: number | null;
  /**
   * Posted from THIS browser. There are no accounts in this prototype, so
   * ownership is the only thing that can honestly be claimed: a report you can
   * delete is one that has never left your own machine. It is deliberately not
   * a permission — an office cannot delete a citizen's report from here, and a
   * real deployment would need a takedown route with a record of who used it.
   */
  mine?: boolean;
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
    kind: "looks-done",
    status: "validated", statusBy: "Field Inspector", statusAt: Date.now() - 2 * HOUR,
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
    kind: "nothing-here",
    status: "queued", statusBy: "LGU Coordinator", statusAt: Date.now() - 8 * HOUR,
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
    kind: "damaged",
    status: "submitted", statusBy: null, statusAt: null,
    comments: [
      { id: "c6", author: "Public", at: Date.now() - 2 * 24 * HOUR, masid: 8, demo: true,
        text: "It floods along here every wet season. Whatever was built the first time did not hold." },
    ],
  },
];

/**
 * Fill in fields added after a report was saved.
 *
 * Anything persisted to a browser outlives the shape it was written in. Reports
 * stored before `comments` and `status` existed came back missing them, and the
 * feed died on STATUS_CFG[undefined] — a blank screen for anyone who had used it
 * before, and invisible to any test that clears storage first. Which every test
 * here did.
 *
 * So: never trust the shape of what comes out of storage, and default every
 * field that was ever added.
 */
const migrate = (r: Partial<CitizenReport>): CitizenReport => ({
  id: r.id ?? `r${Math.random().toString(36).slice(2)}`,
  projectId: r.projectId ?? "",
  // Reports saved before kinds existed fall to "other" rather than being
  // guessed at from their text. Inventing a category for somebody else's
  // report is the one thing worse than not having one.
  kind: r.kind && r.kind in KIND_CFG ? r.kind : "other",
  note: r.note ?? "",
  image: r.image ?? "",
  capturedAt: r.capturedAt ?? Date.now(),
  lat: r.lat ?? null,
  lng: r.lng ?? null,
  // Reports saved before places existed get theirs derived now — the fix was
  // always stored, only the name was missing, so this adds nothing new.
  place: r.place !== undefined ? r.place
    : (r.lat != null && r.lng != null ? municipalityAt(r.lat, r.lng) : null),
  metresFromContract: r.metresFromContract ?? null,
  masid: r.masid ?? 0,
  comments: Array.isArray(r.comments) ? r.comments : [],
  status: r.status && r.status in STATUS_CFG ? r.status : "submitted",
  statusBy: r.statusBy ?? null,
  statusAt: r.statusAt ?? null,
  mine: r.mine,
  demo: r.demo,
});

/**
 * An EMPTY feed and an UNVISITED one are different things.
 *
 * This used to treat both as "show the examples", which meant deleting the last
 * report silently brought all three demos back — the delete appeared to fail.
 * A stored empty array now means exactly what it says: this person cleared the
 * feed, leave it cleared. Only a missing key seeds the examples.
 */
const load = (): CitizenReport[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return DEMO;                 // never visited
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) return DEMO;        // unreadable, not empty
    // Drop anything that has lost the project it referred to, rather than
    // rendering a card that points nowhere.
    return saved.map(migrate).filter(r => r.projectId);
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
  // The moment the frame was grabbed, not the moment it was posted. Rendering
  // `new Date()` under the still meant the caption ticked forward while the
  // photo sat there, quietly claiming a time it was not taken.
  const [shotAt, setShotAt] = useState<number | null>(null);
  const [fix, setFix] = useState<[number, number] | null>(null);
  const [projectId, setProjectId] = useState("");
  const [kind, setKind] = useState<ReportKind | null>(null);
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  streamRef.current = stream;

  /**
   * Open the camera, and be able to do it again.
   *
   * Taking the shot stops the stream — leaving a camera running behind a still
   * image is both a battery drain and a light nobody expects to stay on. That
   * made the first frame final, which is the wrong trade: site photos are taken
   * one-handed, into the sun, on a riverbank, and the first one is very often
   * blurred or pointed at the wrong thing. Retake restarts the stream, so the
   * only thing a bad photo costs is a second press.
   */
  const openCamera = () => {
    setErr(null);
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(s => {
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setErr("The camera could not be opened. Reports must be taken live, so there is no way to attach an existing photo."));
  };

  useEffect(() => {
    openCamera();
    navigator.geolocation?.getCurrentPosition(
      p => setFix([p.coords.latitude, p.coords.longitude]), () => setFix(null),
      { enableHighAccuracy: true, timeout: 8000 });
    // Read off the ref at teardown so a stream opened by a RETAKE is stopped
    // too. Closing over the first stream leaked every subsequent one.
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const capture = () => {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth || 720; c.height = v.videoHeight || 540;
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    setShot(c.toDataURL("image/jpeg", 0.8));
    setShotAt(Date.now());
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
  };

  const retake = () => {
    setShot(null);
    setShotAt(null);
    openCamera();
  };

  const matches = useMemo(() => {
    if (!q) return [];
    const t = q.toLowerCase();
    return PROJECTS.filter(p => `${p.id} ${p.municipality} ${p.description}`.toLowerCase().includes(t)).slice(0, 6);
  }, [q]);
  const chosen = PROJECTS.find(p => p.id === projectId) ?? null;
  const place = useMemo(() => fix ? municipalityAt(fix[0], fix[1]) : null, [fix]);

  const submit = () => {
    if (!shot || !chosen || !kind) return;
    setBusy(true);
    const d = fix && chosen.lat != null && chosen.lng != null
      ? metres(fix, [chosen.lat, chosen.lng]) : null;
    onDone({
      id: `r${Date.now()}`, projectId: chosen.id, kind, note: note.trim(), image: shot,
      capturedAt: shotAt ?? Date.now(), lat: fix?.[0] ?? null, lng: fix?.[1] ?? null,
      place, metresFromContract: d, masid: 0, comments: [],
      status: "submitted", statusBy: null, statusAt: null, mine: true,
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
            {/* Nothing is committed until Post. Until then the photo can be
                thrown away as many times as it takes to get a usable one. */}
            {shot && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
                <button onClick={retake}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-semibold bg-white/90 text-gray-800 shadow-lg hover:bg-white">
                  <RotateCcw size={13} />Retake
                </button>
                <span className="px-3 py-2 rounded-full text-[11px] bg-black/55 text-white/90">
                  Not posted yet
                </span>
              </div>
            )}
            {err && (
              <button onClick={openCamera}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-semibold bg-white/90 text-gray-800 shadow-lg">
                <RotateCcw size={13} />Try the camera again
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span className="flex items-center gap-1"><Clock size={11} />
              {shotAt ? `taken ${new Date(shotAt).toLocaleTimeString()}` : "not taken yet"}</span>
            <span className="flex items-center gap-1"><MapPin size={11} />
              {fix ? `${fix[0].toFixed(5)}, ${fix[1].toFixed(5)}` : "location off — nothing will be tagged"}</span>
          </div>

          {/* What the fix resolves to, before anything is posted. Shown live so
              a reporter can see the tool has placed them somewhere sensible —
              and can see when it has not. */}
          {fix && (
            <div className="text-[11px] px-2.5 py-2 rounded border"
              style={place
                ? { background: tint("#046b04"), borderColor: tint("#046b04", 38), color: accent("#046b04") }
                : { background: tint("#c05621"), borderColor: tint("#c05621", 38), color: accent("#c05621") }}>
              {place
                ? <>Your device places you in <strong>{place}, Bulacan</strong>. This is added to the report automatically.</>
                : <>Your device places you outside every Bulacan municipality. The coordinates are still attached — the report will say so.</>}
            </div>
          )}

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

          {/* The choice, before the free text. Asked in this order because a
              category picked after writing a paragraph tends to be whichever
              one the paragraph already sounds like. */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              What are you reporting?
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {KIND_ORDER.map(k => {
                const c = KIND_CFG[k], on = kind === k;
                return (
                  <button key={k} onClick={() => setKind(k)} type="button"
                    className={`text-left px-2.5 py-2 rounded border text-[12px] leading-tight transition-colors ${
                      on ? "font-semibold" : "border-gray-200 text-gray-700 hover:border-gray-300"}`}
                    style={on ? { background: tint(c.color), borderColor: accent(c.color), color: accent(c.color) } : undefined}>
                    <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
                      style={{ background: accent(c.color) }} />
                    {c.short}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed mt-1.5 min-h-[30px]">
              {kind ? KIND_CFG[kind].help
                : "Pick the one closest to what you found. Every option describes the site — none of them says anything about who is responsible, which is not for a form to decide."}
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">What did you see?</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              placeholder="Describe what is there, or what is missing."
              className="w-full px-2.5 py-2 text-[12px] border border-gray-200 rounded bg-gray-50 focus:outline-none focus:border-[#1e3a7b]" />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100">
          <button onClick={submit} disabled={!shot || !chosen || !kind || busy}
            className="w-full py-2.5 rounded text-[13px] font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: "var(--masid-navy)" }}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            Post report
          </button>
          {/* Say which one is missing rather than leaving a dead button. */}
          {!busy && (!shot || !chosen || !kind) && (
            <p className="text-[11px] text-gray-500 text-center mt-1.5">
              Still needed: {[!shot && "a photo", !chosen && "which project", !kind && "what you are reporting"]
                .filter(Boolean).join(", ")}
            </p>
          )}
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
            {c.demo && <span className="text-[9px] px-1.5 rounded" style={{ background: tint("#b45309"), color: accent("#b45309") }}>demo</span>}
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
              className="px-2.5 rounded text-white" style={{ background: "var(--masid-navy)" }}><Send size={12} /></button>
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
          <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "var(--masid-navy)" }}>{role.charAt(0)}</div>
          <input value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && text.trim()) { onComment(text.trim()); setText(""); } }}
            placeholder="Add what you know about this site…"
            className="flex-1 px-3 py-1.5 text-[12px] border border-gray-200 rounded-full bg-white focus:outline-none focus:border-[#1e3a7b]" />
          <button onClick={() => { if (text.trim()) { onComment(text.trim()); setText(""); } }} disabled={!text.trim()}
            className="px-3 rounded-full text-white disabled:opacity-30" style={{ background: "var(--masid-navy)" }}><Send size={13} /></button>
        </div>
      )}
    </div>
  );
}

export function ReportsFeed({ onOpenProject, role = "Public" }: { onOpenProject: (id: string) => void; role?: string }) {
  const [reports, setReports] = useState<CitizenReport[]>(load);
  const [sort, setSort] = useState<SortKey>("new");
  const [kinds, setKinds] = useState<Set<ReportKind>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [info, setInfo] = useState<Set<string>>(new Set());

  /** Status config, tolerant of a value written before it existed. */
  const st = (r: CitizenReport) => STATUS_CFG[r.status] ?? STATUS_CFG.submitted;

  const addComment = (reportId: string, text: string, replyTo?: string) =>
    setReports(reports.map(r => r.id === reportId ? {
      ...r, comments: [...r.comments,
        { id: `c${Date.now()}`, author: role, text, at: Date.now(), masid: 0, replyTo }],
    } : r));

  /** Only official roles may move a report along; a reporter validating their
   *  own report would make the badge worthless the day this got popular. */
  const setStatus = (id: string, status: ReportStatus) =>
    setReports(reports.map(r => r.id === id
      ? { ...r, status, statusBy: role, statusAt: Date.now() } : r));

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
      status: (a, b) => STATUS_CFG[b.status].step - STATUS_CFG[a.status].step,
    };
    const kept = kinds.size === 0 ? reports : reports.filter(r => kinds.has(r.kind));
    return [...kept].sort(cmp[sort]);
  }, [reports, sort, kinds]);

  /**
   * Delete a report posted from this browser.
   *
   * Gone means gone: the record is dropped from state and the next write puts
   * the shortened list to storage. There is no tombstone and no "deleted by"
   * marker, because there is nobody to show one to — this prototype has no
   * server and no other reader. A real deployment would need the opposite:
   * a soft delete with an audit trail, since a report naming a contractor that
   * can be silently removed is a moderation hole rather than a feature.
   */
  const remove = (id: string) => {
    setReports(reports.filter(r => r.id !== id));
    setConfirmDelete(null);
    // Any panel keyed to the removed report has to be released too, or the
    // next report to take that id inherits an opened thread.
    const drop = (set: Set<string>) => { const n = new Set(set); n.delete(id); return n; };
    setOpen(drop(open)); setInfo(drop(info));
  };

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
            style={{ background: "var(--masid-navy)" }}>
            <Camera size={14} />Report from the site
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <div className="rounded border p-3.5" style={{ background: tint("#b45309"), borderColor: tint("#b45309", 40) }}>
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

        <div className="flex items-center gap-2 flex-wrap">
          {/* A dropdown, not chips. Five labels this long wrapped inside their
              own pills and turned the row into a block of broken text. */}
          <label htmlFor="feed-sort" className="text-[11px] text-gray-400">Sort by</label>
          <select id="feed-sort" value={sort} onChange={e => setSort(e.target.value as SortKey)}
            className="text-[12px] border border-gray-200 rounded px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-[#1e3a7b]">
            {SORTS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <span className="ml-auto text-[11px] text-gray-400">
            {sorted.length === reports.length
              ? `${reports.length} report${reports.length === 1 ? "" : "s"}`
              : `${sorted.length} of ${reports.length} reports`}
          </span>
        </div>

        {/* Filter by what people said they were reporting. Counted live, and a
            kind nobody has filed is shown at zero rather than hidden — the
            absence of "nothing here" reports is itself worth seeing. */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {KIND_ORDER.map(k => {
            const n = reports.filter(r => r.kind === k).length;
            const on = kinds.has(k), c = KIND_CFG[k];
            return (
              <button key={k} onClick={() => {
                  const next = new Set(kinds); next.has(k) ? next.delete(k) : next.add(k); setKinds(next);
                }}
                title={c.label}
                className={`text-[11px] px-2 py-1 rounded-full border flex items-center gap-1.5 ${
                  on ? "font-semibold" : n === 0 ? "border-gray-100 text-gray-300" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                style={on ? { background: tint(c.color), borderColor: accent(c.color), color: accent(c.color) } : undefined}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent(c.color) }} />
                {c.short}<span className="font-mono opacity-70">{n}</span>
              </button>
            );
          })}
          {kinds.size > 0 && (
            <button onClick={() => setKinds(new Set())}
              className="text-[11px] px-2 py-1 text-gray-500 hover:text-[#1e3a7b] underline">clear</button>
          )}
        </div>
        <p className="text-[11px] text-gray-500 -mt-2">
          {sort === "distance"
            ? "The only ordering here that is measured rather than voted on: how far the reporter's device was from the coordinate DPWH published."
            : SORTS.find(o => o.key === sort)?.hint}
        </p>
        <div className="hidden">
        </div>

        {sorted.length === 0 && (
          <div className="bg-white rounded border border-gray-200 py-14 text-center">
            <Video size={26} className="text-gray-300 mx-auto mb-2" />
            <div className="text-[13px] font-semibold text-gray-600">
              {kinds.size > 0 ? "Nothing matches those filters" : "No reports here"}
            </div>
            <p className="text-[12px] text-gray-400 mt-1 max-w-xs mx-auto">
              {kinds.size > 0
                ? "Clear a filter above to see the rest of the feed."
                : "Stand at a flood-control site, open the camera, and say what is there."}
            </p>
            {/* Removing the examples is reversible. Nothing else in this feed
                is, so the one destructive action that costs no real work
                should not be the one that cannot be undone. */}
            {kinds.size === 0 && reports.length === 0 && (
              <button onClick={() => setReports(DEMO)}
                className="mt-3 text-[12px] px-3 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">
                Bring back the example reports
              </button>
            )}
          </div>
        )}

        {sorted.map(r => {
          const p: Project | undefined = PROJECTS.find(x => x.id === r.projectId);
          const far = r.metresFromContract != null && r.metresFromContract > 300;
          return (
            <article key={r.id} className="bg-white rounded border border-gray-200 overflow-hidden">
              <div className="min-w-0">
                {/* Where the report has got to. Without this the feed is a wall
                    of photographs and nothing says which ones anyone acted on. */}
                <div className="px-4 pt-3 pb-2.5 border-b border-gray-100">
                  {/* One box, colour-coded. The five-segment strip that used to
                      sit here spent a lot of furniture on a single fact; where a
                      report sits in the sequence is available on demand instead. */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] px-2.5 py-1 rounded font-semibold flex items-center gap-1.5"
                      style={{ background: tint(st(r).color), color: accent(st(r).color) }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: st(r).color }} />
                      {st(r).label}
                    </span>
                    {/* What the reporter said this is about, beside what has
                        happened to it. Two different facts, two chips. */}
                    <span className="text-[11px] px-2 py-1 rounded font-medium flex items-center gap-1.5"
                      style={{ background: tint(KIND_CFG[r.kind].color), color: accent(KIND_CFG[r.kind].color) }}
                      title={KIND_CFG[r.kind].label}>
                      {KIND_CFG[r.kind].short}
                    </span>
                    <button onClick={() => {
                        const n = new Set(info); n.has(r.id) ? n.delete(r.id) : n.add(r.id); setInfo(n);
                      }}
                      aria-label="What does this status mean?"
                      className="text-gray-300 hover:text-[#1e3a7b]"><Info size={13} /></button>
                    {r.statusBy && (
                      <span className="text-[10px] text-gray-400">set by {r.statusBy} · {ago(r.statusAt ?? Date.now())}</span>
                    )}
                    {OFFICIAL.has(role) ? (
                      <select value={r.status} aria-label="Move this report along"
                        onChange={e => setStatus(r.id, e.target.value as ReportStatus)}
                        className="ml-auto text-[11px] border border-gray-200 rounded px-2 py-1 bg-white text-gray-600 focus:outline-none focus:border-[#1e3a7b]">
                        {(Object.keys(STATUS_CFG) as ReportStatus[]).map(k =>
                          <option key={k} value={k}>{STATUS_CFG[k].label}</option>)}
                      </select>
                    ) : (
                      <span className="ml-auto text-[10px] text-gray-300">only DPWH, LGU or an inspector can move this</span>
                    )}
                  </div>

                  {info.has(r.id) && (
                    <div className="mt-2 rounded border border-gray-100 bg-gray-50 p-3">
                      <p className="text-[11px] text-gray-600 leading-relaxed mb-2">{st(r).note}</p>
                      <div className="space-y-1">
                        {(Object.keys(STATUS_CFG) as ReportStatus[]).map(k => (
                          <div key={k} className={`flex items-baseline gap-2 ${k === r.status ? "" : "opacity-45"}`}>
                            <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: STATUS_CFG[k].color }} />
                            <span className="text-[11px] font-medium text-gray-700 shrink-0" style={{ minWidth: 128 }}>{STATUS_CFG[k].label}</span>
                            <span className="text-[10px] text-gray-500 leading-snug">{STATUS_CFG[k].note}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                        Validated and Not confirmed are both outcomes of a site visit, not judgements on
                        whoever reported. Only DPWH, an LGU or an inspector can move a report along.
                      </p>
                    </div>
                  )}
                </div>

                <img src={r.image} alt="" className="w-full object-cover" style={{ maxHeight: 320 }} />
                <div className="p-4">
                  {r.demo && (
                    <div className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded mb-2"
                      style={{ background: tint("#b45309"), color: accent("#b45309") }}>
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

                  {/* Where the photo was taken, in words. Coordinates are kept
                      but a place name is what a reader can actually check. */}
                  {r.lat != null && (
                    <div className="flex items-center gap-2 flex-wrap text-[11px] mb-2.5 px-2.5 py-1.5 rounded border border-gray-100 bg-gray-50">
                      <MapPin size={11} className="text-gray-400 shrink-0" />
                      {r.place
                        ? <span className="text-gray-700">Taken in <strong>{r.place}, Bulacan</strong></span>
                        : <span className="text-gray-700">Taken outside every Bulacan municipality</span>}
                      {/* The one comparison worth making automatically: the
                          municipality the reporter stood in against the one the
                          contract names. A mismatch does not mean anyone did
                          anything — a coordinate can be wrong, a reporter can
                          stand on the far bank — but it is the reason to look. */}
                      {r.place && p && r.place !== p.municipality && (
                        <span className="px-1.5 py-0.5 rounded font-medium"
                          style={{ background: tint("#c05621"), color: accent("#c05621") }}>
                          contract says {p.municipality}
                        </span>
                      )}
                      <span className="font-mono text-gray-400 ml-auto">{r.lat.toFixed(5)}, {r.lng!.toFixed(5)}</span>
                      <a href={`https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`}
                        target="_blank" rel="noreferrer" className="text-[#1e3a7b] hover:underline shrink-0">
                        open map
                      </a>
                    </div>
                  )}

                  <div className="flex items-center gap-1 pt-2.5 border-t border-gray-100">
                    <button onClick={() => vote(r.id)} disabled={voted.has(r.id)}
                      title="Mark this as worth attention"
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[12px] ${
                        voted.has(r.id) ? "text-[#1e3a7b] bg-blue-50" : "text-gray-500 hover:bg-gray-50 hover:text-[#1e3a7b]"}`}>
                      <Eye size={13} />
                      <span className="font-mono font-semibold">{r.masid}</span> masid
                    </button>
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
                    {/* Every card can be removed, because every card is in THIS
                        browser and nowhere else — there is no server, so there
                        is no one else's copy to take down. That is what makes
                        this safe here and exactly what would make it unsafe in a
                        real deployment: a report naming a contractor that any
                        reader can silently remove is a moderation hole, so a
                        deployed version needs a soft delete, a reason and a
                        record of who used it. Removing a seeded example is
                        reversible; deleting your own report is not. */}
                    {(
                      confirmDelete === r.id ? (
                        <span className="ml-auto flex items-center gap-1.5">
                          <span className="text-[11px] text-gray-500">
                            {r.demo ? "Remove this example?" : "Delete this report?"}
                          </span>
                          <button onClick={() => remove(r.id)}
                            className="text-[11px] px-2.5 py-1.5 rounded font-semibold"
                            style={{ background: tint("#c0272d"), color: accent("#c0272d") }}>
                            {r.demo ? "Yes, remove" : "Yes, delete"}
                          </button>
                          <button onClick={() => setConfirmDelete(null)}
                            className="text-[11px] px-2.5 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">
                            Keep
                          </button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmDelete(r.id)}
                          title={r.demo
                            ? "Remove this seeded example from your feed"
                            : "Delete this report"}
                          className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[12px] text-gray-400 hover:bg-gray-50 hover:text-[#c0272d]">
                          <Trash2 size={13} />{r.demo ? "Remove" : "Delete"}
                        </button>
                      )
                    )}
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
