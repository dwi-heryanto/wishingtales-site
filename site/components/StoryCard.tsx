import Link from "next/link";
import { CoverImage } from "@/components/CoverImage";
import type { Entry } from "@/lib/content";
import { secondName } from "@/lib/retold";
import { ageLabel, genreLabel, readingLabel } from "@/lib/format";

/**
 * `seriesTitle` is optional because series membership is: on a shelf that holds both,
 * the caller passes the series title for an episode and nothing for a standalone story.
 */
export function StoryCard({
  entry,
  seriesTitle,
  offpage = false,
  level = 3,
}: {
  entry: Entry;
  seriesTitle?: string;
  /** Set by the wall for cards beyond the current page or filtered out: they stay in
      the DOM (hidden) so no-JS readers and link checks see the whole library. */
  offpage?: boolean;
  /**
   * The card title's heading level. 3 under a section heading ("Every story"), 2 on a
   * page whose only other heading is the h1 and whose cards *are* the page — a theme,
   * a reading-time shelf, a writer's collection. Without this the outline jumped
   * h1 → h3 on those pages (verify-build checks for exactly that).
   */
  level?: 2 | 3;
}) {
  const Title = level === 2 ? "h2" : "h3";
  /*
   * Built from what is actually known, so a standalone story cannot pick up a series
   * label it has no right to. The old code did the opposite — `seriesTitle ?? "Series"`
   * printed the word "Series" on every standalone card, which promised a series with no
   * name and a part that never arrives (ADR-0004).
   *
   * The genre rides on the card because it is the classification a reader chooses on —
   * "something spooky" is a request — and it is the one the story's address names
   * (site/lib/urls.ts), so the shelf a reader taps and the word on the card agree.
   */
  const meta = [
    entry.kind === "classic" ? "Retold classic" : seriesTitle,
    seriesTitle && entry.seriesOrder ? `Part ${entry.seriesOrder}` : undefined,
    genreLabel(entry.genres[0]),
    readingLabel(entry.readingTime),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    /*
     * An article, not an anchor (ADR-0009). The card used to be one big <a>, so its
     * accessible name was the cover alt, the meta line, the title, the age and the whole
     * summary — a paragraph per link. The title is the link now, and its ::after overlay
     * (globals.css) makes the rest of the card clickable without joining the link name.
     *
     * The cover stays outside the anchor on purpose. D10 makes `coverAlt` the only
     * description of a generated illustration a screen reader gets; alt="" — the audit's
     * suggestion — would have deleted it to shorten a name that is already short.
     */
    <article className={`card${offpage ? " card--offpage" : ""}`}>
      <span className="card__cover">
        {/* A card is drawn between 8.5rem and 12rem wide, depending on the grid it is in. */}
        <CoverImage entry={entry} sizes="(min-width: 40rem) 12rem, 45vw" />
      </span>
      <p className="card__meta">{meta}</p>
      <div className="card__head">
        <Title className="card__title">
          <Link className="card__link" href={entry.url}>
            {entry.title}
          </Link>
        </Title>
        {/* The age sits beside the title because it is what a reader chooses on. It is
            outside the heading so the link name stays the title and nothing else. */}
        <span className="card__age">{ageLabel(entry.ageTier)}</span>
      </div>
      <p className="card__summary">{entry.summary}</p>
      {/*
        * The second name of a retold classic: the tale a reader (or a parent) may know it
        * by. The audit's finding — "The Lamp in the Hill is Aladdin, and nothing says so" —
        * was already answered on the story page and in the metadata; the card is where a
        * reader is choosing, so it belongs here too. Outside the anchor, so the link name
        * stays the retold title; and secondName keeps a classic that carries the tale's
        * own title from saying it under itself.
        */}
      {secondName(entry) ? (
        <p className="card__source">Retold from {secondName(entry)}</p>
      ) : null}
    </article>
  );
}
