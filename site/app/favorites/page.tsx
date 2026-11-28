import type { Metadata } from "next";
import { FavoritesShelf, type FavCandidate } from "@/components/FavoritesShelf";
import { getEntries, getKidsEntries, type Entry } from "@/lib/content";
import { ADULT_ACK_SCRIPT } from "@/lib/gate";
import { isAdult } from "@/lib/tiers";

export const metadata: Metadata = {
  title: "Your favorites",
  description:
    "The stories you hearted, kept in this browser — no account, nothing sent anywhere.",
  alternates: { canonical: "/favorites/" },
  /*
   * Noindex on purpose. The shelf is a fact about one browser, so it has nothing
   * to say to a search engine — and unlike the gated shelves, its content is not
   * even known at build time.
   */
  robots: { index: false, follow: true },
};

/**
 * The favorites shelf (ADR-0016 A1). The server renders the shell and the
 * candidates; the client component reads `wt:favorites` and picks the cards.
 *
 * The kids' corpus travels with its summary (the same facts /browse/ ships);
 * the gated corpus travels slim — title, cover, address, tier — so the page
 * carries as little gated metadata as the shelf needs and no body text at all.
 * Nothing renders from either list until the browser says which slugs it saved.
 */
function candidate(entry: Entry, withSummary: boolean): FavCandidate {
  return {
    slug: entry.slug,
    title: entry.title,
    url: entry.url,
    cover: entry.cover,
    coverAlt: entry.coverAlt,
    ageTier: entry.ageTier,
    readingTime: entry.readingTime,
    genre: entry.genres[0],
    ...(withSummary && entry.summary ? { summary: entry.summary } : {}),
  };
}

export default function FavoritesPage() {
  const kids = getKidsEntries().map((entry) => candidate(entry, true));
  const gated = getEntries()
    .filter((entry) => isAdult(entry.ageTier))
    .map((entry) => candidate(entry, false));

  return (
    <div className="page">
      {/*
       * The gate's pre-paint script, rendered server-side (so the browser's parser
       * runs it — a client-inserted script tag never executes). Without it an
       * acknowledged adult's gated favorites would stay hidden: the section mounts
       * client-side, after hydration, and nobody else would set the fact on <html>.
       */}
      <script dangerouslySetInnerHTML={{ __html: ADULT_ACK_SCRIPT }} />
      <section className="section">
        <h1 className="lede">Your favorites</h1>
        <p className="lede__note">
          The stories you saved on this device. Favorites live in this browser — no
          account, nothing sent anywhere.
        </p>
        {/*
         * Without JavaScript there is no shelf: the favorites are a browser fact and
         * the cards are chosen client-side (ADR-0016's "the StoryWall pattern"). The
         * note is the honest empty answer, and the footer still carries the whole site.
         */}
        <noscript>
          <p className="empty">
            Favorites need JavaScript — they are kept in your browser, not on the site.
          </p>
        </noscript>
      </section>

      <FavoritesShelf kids={kids} gated={gated} />
    </div>
  );
}
