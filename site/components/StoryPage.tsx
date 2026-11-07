import Link from "next/link";
import { AdSlot } from "@/components/AdSlot";
import { AdultGate } from "@/components/AdultGate";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CoverImage } from "@/components/CoverImage";
import { collectionFor } from "@/lib/authors";
import { JsonLd } from "@/components/JsonLd";
import { ReaderControls } from "@/components/ReaderControls";
import { ReadingProgress } from "@/components/ReadingProgress";
import type { Entry, SeriesHub } from "@/lib/content";
import { secondName } from "@/lib/retold";
import { ageLabel, formatDate, genreLabel, readingLabel, wordLabel } from "@/lib/format";
import { articleJsonLd, breadcrumbJsonLd, type Crumb } from "@/lib/jsonld";
import { StoryProse } from "@/lib/markdown";
import { StoryAudio } from "@/components/StoryAudio";
import { isAdult } from "@/lib/tiers";
import { tierGenrePath } from "@/lib/urls";

type Props = {
  entry: Entry;
  crumbs: Crumb[];
  section: string;
  seriesHub?: SeriesHub;
  /** The story before this one on the same shelf, when there is one (issue #113). */
  previousEntry?: Entry;
  /** A second story on the shelf, for the end-of-shelf pages that have only one neighbour. */
  alsoEntry?: Entry;
  nextEntry?: Entry;
  /** A story of about the same length, for "read another ten-minute one" (ADR-0009). */
  timeSibling?: Entry;
};

