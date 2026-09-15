/**
 * What the paper says should be here, split by whether anyone can see it.
 *
 * This is the answer to a question that had no answer before: does what is in
 * the contract match what is on the ground?
 *
 * The register's description carries no dimension for 83% of contracts, so
 * "check the structure" was the most an inspection brief could say. The
 * quantities were never missing — they sit in the Bill of Quantities inside
 * scanned contract agreements that no conventional tool can read. OCR reads
 * them (pipeline/documents.py), and each pay item is then sorted by whether it
 * survives to be photographed.
 *
 * THE SPLIT IS THE POINT, AND IT IS UNCOMFORTABLE
 *
 * Reinforcing steel is cast into concrete. Excavation is backfilled. Subbase is
 * under the surface course. On the contracts read so far, most of the money is
 * in items that no camera will ever see — not because the imagery is too coarse,
 * but because the work is inside or underneath the finished structure. No
 * satellite, drone or street-level pass changes that.
 *
 * So this component does two things at once, and the second matters more:
 *
 *  1. It tells an inspector exactly what to look for, in the contract's own
 *     quantities — "274 m² of 0.35 m reinforced pavement", not "check it".
 *  2. It states, in money, how much of the contract nobody can verify
 *     without opening it. That is a finding about the limits of remote
 *     monitoring, and it belongs in front of the person relying on it rather
 *     than in a footnote.
 *
 * Extracted figures sit BESIDE the published record and are labelled as read
 * from a scan, never substituted for it. The pipeline reports its own accuracy
 * against a figure the export already holds, so the label can be trusted in
 * proportion to a measured number rather than to a hope.
 */

import { useMemo, useState } from "react";
import { FileSearch, Eye, EyeOff, Info } from "lucide-react";

import DOCS from "./data/documents.json";
import { tint, accent } from "./theme";

interface Item {
  code: string | null; description: string; quantity: number;
  unit: string | null; unitPrice: number; amount: number; visibility: string;
}
interface Doc {
  id: string; items: Item[]; boqTotal: number; coverage: number | null;
  statedTotal: number | null; awardAmount: number | null;
  byVisibility: Record<string, number>;
}

const D = DOCS as unknown as {
  generated: string; source: string; method: string; minCoverage: number;
  visibilityNote: Record<string, string>;
  accuracy: { read: number; priceReadable: number; priceExact: number };
  contracts: Doc[];
};

/**
 * Only contracts whose parsed rows account for a meaningful share of the price.
 *
 * A Bill of Quantities sums to the contract total by construction, so coverage
 * below 1.0 is rows the OCR missed. Measured coverage runs at a median of 62%
 * and never reaches 90%: two OCR passes recover different rows and neither is
 * close to the whole table. Anything under a third is dropped entirely, because
 * a list of one pay item out of seventeen reads as "this is the contract".
 */
export const DOC_BY_ID = new Map(
  D.contracts.filter(c => (c.coverage ?? 0) >= (D.minCoverage ?? 0.35)).map(c => [c.id, c]));

/** Ordered from "go and look at it" to "nobody can". */
const ORDER = ["surface", "ground", "footprint", "buried", "inside", "gone", "none"] as const;

const CFG: Record<string, { label: string; color: string; seen: boolean }> = {
  surface:   { label: "Visible from above",        color: "#046b04", seen: true },
  ground:    { label: "Visible from beside it",    color: "#1c5cab", seen: true },
  footprint: { label: "Outline only from above",   color: "#b45309", seen: true },
  buried:    { label: "Buried when finished",      color: "#6b6b64", seen: false },
  inside:    { label: "Cast inside the concrete",  color: "#6b6b64", seen: false },
  gone:      { label: "Removed — nothing remains", color: "#6b6b64", seen: false },
  none:      { label: "Not physical work",         color: "#6b6b64", seen: false },
};

const peso = (n: number) =>
  n >= 1e6 ? `₱${(n / 1e6).toFixed(1)}M` : `₱${Math.round(n).toLocaleString()}`;

const qty = (i: Item) =>
  `${i.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}${i.unit ? ` ${i.unit}` : ""}`;

