import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { getKidsEntries } from "@/lib/content";
import { breadcrumbJsonLd, collectionJsonLd, type Crumb } from "@/lib/jsonld";
import { TIME_SHELVES, entriesForTimeShelf } from "@/lib/reading-time";

/**
 * How long a story takes is the second question after "who is it for", and until now the
 * answer was buried in the card meta. This is the hub for the two time shelves (issue #115).
 */
const entries = getKidsEntries();

export const metadata: Metadata = {
  title: "Stories by reading time, for 8-12 year olds",
  description:
    "Short stories sorted by how long they take to read aloud: under ten minutes for the end of the day, and twelve minutes and up when there is time for a proper sit-down.",
  alternates: { canonical: "/reading-time/" },
};

export default function ReadingTimeIndex() {
  const shelves = TIME_SHELVES.map((shelf) => ({ shelf, entries: entriesForTimeShelf(shelf, entries) })).filter(
    (item) => item.entries.length > 0,
  );

  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Reading time", path: "/reading-time/" },
  ];

  return (
    <div className="page">
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          collectionJsonLd({
            name: "Stories by reading time",
            description: "Stories sorted by how long they take to read.",
            path: "/reading-time/",
            entries: shelves.flatMap((item) => item.entries),
          }),
        ]}
      />

      <section className="section">
        <Breadcrumbs crumbs={crumbs} />
        <h1 className="lede" style={{ marginBlockStart: "var(--space-sm)" }}>
          By reading time
        </h1>
        <p className="lede__note">
          Every story on the site is one sitting long. These shelves are the two ends of that:
          the ones that finish before lights out, and the ones that want a proper sit-down.
        </p>
      </section>

      <section className="section section--tight">
        <ul className="entry-list">
          {shelves.map(({ shelf, entries: onShelf }) => (
            <li className="entry-list__item" key={shelf.slug}>
              <Link className="entry-list__link" href={"/reading-time/" + shelf.slug + "/"}>
                <span className="entry-list__meta">
                  {onShelf.length} {onShelf.length === 1 ? "story" : "stories"}
                </span>
                <span className="entry-list__title">{shelf.name}</span>
                <span className="entry-list__summary">{shelf.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
