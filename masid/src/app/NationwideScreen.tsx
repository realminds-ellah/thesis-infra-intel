/**
 * Every district engineering office, on the same indicators.
 *
 * WHY A CASE STUDY NEEDS THIS
 *
 * The strongest finding in this project is that Bulacan 1st DEO awards at
 * exactly 96.00% of the approved budget on 38.9% of its priced contracts. Stated
 * alone, that invites the fairest possible objection: how do you know that is
 * unusual, rather than simply how DPWH procurement works?
 *
 * The procurement pipeline always computed a national baseline before narrowing
 * to one office, so the answer existed — but it was a single number in a
 * tooltip, and a single number cannot be checked. This is the distribution it
 * came from: 34,080 flood-control contracts across 216 offices, every one on the
 * same four measures, sortable and searchable.
 *
 * The ranking survives the wider view and gets stronger. Against 197 offices
 * with enough priced contracts to rank, Bulacan 1st DEO is first at 38.9% — and
 * the second-placed office is at 17.7%, less than half.
 *
 * AND IT MAKES THE TOOL NATIONAL. A reader in Cebu or Davao can find their own
 * district and see where it sits. That is the difference between a Bulacan case
 * study and something a Filipino anywhere can open and get an answer from.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *
 * Only procurement indicators. The records-side consistency checks — coordinates
 * against boundaries, description against location — need municipal polygon
 * geometry, which this project ships for Bulacan alone. Running them nationally
 * is a real piece of work, not a switch, and claiming a national records score
 * without it would be inventing one.
 */

import { useMemo, useState } from "react";
import { Search, ArrowUpDown, Info, MapPin } from "lucide-react";

import NATIONAL from "./data/national.json";
import { tint, accent } from "./theme";

interface Office {
  office: string; region: string | null;
  contracts: number; value: number; contractors: number;
  withRatio: number; at96: number;
  at96Rate: number | null; wholePctRate: number | null;
  singleBidderRate: number | null; coordRate: number | null;
  rankable: boolean; rankAt96: number | null;
}

const N = NATIONAL as unknown as {
  generated: string; source: string; note: string; minContractsForRank: number;
  national: { contracts: number; offices: number; value: number; at96Rate: number;
    wholePctRate: number; singleBidderRate: number; coordRate: number };
  offices: Office[];
};

const HOME = "Bulacan 1st DEO";
type SortKey = "at96Rate" | "singleBidderRate" | "coordRate" | "contracts" | "value" | "office";

const pct = (v: number | null) => v == null ? "—" : `${(v * 100).toFixed(1)}%`;
const peso = (v: number) =>
  v >= 1e12 ? `₱${(v / 1e12).toFixed(2)}T`
  : v >= 1e9 ? `₱${(v / 1e9).toFixed(1)}B`
  : v >= 1e6 ? `₱${(v / 1e6).toFixed(0)}M` : `₱${v.toFixed(0)}`;

