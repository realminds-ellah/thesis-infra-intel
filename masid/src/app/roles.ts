/** Shared role type — lives here so filters and the app can both import it
 *  without either depending on the other. */
export type Role =
  | "dpwh-admin" | "dpwh-engineer" | "field-inspector"
  | "psa-analyst" | "lgu-coordinator" | "public";
