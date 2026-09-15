/**
 * A way for a named party to answer.
 *
 * WHY THIS IS NOT OPTIONAL
 *
 * This app names real companies on a public URL beside the word "flagged". The
 * wording guard is careful — every flag says the record disagrees with itself,
 * never that anyone did anything — but careful wording is not the whole of the
 * duty, and in the Philippines it is not the whole of the legal exposure either.
 * What protects a project like this, and what makes it useful rather than merely
 * loud, is DEMONSTRABLE care: a visible route for a named party to say "that
 * coordinate is wrong, here is the as-built", and a record that the response was
 * received.
 *
 * There is a second reason that has nothing to do with risk. The people best
 * placed to correct this data are the contractors and engineers who did the
 * work. A flag saying a coordinate contradicts its description is exactly the
 * kind of thing the firm can settle in one sentence. Refusing them a route
 * throws away the cheapest source of correction available.
 *
 * WHAT THIS IS HONEST ABOUT
 *
 * It is a PROTOTYPE and it says so in the panel rather than in a comment. There
 * is no server, so a reply is written to this browser and reaches nobody. A real
 * deployment needs a monitored address, a published response time, an audit
 * trail, and a named person answerable for it. Showing a form that quietly goes
 * nowhere would be worse than showing none — so the panel leads with the
 * limitation and gives the real-world routes that do exist today.
 */

import { useEffect, useState } from "react";
import { MessageSquareWarning, X, Check, ExternalLink } from "lucide-react";

import { tint, accent } from "./theme";

const KEY = "masid.replies.v1";

export interface Reply {
  id: string;
  contractId: string;
  role: string;          // what the writer says they are; unverified, and labelled so
  body: string;
  at: string;
}

const load = (): Reply[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return Array.isArray(raw) ? raw.filter(r => r && r.contractId) : [];
  } catch { return []; }
};
const save = (r: Reply[]) => { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* private mode */ } };

const WHO = [
  "The contractor named on this contract",
  "DPWH staff",
  "Local government",
  "The engineer or consultant",
  "Someone else with direct knowledge",
];

export function RightOfReply({ contractId, contractName, onClose }: {
  contractId: string; contractName: string; onClose: () => void;
}) {
  const [who, setWho] = useState<string>("");
  const [body, setBody] = useState("");
  const [done, setDone] = useState(false);
  const [existing, setExisting] = useState<Reply[]>([]);

  useEffect(() => { setExisting(load().filter(r => r.contractId === contractId)); }, [contractId]);

  const submit = () => {
    if (!who || body.trim().length < 10) return;
    const all = load();
    const rec: Reply = {
      id: `y${Date.now()}`, contractId, role: who, body: body.trim(),
      at: new Date().toISOString(),
    };
    save([...all, rec]);
    setExisting([...existing, rec]);
    setDone(true);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6" style={{ zIndex: 2100 }}>
      <div className="bg-white rounded-lg shadow-2xl w-full flex flex-col" style={{ maxWidth: 560, maxHeight: "90vh" }}>
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
          <MessageSquareWarning size={15} className="text-[#1e3a7b]" />
          <span className="text-[13px] font-bold text-gray-900">Correct or answer this record</span>
          <button onClick={onClose} className="ml-auto p-1 text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3" style={{ scrollbarWidth: "none" }}>
          <div className="text-[11px] font-mono text-gray-400">{contractId}</div>
          <div className="text-[13px] font-semibold text-gray-800 leading-snug">{contractName}</div>

          {/* The limitation first. A form that silently goes nowhere is worse
              than no form, so this does not pretend to file anything. */}
          <div className="rounded border p-3 text-[12px] leading-relaxed"
            style={{ background: tint("#b45309", 10), borderColor: tint("#b45309", 34), color: "var(--color-gray-700)" }}>
            <strong>This is a prototype and your reply reaches nobody.</strong> It is stored in this
            browser only. There is no server behind it, no inbox, and no one monitoring it. It is
            here to show what a deployed version must have, not to stand in for it.
          </div>

          <div className="rounded border border-gray-200 p-3 text-[12px] text-gray-600 leading-relaxed">
            <div className="font-semibold text-gray-700 mb-1">Routes that do work today</div>
            <p>
              Everything shown about this contract is republished from public sources. Corrections
              are best made at the source, where they reach everyone rather than one website:
            </p>
            <ul className="mt-1.5 space-y-1">
              <li>· <strong>DPWH transparency portal</strong> — the origin of the contract record{" "}
                <a href="https://infrastructure.dpwh.gov.ph/" target="_blank" rel="noreferrer"
                  className="text-[#1e3a7b] hover:underline inline-flex items-center gap-0.5">
                  infrastructure.dpwh.gov.ph<ExternalLink size={9} /></a></li>
              <li>· <strong>PhilGEPS</strong> — the origin of the bidding and award records</li>
              <li>· <strong>The district office</strong> — for coordinates and chainage, which are the
                most commonly wrong fields here</li>
            </ul>
          </div>

          {done ? (
            <div className="rounded border p-3 flex items-start gap-2"
              style={{ background: tint("#046b04", 12), borderColor: tint("#046b04", 34) }}>
              <Check size={15} className="shrink-0 mt-0.5" style={{ color: accent("#046b04") }} />
              <div className="text-[12px] text-gray-700 leading-relaxed">
                Saved to this browser. It will appear under this contract on this device, marked as
                an unverified reply. Nothing has been sent.
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Who is answering?
                </label>
                <div className="space-y-1">
                  {WHO.map(w => (
                    <button key={w} onClick={() => setWho(w)}
                      className={`w-full text-left px-2.5 py-2 rounded border text-[12px] ${
                        who === w ? "font-semibold" : "border-gray-200 text-gray-700 hover:border-gray-300"}`}
                      style={who === w ? { background: tint("#1e3a7b", 12), borderColor: accent("#1e3a7b"), color: accent("#1e3a7b") } : undefined}>
                      {w}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5">
                  Nothing here is verified. A reply is shown as a claim by whoever wrote it, never as
                  a correction to the record — only the source can correct the record.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  What is wrong, or what should be added?
                </label>
                <textarea value={body} onChange={e => setBody(e.target.value)} rows={5}
                  placeholder="For example: the published coordinate is the office address, not the site; the work runs from STA 1+200 to STA 1+980 along the far bank."
                  className="w-full px-2.5 py-2 text-[12px] border border-gray-200 rounded focus:outline-none focus:border-[#1e3a7b]" />
              </div>
            </>
          )}

          {existing.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Replies stored on this device
              </div>
              {existing.map(r => (
                <div key={r.id} className="rounded border border-gray-200 p-2.5 mb-1.5">
                  <div className="flex items-center gap-2 text-[11px] text-gray-500">
                    <span className="font-semibold text-gray-700">{r.role}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                      style={{ background: tint("#b45309", 16), color: accent("#b45309") }}>unverified</span>
                    <span className="ml-auto">{new Date(r.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>
                  <p className="text-[12px] text-gray-700 leading-relaxed mt-1">{r.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {!done && (
          <div className="px-5 py-3 border-t border-gray-100">
            <button onClick={submit} disabled={!who || body.trim().length < 10}
              className="w-full py-2.5 rounded text-[13px] font-semibold text-white disabled:opacity-40"
              style={{ background: "var(--masid-navy)" }}>
              Save reply to this browser
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** How many replies are stored against a contract, for badging the record. */
export const replyCount = (contractId: string) =>
  load().filter(r => r.contractId === contractId).length;
