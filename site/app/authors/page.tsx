import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { AUTHOR_COLLECTIONS, entriesForCollection, storiesLabel } from "@/lib/authors";
import { getKidsClassics } from "@/lib/content";
import { breadcrumbJsonLd, collectionJsonLd, type Crumb } from "@/lib/jsonld";

/**
 * The writers behind the retold classics.
 *
 * A hub for the collections, and a page a parent can land on from "grimm fairy tales": the
 * three writers who hold most of the classic shelf, each with the number of stories behind
 * the link. The thin authors — one story each — are deliberately not here yet (issue #115).
 */
const classics = getKidsClassics();

export const metadata: Metadata = {
  title: "Fairy tale authors, retold for 8-12 year olds",
  description:
    "The writers behind the retold classics — the Brothers Grimm, Hans Christian Andersen and Andrew Lang — and every story of theirs on the site, for readers of eight to twelve.",
  alternates: { canonical: "/authors/" },
};

export default function AuthorsIndex() {
  const collections = AUTHOR_COLLECTIONS.map((collection) => ({
    collection,
    entries: entriesForCollection(collection, classics),
  })).filter((item) => item.entries.length > 0);

  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Authors", path: "/authors/" },
  ];

  return (
    <div className="page">
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          collectionJsonLd({
            name: "Fairy tale authors",
            description: "The writers whose tales are retold in the WishingTales library.",
            path: "/authors/",
            entries: collections.flatMap((item) => item.entries),
          }),
        ]}
      />

      <section className="section">
        <Breadcrumbs crumbs={crumbs} />
        <h1 className="lede" style={{ marginBlockStart: "var(--space-sm)" }}>
          Authors
        </h1>
        <p className="lede__note">
          The retold classics come from fifteen writers. These three hold most of the shelf,
          and each has a page of their own: every story of theirs on the site, in one place.
        </p>
      </section>

      <section className="section section--tight">
        <ul className="entry-list">
          {collections.map(({ collection, entries }) => (
            <li className="entry-list__item" key={collection.slug}>
              <Link className="entry-list__link" href={"/authors/" + collection.slug + "/"}>
                <span className="entry-list__meta">{storiesLabel(entries.length)}</span>
                <span className="entry-list__title">{collection.name}</span>
                <span className="entry-list__summary">{collection.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
