/**
 * What each role sees in the filter panel.
 *
 * The six roles in this app do genuinely different jobs, and a single filter
 * panel that serves all of them serves none of them well. A resident wants to
 * know whether the thing outside their house is finished. A field inspector
 * wants a list of sites worth driving to. A PSA analyst wants imagery coverage.
 * Showing all three every group is how transparency tools end up looking like
 * database front-ends.
 *
 * So each role gets: which groups appear and in what order, which quick
 * questions are offered, what the map colours by first, and how blunt the
 * language is.
 *
 * Two rules held throughout:
 *
 *  - Roles change what is SHOWN FIRST, never what is available. Every group can
 *    still be opened from "More filters", because hiding public spending data
 *    from someone because of their job title is the opposite of the point.
 *  - Nobody sees a different NUMBER. Counts, flags and totals are identical for
 *    every role; only the arrangement and the wording change.
 */

import type { Role } from "./roles";

export type GroupKey =
  | "where" | "finished" | "problems" | "cost" | "awarded"
  | "flood" | "documents" | "mappable" | "imagery" | "year";

export interface RoleView {
  /** Shown, in this order, expanded until `openCount` is reached. */
  groups: GroupKey[];
  openCount: number;
  /** Preset keys offered, in order. */
  presets: string[];
  /** What the map colours by before the user touches anything. */
  defaultEncoding: string;
  /** One line under the panel title saying what this view is for. */
  blurb: string;
}

const ALL: GroupKey[] = ["where", "finished", "problems", "cost", "awarded",
  "flood", "documents", "mappable", "imagery", "year"];

export const ROLE_VIEWS: Record<Role, RoleView> = {
  // A resident checking the project on their street. Plain questions, nothing
  // procedural, and the map coloured by whether anything is wrong.
  public: {
    groups: ["where", "finished", "problems", "cost", "flood", "documents", "awarded", "mappable", "year"],
    openCount: 3,
    presets: ["problems", "attention", "rebuilt", "nodocs", "at96", "offhazard"],
    defaultEncoding: "priority",
    blurb: "Look up the projects near you and what, if anything, looks wrong with them.",
  },

  // Works a municipality. Their own patch first, then delivery and flood risk —
  // the two things an LGU is asked about at barangay meetings.
  "lgu-coordinator": {
    groups: ["where", "finished", "flood", "problems", "cost", "documents", "awarded", "mappable", "year"],
    openCount: 3,
    presets: ["attention", "rebuilt", "offhazard", "problems", "nodocs"],
    defaultEncoding: "delivery",
    blurb: "Track delivery across your municipalities, including flood exposure.",
  },

  // Builds a day's route. The only question that matters first is whether the
  // site can be found at all, then whether it is worth the trip.
  "field-inspector": {
    groups: ["mappable", "finished", "where", "problems", "documents", "flood", "imagery", "cost", "year"],
    openCount: 3,
    presets: ["badcoord", "rebuilt", "attention", "problems", "nodocs"],
    defaultEncoding: "delivery",
    blurb: "Build a site-visit list. Start with what can actually be located on the ground.",
  },

  // Contract administration: schedule, progress, paperwork.
  "dpwh-engineer": {
    groups: ["finished", "where", "cost", "documents", "problems", "awarded", "mappable", "flood", "year"],
    openCount: 3,
    presets: ["attention", "nodocs", "rebuilt", "problems"],
    defaultEncoding: "delivery",
    blurb: "Contract delivery: schedule, progress and documentation.",
  },

  // Oversight across the whole register, procurement included.
  "dpwh-admin": {
    groups: ALL,
    openCount: 3,
    presets: ["problems", "at96", "nocomp", "attention", "rebuilt", "badcoord", "nodocs", "offhazard"],
    defaultEncoding: "priority",
    blurb: "Full register, including how contracts were awarded.",
  },

  // Imagery first, then the coordinate quality that decides whether imagery can
  // say anything at all.
  "psa-analyst": {
    groups: ["imagery", "mappable", "where", "flood", "finished", "problems", "cost", "awarded", "documents", "year"],
    openCount: 3,
    presets: ["badcoord", "problems", "rebuilt", "offhazard"],
    defaultEncoding: "hazard",
    blurb: "Imagery coverage and coordinate quality across the register.",
  },
};

export const GROUP_TITLES: Record<GroupKey, string> = {
  where: "Where is it?",
  finished: "Is it finished?",
  problems: "What might be wrong?",
  cost: "How much did it cost?",
  awarded: "How was it awarded?",
  flood: "Is it in a flood-prone area?",
  documents: "Are the documents published?",
  mappable: "Can it be found on a map?",
  imagery: "Satellite imagery",
  year: "What year?",
};
