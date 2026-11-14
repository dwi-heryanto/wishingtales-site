import Link from "next/link";
import { CoverImage } from "@/components/CoverImage";
import type { Entry } from "@/lib/content";
import { ageLabel, readingLabel } from "@/lib/format";

/**
 * The shelf story list, with the cover on every row.
 *
 * Covers were added because the shelf was the one browse surface that hid them: children
 * choose by cover, not by title (ICDL interface research and the studies cited in
 * docs/ui-research-notes.md), and the card grids already knew it. The thumbnail reuses
 * the same 512x768 image as the cards; series rows elsewhere keep the text-only layout
 * because a hub has no cover of its own yet.
 */
export function EntryList({ entries, emptyNote }: { entries: Entry[]; emptyNote: string }) {
  if (entries.length === 0) {
    return <p className="empty">{emptyNote}</p>;
  }

  return (
    <ul className="entry-list">
      {entries.map((entry) => (
        <li className="entry-list__item" key={entry.slug}>
          <Link className="entry-list__link entry-list__link--cover" href={entry.url}>
            <span className="entry-list__cover">
              {/* The thumbnail is 4.5rem on a phone and 6rem from 40rem up. */}
              <CoverImage entry={entry} sizes="(min-width: 40rem) 6rem, 4.5rem" />
            </span>
            {/*
              * Age and reading time, and no publish date: a parent choosing tonight's story
              * needs to know whether it fits, and "18 October 2026" does not help them. The
              * date still lives on the story page, where provenance matters (UI audit,
              * finding 4).
              */}
            <span className="entry-list__meta">
              {ageLabel(entry.ageTier)} · {readingLabel(entry.readingTime)}
            </span>
            <span className="entry-list__title">{entry.title}</span>
            <span className="entry-list__summary">{entry.summary}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
