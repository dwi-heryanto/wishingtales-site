"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdultGate } from "@/components/AdultGate";
import { FavoriteHeart } from "@/components/FavoriteHeart";
import { FAVORITES_EVENT, readFavorites, readReadSlugs } from "@/lib/guest-state";
import { ageLabel, genreLabel, readingLabel } from "@/lib/format";
import type { AgeTier } from "@/lib/tiers";

/**
 * What the shelf needs to render one card, and nothing more. Deliberately slim:
 * the whole corpus ships to this page as candidates, so a gated story travels
 * without its summary, and no story travels with its body — the exported HTML of
 * /favorites/ carries fewer words than /browse/ does.
 */
export type FavCandidate = {
  slug: string;
  title: string;
  url: string;
  cover: string;
  coverAlt: string;
  ageTier: AgeTier;
  readingTime: number;
  genre: string;
  summary?: string;
};

/**
 * The favorites shelf (ADR-0016 A1): the reader's hearted stories, read from
 * `wt:favorites` in this browser. The server renders the shell and the no-JS
 * note only — a favorite is a fact about the browser, so the exported HTML
 * cannot know what belongs here.
 *
 * Two sections by the gate rule: children's favorites render as ordinary cards;
 * hearted gated stories render only inside the `data-adult` wrapper, where the
 * AdultGate notice stands in front of them until this browser has answered it
 * (the same speed bump the story pages use, site-wide CSS). A reader who never
 * hearted a gated story never sees the notice at all, because the section does
 * not render — the gate is about the reader's own shelf, not a general ad.
 */
export function FavoritesShelf({ kids, gated }: { kids: FavCandidate[]; gated: FavCandidate[] }) {
  const [slugs, setSlugs] = useState<string[] | null>(null);

  useEffect(() => {
    const update = () => setSlugs(readFavorites());
    update();
    window.addEventListener(FAVORITES_EVENT, update);
    return () => window.removeEventListener(FAVORITES_EVENT, update);
  }, []);

  if (slugs === null) return null;
  if (slugs.length === 0) {
    return (
      <div className="fav__empty">
        <p className="empty">Nothing saved yet. Tap the heart on any story and it will wait for you here.</p>
      </div>
    );
  }

  const known = (candidates: FavCandidate[]) => {
    const bySlug = new Map(candidates.map((c) => [c.slug, c]));
    return slugs.map((slug) => bySlug.get(slug)).filter((c): c is FavCandidate => Boolean(c));
  };

  const kidsFavs = known(kids);
  const gatedFavs = known(gated);

  return (
    <>
      {kidsFavs.length > 0 ? (
        <section className="section section--tight" aria-labelledby="fav-kids-heading">
          <div className="section__head">
            <h2 className="section__title" id="fav-kids-heading">
              {kidsFavs.length === 1 ? "One story saved" : `${kidsFavs.length} stories saved`}
            </h2>
          </div>
          <div className="grid">
            {kidsFavs.map((candidate) => (
              <FavCard key={candidate.slug} candidate={candidate} />
            ))}
          </div>
        </section>
      ) : null}

      {gatedFavs.length > 0 ? (
        <section className="fav__gated" data-adult aria-labelledby="fav-gated-heading">
          <AdultGate what="shelf" />
          <div className="adult-gated">
            <div className="section__head">
              <h2 className="section__title" id="fav-gated-heading">
                Older favorites
              </h2>
            </div>
            <p className="lede__note">
              These are the stories outside the children&rsquo;s library that you saved on this device.
            </p>
            <div className="grid">
              {gatedFavs.map((candidate) => (
                <FavCard key={candidate.slug} candidate={candidate} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}

/**
 * The favorites card: the same classes and shape as a story card (so the shelf
 * looks like the rest of the site), rendered client-side from the slim
 * candidate because the full entry — body included — never ships to this page.
 */
function FavCard({ candidate }: { candidate: FavCandidate }) {
  /*
   * The read marker is this card's own fact: the GuestState island scans the DOM
   * once on load, before any client-rendered card exists, so a favorites card
   * marks itself instead.
   */
  const [read, setRead] = useState(false);
  useEffect(() => {
    setRead(readReadSlugs().includes(candidate.slug));
  }, [candidate.slug]);

  return (
    <article className={`card${read ? " card--read" : ""}`} data-wt-slug={candidate.slug}>
      <span className="card__cover">
        <img src={candidate.cover} alt={candidate.coverAlt} loading="lazy" width={256} height={384} />
        <span className="card__read" aria-hidden="true">
          ✓
        </span>
      </span>
      <p className="card__meta">
        <span className="chip-mini chip-mini--genre">{genreLabel(candidate.genre)}</span>
        <span className="chip-mini chip-mini--time">{readingLabel(candidate.readingTime)}</span>
      </p>
      <div className="card__head">
        <h3 className="card__title">
          <Link className="card__link" href={candidate.url}>
            {candidate.title}
          </Link>
        </h3>
        <span className="card__aside">
          <span className="card__age">{ageLabel(candidate.ageTier)}</span>
          <FavoriteHeart slug={candidate.slug} title={candidate.title} />
        </span>
      </div>
      {candidate.summary ? <p className="card__summary">{candidate.summary}</p> : null}
    </article>
  );
}