export function StoryPage({
  entry,
  crumbs,
  section,
  seriesHub,
  previousEntry,
  alsoEntry,
  nextEntry,
  timeSibling,
}: Props) {
  const isClassic = entry.kind === "classic";
  /*
   * Read from the story's own frontmatter, never from the address it was reached by
   * (ADR-0002): the gate travels with the story, so wherever an older-tier story ends up
   * living, this line is what decides whether a reader sees a notice first.
   */
  const adult = isAdult(entry.ageTier);

  /*
   * The line above the title says three things and only the ones that are true: which
   * shelf this is from, where it sits when it is an episode, and who it is for. A
   * standalone story therefore reads "Story · Ages 8-12" — no empty series name and no
   * "Part 1" for a part two that does not exist (ADR-0004). The part number waits for a
   * hub to name, so a dangling series reference cannot print an orphan part either.
   */
  const shelf = isClassic ? "Retold classic" : (seriesHub?.title ?? "Story");
  /* The writer's collection page, when the site has one for them (issue #115). */
  const authorCollection = collectionFor(entry);
  const eyebrow = [
    shelf,
    seriesHub && entry.seriesOrder ? `Part ${entry.seriesOrder}` : undefined,
    /* The genre, because it is what the card promised and what the breadcrumb names. */
    genreLabel(entry.genres[0]),
    ageLabel(entry.ageTier),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="page reader" data-adult={adult ? "" : undefined}>
      {/*
       * The notice is a sibling of the story rather than an overlay on it, and the story
       * is hidden by CSS until the reader answers. That ordering is what keeps the story
       * out of the first paint; the story itself still ships in this HTML, which is the
       * speed bump ADR-0002 describes.
       */}
      {adult ? <AdultGate what="story" /> : null}
      <div className="adult-gated">
        <ReadingProgress slug={entry.slug} title={entry.title} url={entry.url} />
        <JsonLd data={[articleJsonLd(entry, { section }), breadcrumbJsonLd(crumbs)]} />

        <div className="reader__head">
          <Breadcrumbs crumbs={crumbs} />
          <p className="eyebrow" style={{ marginBlockStart: "var(--space-sm)" }}>
            {eyebrow}
          </p>
          <h1 className="reader__title">{entry.title}</h1>
          {/*
            * The second name of a retold classic, right under its title, linking to the
            * provenance block that spells it out. The title is the story's own; this line
            * is the name a reader (and a search engine) may know it by (issue #110). A
            * classic that keeps the tale's own title answers to one name, and the line
            * would be that name a second time, so it stays away there as well.
            */}
          {secondName(entry) ? (
            <p className="reader__retelling">
              A retelling of <a href="#provenance-heading">{entry.sourceTale}</a>
            </p>
          ) : null}
          <p className="reader__summary">{entry.summary}</p>
          <div className="reader__meta">
            <span>{entry.byline}</span>
            <span>{formatDate(entry.publishedAt)}</span>
            <span>{readingLabel(entry.readingTime)}</span>
            <span>{wordLabel(entry.wordCount)}</span>
          </div>
        </div>

        {!adult && entry.audio ? (
          <StoryAudio
            slug={entry.slug}
            title={entry.title}
            seconds={entry.audio.seconds}
            cover={entry.cover}
          />
        ) : null}

        <ReaderControls defaultTheme={adult ? "dark" : undefined} />

        <figure className="reader__figure">
          {/*
            * The reader's figure is the largest paint on a story page: eager and high
            * priority, and drawn at up to 22rem (352px), so it takes the 512 variant on a
            * high-density phone and the 256 one on a laptop (issue #114).
            */}
          <CoverImage entry={entry} sizes="(min-width: 40rem) 22rem, 92vw" priority />
          {/*
            * No figcaption. It printed `entry.coverAlt` a second time, so a screen reader
            * announced the same 137-character description twice and a phone pushed the first
            * paragraph below a paragraph of alt text. The image's `alt` is still the
            * description; the visible page no longer repeats it (ADR-0009).
            */}
        </figure>

        <StoryProse markdown={entry.body} />

        <div className="reader__end">
          <p className="reader__end-note">
            Written with an AI writing tool and checked automatically before publishing.{" "}
            <Link href="/about/#how-we-make-stories">How we make stories</Link>.
          </p>

          {entry.provenance ? (
            <section className="provenance" aria-labelledby="provenance-heading">
              <h2 className="section__title" id="provenance-heading" style={{ marginBlockStart: "var(--space-md)" }}>
                Where this story comes from
              </h2>
              <dl>
                <dt>Retold from</dt>
                <dd>{entry.provenance.source}</dd>
                <dt>Author</dt>
                <dd>
                  {entry.provenance.author} (d. {entry.provenance.deathYear})
                </dd>
                <dt>First published</dt>
                <dd>{entry.provenance.firstPublished}</dd>
                <dt>Edition used</dt>
                <dd>{entry.provenance.edition}</dd>
                <dt>Public domain because</dt>
                <dd>{entry.provenance.pdBasis}</dd>
                <dt>Checked</dt>
                <dd>{entry.provenance.verifiedOn}</dd>
                {entry.provenance.notes ? (
                  <>
                    <dt>Notes</dt>
                    <dd>{entry.provenance.notes}</dd>
                  </>
                ) : null}
              </dl>
              <p className="reader__end-note" style={{ marginBlockStart: "var(--space-sm)" }}>
                This is a retelling in new words, not a copy of the original text. See{" "}
                <Link href="/sources/">sources</Link> for every classic on the site
                {authorCollection ? (
                  <>
                    , or every story here by{" "}
                    <Link href={"/authors/" + authorCollection.slug + "/"}>{authorCollection.name}</Link>
                  </>
                ) : null}
                .
              </p>
            </section>
          ) : null}

          {/*
            * The stories either side on this shelf, which is how a reader moves along it and
            * how a crawler finds the next row without going back to an index (issue #113).
            * The series case reads as parts, because that is what "next" means there.
            */}
          {previousEntry ? (
            <div className="next-up">
              <span className="eyebrow">
                {entry.series && previousEntry.seriesOrder ? `Part ${previousEntry.seriesOrder}` : "Previous on this shelf"}
              </span>
              <Link href={previousEntry.url}>{previousEntry.title}</Link>
            </div>
          ) : null}

          {alsoEntry ? (
            <div className="next-up">
              <span className="eyebrow">Also on this shelf</span>
              <Link href={alsoEntry.url}>{alsoEntry.title}</Link>
            </div>
          ) : null}
          {nextEntry ? (
            <div className="next-up">
              <span className="eyebrow">
                {entry.series && nextEntry.seriesOrder ? `Part ${nextEntry.seriesOrder}` : "Next"}
              </span>
              <Link href={nextEntry.url}>{nextEntry.title}</Link>
            </div>
          ) : null}

          {/*
           * The shelf the story is actually on, not the collection it belongs to: a reader
           * who has just finished a spooky story wants another spooky one, and until now
           * the only offer at the end of a story was "all classics" or "all stories" —
           * the one link there that ignored what the story was. Kept alongside "Next"
           * rather than instead of it, because the next story is usually a different
           * genre and the shelf is the answer to "more like this".
           */}
          <div className="next-up">
            <span className="eyebrow">More like this</span>
            <Link href={tierGenrePath(entry.ageTier, entry.genres[0])}>
              {genreLabel(entry.genres[0])} stories for {ageLabel(entry.ageTier).toLowerCase()}
            </Link>
            <Link className="next-up__all" href="/browse/">
              All stories
            </Link>
          </div>

          {/*
            * The bedtime question, answered from the one number every story already carries.
            * "More like this" answers the shelf; this answers "have you got another ten-minute
            * one?" (ADR-0009).
            */}
          {timeSibling ? (
            <div className="next-up">
              <span className="eyebrow">Another {timeSibling.readingTime}-minute story</span>
              <Link href={timeSibling.url}>{timeSibling.title}</Link>
            </div>
          ) : null}

          <AdSlot name="story-end" />
        </div>
      </div>
    </article>
  );
}