export function NationwideScreen() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("at96Rate");
  const [onlyRankable, setOnlyRankable] = useState(true);
  const [why, setWhy] = useState(false);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return N.offices
      .filter(o => (!onlyRankable || o.rankable) &&
        (!t || o.office.toLowerCase().includes(t) || (o.region ?? "").toLowerCase().includes(t)))
      .sort((a, b) =>
        sort === "office" ? a.office.localeCompare(b.office)
        : sort === "contracts" ? b.contracts - a.contracts
        : sort === "value" ? b.value - a.value
        : ((b[sort] ?? -1) as number) - ((a[sort] ?? -1) as number));
  }, [q, sort, onlyRankable]);

  const home = N.offices.find(o => o.office === HOME);

  /** How far above the national rate an office sits, as a multiple. */
  const times = (v: number | null, base: number) => v == null ? null : v / base;

  return (
    <div className="flex-1 overflow-auto bg-gray-50" style={{ scrollbarWidth: "none" }}>
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-bold text-gray-900">Every district office, side by side</h1>
        <p className="text-[13px] text-gray-500">
          {N.national.contracts.toLocaleString()} flood-control contracts · {N.national.offices} district
          engineering offices · nationwide · {peso(N.national.value)} awarded
        </p>
      </div>

      <div className="p-6 space-y-5 max-w-7xl mx-auto">
        {/* The case-study answer: this is the distribution the rank came from. */}
        {home && (
          <div className="rounded border p-4"
            style={{ background: tint("#c0272d", 10), borderColor: tint("#c0272d", 34) }}>
            <div className="text-[12px] font-bold" style={{ color: accent("#c0272d") }}>
              Why this page exists
            </div>
            <p className="text-[13px] text-gray-700 leading-relaxed mt-1.5">
              This project studies one office. Saying <strong>{HOME}</strong> awards at exactly 96.00% of
              the approved budget on <strong>{pct(home.at96Rate)}</strong> of its priced contracts means
              nothing until you can see what every other office does. Nationally the rate
              is <strong>{pct(N.national.at96Rate)}</strong>.
            </p>
            <p className="text-[13px] text-gray-700 leading-relaxed mt-1.5">
              Ranked against the {N.offices.filter(o => o.rankable).length} offices with at least{" "}
              {N.minContractsForRank} priced contracts, {HOME} is{" "}
              <strong>number {home.rankAt96}</strong> — and the second-placed office is at{" "}
              {pct(N.offices.filter(o => o.rankable && o.rankAt96 === 2)[0]?.at96Rate ?? null)},
              less than half.
            </p>
            <p className="text-[11px] text-gray-500 mt-2">
              A statistical anomaly in a published record. It is not proof of anything, and nothing
              on this page says otherwise.
            </p>
          </div>
        )}

        <div className="grid grid-cols-4 gap-3">
          {[
            ["Awarded at exactly 96.00%", pct(N.national.at96Rate), "of priced contracts, nationwide"],
            ["Awarded at a whole percentage", pct(N.national.wholePctRate), "any whole number, not just 96"],
            ["Single bidder", pct(N.national.singleBidderRate), "no competing bid recorded"],
            ["Coordinates published", pct(N.national.coordRate), "locatable for any kind of checking"],
          ].map(([l, v, s]) => (
            <div key={l} className="bg-white rounded border border-gray-200 p-4">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{l}</div>
              <div className="font-mono font-bold text-2xl text-gray-900">{v}</div>
              <div className="text-[11px] text-gray-500 mt-1">{s}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-bold text-gray-700">Find your district</span>
            <div className="relative ml-auto">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={q} onChange={e => setQ(e.target.value)}
                placeholder="Cebu, Davao, Ilocos…"
                className="pl-7 pr-3 py-1.5 text-[12px] border border-gray-200 rounded bg-white text-gray-700 focus:outline-none focus:border-[#1e3a7b]"
                style={{ width: 220 }} />
            </div>
            <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
              className="text-[12px] border border-gray-200 rounded px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-[#1e3a7b]">
              <option value="at96Rate">Sort: share at exactly 96.00%</option>
              <option value="singleBidderRate">Sort: single-bidder share</option>
              <option value="coordRate">Sort: coordinates published</option>
              <option value="contracts">Sort: number of contracts</option>
              <option value="value">Sort: value awarded</option>
              <option value="office">Sort: name</option>
            </select>
            <button onClick={() => setOnlyRankable(v => !v)}
              title={`Offices with fewer than ${N.minContractsForRank} priced contracts produce rates too noisy to rank`}
              className={`text-[12px] px-2.5 py-1.5 rounded border ${onlyRankable ? "bg-[#1e3a7b] text-white border-[#1e3a7b]" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              Rankable only
            </button>
            <button onClick={() => setWhy(v => !v)} aria-label="What is compared, and what is not"
              className="text-gray-300 hover:text-[#1e3a7b]"><Info size={14} /></button>
          </div>

          {why && (
            <div className="px-4 py-3 border-b border-gray-100 text-[11px] text-gray-600 leading-relaxed">
              <p>{N.note}</p>
              <p className="mt-1.5 text-gray-500">Source: {N.source}. Built {N.generated.slice(0, 10)}.</p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-[12px] min-w-[820px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {["Rank", "District office", "Contracts", "Awarded", "At 96.00%", "Single bidder", "Has coordinates"]
                    .map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                        {h === "At 96.00%" ? <span className="flex items-center gap-1">{h}<ArrowUpDown size={9} /></span> : h}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(o => {
                  const mine = o.office === HOME;
                  const x = times(o.at96Rate, N.national.at96Rate);
                  return (
                    <tr key={o.office}
                      className={`border-b border-gray-50 ${mine ? "" : "hover:bg-gray-50"}`}
                      style={mine ? { background: tint("#c0272d", 12) } : undefined}>
                      <td className="px-4 py-2.5 font-mono text-gray-500">{o.rankAt96 ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className={mine ? "font-bold" : "text-gray-800"}
                          style={mine ? { color: accent("#c0272d") } : undefined}>
                          {o.office}
                        </span>
                        {mine && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-semibold"
                          style={{ background: tint("#c0272d", 22), color: accent("#c0272d") }}>this study</span>}
                        {o.region && <div className="text-[10px] text-gray-400">{o.region}</div>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-gray-600">{o.contracts.toLocaleString()}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-600">{peso(o.value)}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono font-semibold"
                          style={{ color: x && x >= 2 ? accent("#c0272d") : "var(--color-gray-700)" }}>
                          {pct(o.at96Rate)}
                        </span>
                        {x != null && x >= 2 && (
                          <span className="text-[10px] text-gray-400 ml-1.5">{x.toFixed(0)}× national</span>
                        )}
                        {!o.rankable && <span className="text-[10px] text-gray-400 ml-1.5">too few to rank</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-gray-600">{pct(o.singleBidderRate)}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-600">
                        <span className="flex items-center gap-1"><MapPin size={10} className="text-gray-300" />{pct(o.coordRate)}</span>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    Nothing matches “{q}”. Try a province name, or turn off “Rankable only”.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[11px] text-gray-400 leading-relaxed">
          <strong className="text-gray-500">Read this carefully.</strong> A high share of awards at a whole
          percentage of the ceiling is a pattern in a published record, and patterns have innocent
          explanations — a standard estimating practice, a template, a rounding convention. It is a
          reason to ask, and this page cannot tell you the answer. What it can tell you is that
          whatever the explanation is, it applies far more often at some offices than at others.
        </p>
      </div>
    </div>
  );
}
