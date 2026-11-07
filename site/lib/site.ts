/**
 * Site-wide constants. Everything that would otherwise be hard-coded in a
 * component lives here so the legal pages, RSS feed, and JSON-LD agree.
 */
export const SITE = {
  name: "WishingTales",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://wishingtales.pages.dev").replace(/\/$/, ""),
  /**
   * The brand line, and it is deliberately wider than "bedtime stories".
   *
   * A story here is read aloud by a parent, read alone by a child, or read by an adult
   * who wants something short — the three readers the library is designed around. Naming
   * only one of them, and naming only one age, described a different and much smaller
   * product. See GLOSSARY.md.
   */
  tagline: "Stories to read aloud, or read alone",
  description:
    "Short stories to read aloud, or read alone — bedtime tales for ages 8 to 12, longer stories for older readers, and retold classics. Free, no accounts, no ads.",
  byline: "WishingTales",
  /**
   * A working contact address, or "" until one exists. Deliberately not
   * defaulted to the future domain: publishing an address on a mailbox nobody
   * owns means the mail bounces, or a stranger registers the domain and starts
   * receiving it. Set NEXT_PUBLIC_CONTACT_EMAIL — any address you control will
   * do, it does not need the domain.
   */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "",
  /** Cloudflare Web Analytics beacon. Empty string = no analytics script at all. */
  beaconToken: process.env.NEXT_PUBLIC_CF_BEACON_TOKEN ?? "",
} as const;

/** Reading pace used to turn a word count into a "minutes" figure (D1: 140–170 wpm). */
export const WORDS_PER_MINUTE = 155;

/** Readers at the top of the band should get one sitting, not a marathon. */
export const READING_TIME_BAND = { min: 7, max: 15 } as const;

export function readingTimeFor(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
}

/**
 * The 1200x630 social card for a story.
 *
 * A shared link used to carry the 512x768 cover, which every platform crops; the card is
 * built at build time by scripts/build-og-images.mjs, so this is only the address of it
 * (issue #112).
 */
export function ogImagePath(slug: string): string {
  return "/og/" + slug + ".jpg";
}

/** Absolute URL, for canonicals, JSON-LD, RSS and OG tags. */
export function absUrl(path: string): string {
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}
