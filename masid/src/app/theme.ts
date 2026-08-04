/**
 * The theme engine.
 *
 * Three states, not two. "System" is the default and it is not the same thing
 * as light: it follows the operating system and keeps following it, so a reader
 * whose machine turns dark at sunset gets a dark dashboard at sunset without
 * having told this app anything. Light and dark are explicit overrides that
 * stop tracking the system until cleared.
 *
 * WHY THIS IS A TOKEN LAYER AND NOT A THOUSAND `dark:` CLASSES. Tailwind v4
 * compiles every colour utility to a custom property — `bg-gray-50` becomes
 * `background-color: var(--color-gray-50)`. That means the entire palette of an
 * app this size can be redefined in one stylesheet under one class, and every
 * card, border, table stripe and label follows without being touched. Adding
 * `dark:` variants to ~2,000 class occurrences would have been the same result
 * reached by hand, with a permanent obligation to remember the variant on every
 * future line. See src/styles/dark.css for the tokens themselves.
 *
 * The one thing the engine does NOT do is invert. A good dark interface is not
 * a photographic negative of a light one: surfaces get lifted rather than
 * flipped, borders lose contrast rather than gain it, and saturated brand colour
 * has to be re-picked because navy on near-black is unreadable. Those choices
 * live in the stylesheet, chosen rather than computed.
 */

export type Theme = "light" | "dark" | "system";

const KEY = "masid.theme.v1";

/** What the OS is asking for right now. */
export const systemPrefersDark = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-color-scheme: dark)").matches === true;

/** The stored choice, or "system" when there is none or it is unreadable. */
export function loadTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "system";
  } catch { return "system"; }
}

export function saveTheme(t: Theme) {
  try { localStorage.setItem(KEY, t); } catch { /* private mode; the session still works */ }
}

/** The theme actually in force once "system" is resolved. */
export const resolveTheme = (t: Theme): "light" | "dark" =>
  t === "system" ? (systemPrefersDark() ? "dark" : "light") : t;

/**
 * Put the resolved theme on <html>.
 *
 * `.dark` is the class Tailwind's variant already keys off in this project, and
 * `color-scheme` is what makes the browser's own furniture follow — scrollbars,
 * form controls, the flash of background before paint. Without it a dark page
 * still gets a white scrollbar and a white date picker.
 */
export function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(t);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
}

/**
 * Follow the OS while the choice is "system".
 *
 * Returns its own unsubscribe. The listener is attached regardless of the
 * current choice and checks at fire time, so switching to "system" during a
 * session starts tracking immediately rather than at the next reload.
 */
export function watchSystem(get: () => Theme): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => { if (get() === "system") applyTheme("system"); };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Two helpers that make a semantic colour work on either surface.
 *
 * This app carries about a dozen status palettes — verdicts, review outcomes,
 * report states, flag severities — each a baked pair of a pale background and a
 * saturated ink: `{ bg: "#e6f2e6", color: "#046b04" }`. Those pairs are correct
 * on white and wrong on everything else: the pale background stays bright on a
 * dark card, and the dark ink on it stops being legible the moment surrounding
 * text lightens. The satellite screen's "this tier does not work" banner failed
 * exactly this way — a pink panel whose body copy turned pale and vanished.
 *
 * Rather than a second palette per theme, which doubles every future colour
 * decision and drifts, both are DERIVED from the one saturated colour:
 *
 *   tint(c)   the background — c mixed into whatever the current surface is
 *   accent(c) the ink        — c on white, a lightened c on dark
 *
 * Both compile to `color-mix`, so the browser re-evaluates them the instant the
 * root class changes. No JavaScript runs, nothing re-renders, and a chip added
 * next year is theme-correct without its author thinking about themes at all.
 */
export const tint = (color: string, pct = 14) =>
  `color-mix(in srgb, ${color} ${pct}%, var(--masid-surface))`;

export const accent = (color: string) =>
  `color-mix(in srgb, var(--masid-accent-mix) var(--masid-accent-amt), ${color})`;

/**
 * Colours for things that cannot read CSS.
 *
 * Recharts takes stroke and fill as props, and Leaflet paints into a canvas or
 * an SVG it owns — neither picks up a custom property from a class. Anything in
 * that position reads its colour from here instead, so there is still exactly
 * one place where a theme's colours are decided.
 */
export const CHART = {
  light: {
    grid: "#f1f5f9",
    axis: "#94a3b8",
    axisStrong: "#64748b",
    tooltipBg: "#ffffff",
    tooltipBorder: "#e2e8f0",
    tooltipInk: "#0f172a",
    mapVoid: "#f2f2f0",
  },
  dark: {
    // A grid you can find but never read first. On near-black, #f1f5f9 lines
    // read as the brightest thing on the card and the bars disappear behind
    // their own gridlines.
    grid: "#252c37",
    axis: "#7c8797",
    axisStrong: "#9aa5b4",
    tooltipBg: "#1b212b",
    tooltipBorder: "#333c4a",
    tooltipInk: "#e8ecf1",
    mapVoid: "#0d1015",
  },
} as const;

export type ChartColors = typeof CHART.light;
