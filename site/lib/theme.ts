/**
 * Reader themes: the two facts both the browser and React need to agree on.
 *
 * ADR-0002 asks for the dark theme to be the adult area's default and warm paper to be
 * the children's. That is a fact about the *address*, not about the reader's operating
 * system: a dark-mode laptop must not turn a bedtime story into an adult-looking page,
 * and a light-mode one must not make the 13+ shelf look like the children's library
 * (ADR-0002's third amendment). A stored choice still wins everywhere — the theme is an
 * accessibility setting before it is a brand marker.
 */
export const THEME_COLORS = {
  light: "#f7f2ea",
  sepia: "#efe4cc",
  dark: "#1c1815",
} as const;

export type ReaderTheme = keyof typeof THEME_COLORS;

export function isReaderTheme(value: string | null): value is ReaderTheme {
  return value === "light" || value === "sepia" || value === "dark";
}

/** The default a page brings, from its first URL segment (`/13+/...`, `/18+/...`). */
export function defaultThemeForPath(pathname: string): ReaderTheme {
  const segment = (pathname.split("/")[1] ?? "").replace(/%2B/i, "+");
  return segment === "13+" || segment === "18+" ? "dark" : "light";
}
