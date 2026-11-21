/**
 * Reader themes: the facts both the browser and React need to agree on.
 *
 * ADR-0002 asks for the adult area's default to be its own theme and warm paper to be
 * the children's. That is a fact about the *address*, not about the reader's operating
 * system: a dark-mode laptop must not turn a bedtime story into an adult-looking page,
 * and a light-mode one must not make the 13+ shelf look like the children's library
 * (ADR-0002's third amendment). A stored choice still wins everywhere — the theme is an
 * accessibility setting before it is a brand marker.
 *
 * The adult default is **dusk**, not dark (ADR-0002's fourth amendment, issue #208): the
 * same warm hue family lifted out of near-black, so leaving the children's library reads
 * as "evening room" rather than as a different website. Dark stays available — every
 * theme is — it just is not what the address hands you any more.
 */
export const THEME_COLORS = {
  light: "#f7f2ea",
  sepia: "#efe4cc",
  dusk: "#392a20",
  dark: "#1c1815",
} as const;

export type ReaderTheme = keyof typeof THEME_COLORS;

export function isReaderTheme(value: string | null): value is ReaderTheme {
  return value === "light" || value === "sepia" || value === "dusk" || value === "dark";
}

/** The default a page brings, from its first URL segment (`/13+/...`, `/18+/...`). */
export function defaultThemeForPath(pathname: string): ReaderTheme {
  const segment = (pathname.split("/")[1] ?? "").replace(/%2B/i, "+");
  return segment === "13+" || segment === "18+" ? "dusk" : "light";
}
