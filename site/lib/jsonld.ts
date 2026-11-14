import { absUrl, ogImagePath, SITE } from "./site";
import type { Entry } from "./content";
import type { AgeTier } from "./tiers";

type JsonLd = Record<string, unknown>;

/**
 * A tier as schema.org writes an age range.
 *
 * `typicalAgeRange` is the property search engines read for "stories for 8-12 year olds",
 * and schema.org's own convention for an open-ended range is a trailing hyphen: the tier
 * `13+` is `13-`. Our tier vocabulary is the product's, so the translation lives here
 * rather than in the frontmatter, where `13+` is what a generator writes (ADR-0001).
 */
function ageRange(tier: AgeTier): string {
  return tier.endsWith("+") ? `${tier.slice(0, -1)}-` : tier;
}

/**
 * The same tier as a schema.org `PeopleAudience`.
 *
 * `typicalAgeRange` is the string form and the one search engines read; `audience` is the
 * structured form a catalogue or reading app consumes. Both come from the one tier
 * vocabulary, so they cannot disagree (issue #113).
 */
function audienceFor(tier: AgeTier): { "@type": "PeopleAudience"; suggestedMinAge: number; suggestedMaxAge?: number } {
  const suggestedMinAge = Number(tier.split("-")[0]);
  return tier.endsWith("+")
    ? { "@type": "PeopleAudience", suggestedMinAge }
    : { "@type": "PeopleAudience", suggestedMinAge, suggestedMaxAge: Number(tier.split("-")[1]) };
}

/**
 * Article + BreadcrumbList only. Google has no rich result for Book (needs an
 * ISBN feed) or Audiobook, so claiming those types would be noise (D7).
 */
export function articleJsonLd(entry: Entry, opts: { section: string }): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: entry.title,
    description: entry.summary,
    // The social card first: 1200x630 is the shape Google asks an Article image to be, and
    // the portrait cover is the second candidate (issue #112).
    image: [absUrl(ogImagePath(entry.slug)), absUrl(entry.cover)],
    datePublished: entry.publishedAt,
    dateModified: entry.publishedAt,
    author: { "@type": "Organization", name: entry.byline },
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
    mainEntityOfPage: { "@type": "WebPage", "@id": absUrl(entry.url) },
    url: absUrl(entry.url),
    isAccessibleForFree: true,
    inLanguage: "en",
    typicalAgeRange: ageRange(entry.ageTier),
    audience: audienceFor(entry.ageTier),
    wordCount: entry.wordCount,
    timeRequired: `PT${entry.readingTime}M`,
    articleSection: opts.section,
    keywords: [...entry.genres, ...entry.themes].join(", "),
    /*
     * A retold classic states its source: `isBasedOn` is the property schema.org defines
     * for exactly this, and `about` carries the same fact for consumers that only read
     * that one. An original claims neither (issue #110).
     */
    ...(entry.sourceTale
      ? {
          about: { "@type": "CreativeWork", name: entry.sourceTale },
          isBasedOn: { "@type": "CreativeWork", name: entry.sourceTale },
        }
      : {}),
  };
}

export type Crumb = { name: string; path: string };

export function breadcrumbJsonLd(crumbs: Crumb[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absUrl(crumb.path),
    })),
  };
}

export function collectionJsonLd(opts: {
  name: string;
  description: string;
  path: string;
  entries: Entry[];
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    description: opts.description,
    url: absUrl(opts.path),
    isPartOf: { "@type": "WebSite", name: SITE.name, url: SITE.url },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: opts.entries.length,
      itemListElement: opts.entries.map((entry, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: entry.title,
        url: absUrl(entry.url),
      })),
    },
  };
}

export function websiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    inLanguage: "en",
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
  };
}
