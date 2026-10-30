import { SITE } from "./site";
import type { AgeTier } from "./tiers";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** publishedAt is a plain date; format it in UTC so no timezone shifts the day. */
export function formatDate(isoDate: string): string {
  return dateFormatter.format(new Date(`${isoDate}T00:00:00Z`));
}

export function readingLabel(minutes: number): string {
  return `${minutes} min read`;
}

/**
 * The shelf promise in words a parent reads at a glance: "Ages 8-12".
 *
 * Derived from the tier, never typed out per component — a retiered story or a fifth
 * tier then changes the label everywhere at once, and no page can quietly promise the
 * wrong age (ADR-0001). The `13+` and `18+` tiers read the same way, so the adult
 * shelves need no special case here; what they need is the gate, which is a separate
 * decision (ADR-0002).
 */
export function ageLabel(tier: AgeTier): string {
  return `Ages ${tier}`;
}

/**
 * A genre as a shelf heading and a breadcrumb: the vocabulary's own words, first letter
 * up — "folk tale" becomes "Folk tale".
 *
 * Not title case: the vocabulary is deliberately sentence-like (`animal story`, `slice of
 * life`), and capitalising every word would print "Animal Story", which is a different
 * promise in a different voice. Derived here for the same reason `ageLabel` is: the words
 * on a shelf heading and the words in a breadcrumb should not be able to disagree.
 */
export function genreLabel(genre: string): string {
  return genre.charAt(0).toUpperCase() + genre.slice(1);
}

export function wordLabel(words: number): string {
  return `${words.toLocaleString("en-GB")} words`;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

export function absolute(path: string): string {
  return `${SITE.url}${path}`;
}