export function WhatThePaperSays({ contractId }: { contractId: string }) {
  const doc = DOC_BY_ID.get(contractId);
  const [openAll, setOpenAll] = useState(false);
  const [why, setWhy] = useState(false);

  const groups = useMemo(() => {
    if (!doc) return [];
    return ORDER
      .map(k => ({ key: k, items: doc.items.filter(i => i.visibility === k) }))
      .filter(g => g.items.length > 0);
  }, [doc]);

  if (!doc) return null;

  const total = doc.boqTotal || 1;
  const seen = ORDER.filter(k => CFG[k].seen)
    .reduce((s, k) => s + (doc.byVisibility[k] ?? 0), 0);
  const unseen = total - seen;

  return (
    <div className="rounded border border-gray-200 overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-1.5">
        <FileSearch size={12} className="text-[#1e3a7b]" />
        <span className="text-[12px] font-bold text-gray-700">What the paper says is here</span>
        <button onClick={() => setWhy(v => !v)} aria-label="Where this came from"
          className="text-gray-300 hover:text-[#1e3a7b]"><Info size={12} /></button>
        <span className="ml-auto text-[10px] font-mono text-gray-400">{doc.items.length} pay items</span>
      </div>

      {why && (
        <div className="px-3 py-2.5 border-b border-gray-100 text-[10px] text-gray-600 leading-relaxed">
          <p>
            Read by OCR from the scanned contract agreement — the Bill of Quantities. These documents
            carry no extractable text, so nothing else in this project could use them.
          </p>
          <p className="mt-1">
            Accuracy, measured rather than assumed: the contract total was read from{" "}
            {D.accuracy.priceReadable} of {D.accuracy.read} documents and matched the figure already
            in the register on <strong>{D.accuracy.priceExact}</strong> of them. These quantities sit
            beside the published record, never replace it.
          </p>
        </div>
      )}

      {/* Incompleteness first. Every number below is a share of what was READ,
          not of the contract, and saying so before showing them is the whole
          difference between a partial result and a misleading one. */}
      <div className="px-3 py-2 border-b border-gray-100 text-[10px] leading-relaxed"
        style={{ background: tint("#b45309", 9), color: "var(--color-gray-700)" }}>
        <strong>Partly read.</strong> These {doc.items.length} pay items account for{" "}
        <strong>{Math.round((doc.coverage ?? 0) * 100)}%</strong> of this contract&apos;s value.
        The rest of the table did not survive OCR, so the percentages below are shares of what
        was read, not of the whole contract.
      </div>

      {/* The headline: how much of this contract anyone can check at all. */}
      <div className="px-3 py-2.5 border-b border-gray-100">
        <div className="flex h-2 rounded-full overflow-hidden">
          {ORDER.filter(k => doc.byVisibility[k]).map(k => (
            <div key={k} title={`${CFG[k].label} — ${peso(doc.byVisibility[k])}`}
              style={{
                width: `${(doc.byVisibility[k] / total) * 100}%`,
                background: CFG[k].seen ? accent(CFG[k].color) : "#d5d5d0",
              }} />
          ))}
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[10px]">
          <span className="flex items-center gap-1" style={{ color: accent("#046b04") }}>
            <Eye size={10} />{((seen / total) * 100).toFixed(0)}% can be looked at
          </span>
          <span className="flex items-center gap-1 text-gray-500">
            <EyeOff size={10} />{((unseen / total) * 100).toFixed(0)}% cannot — {peso(unseen)}
          </span>
        </div>
        <p className="text-[10px] text-gray-500 leading-snug mt-1.5">
          Not a resolution limit. Reinforcing steel is cast into the concrete, excavation is
          backfilled, subbase sits under the surface. No camera of any kind sees them once the work
          is finished.
        </p>
      </div>

      {/* The list, ordered so what an inspector can actually do comes first. */}
      <div className="max-h-[280px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {groups.map(({ key, items }) => {
          const c = CFG[key];
          const shown = openAll ? items : items.slice(0, c.seen ? 6 : 2);
          return (
            <div key={key} className="border-b border-gray-50 last:border-0">
              <div className="px-3 py-1.5 flex items-center gap-1.5"
                style={{ background: c.seen ? tint(c.color, 8) : undefined }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.seen ? accent(c.color) : "#c9c9c3" }} />
                <span className="text-[11px] font-semibold" style={{ color: c.seen ? accent(c.color) : "#6b7280" }}>
                  {c.label}
                </span>
                <span className="ml-auto text-[10px] font-mono text-gray-400">
                  {peso(doc.byVisibility[key] ?? 0)}
                </span>
              </div>
              {shown.map((i, n) => (
                <div key={`${key}-${n}`} className="px-3 py-1.5 flex items-baseline gap-2">
                  <span className="text-[11px] text-gray-700 flex-1 leading-snug">
                    {i.description}
                    {i.code && <span className="text-[9px] font-mono text-gray-400 ml-1.5">{i.code}</span>}
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-gray-800 shrink-0">{qty(i)}</span>
                </div>
              ))}
              {!openAll && items.length > shown.length && (
                <div className="px-3 pb-1.5 text-[10px] text-gray-400">
                  and {items.length - shown.length} more
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={() => setOpenAll(v => !v)}
        className="w-full py-1.5 text-[11px] text-[#1e3a7b] hover:bg-gray-50 border-t border-gray-100">
        {openAll ? "Show less" : `Show all ${doc.items.length} pay items`}
      </button>
    </div>
  );
}
