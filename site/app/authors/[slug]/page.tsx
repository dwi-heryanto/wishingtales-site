import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { StoryCard } from "@/components/StoryCard";
import { AUTHOR_COLLECTIONS, entriesForCollection, storiesLabel } from "@/lib/authors";
import { getKidsClassics } from "@/lib/content";
import { breadcrumbJsonLd, collectionJsonLd, type Crumb } from "@/lib/jsonld";
import { minutesLabel, shelfDescription, shelfStats } from "@/lib/shelf-copy";

export const dynamicParams = false;

/**
 * One writer's shelf: every story of theirs the site has retold.
 *
 * The classics carry their source in the frontmatter, so this is a collection rather than a
 * new kind of content — and it answers the query a parent actually types ("grimm fairy
 * tales", "andersen stories for kids") instead of the title the site chose for a retelling
 * (issue #115).
 */
function collectionAt(slug: string) {
  const collection = AUTHOR_COLLECTIONS.find((candidate) => candidate.slug === slug);
  if (!collection) return undefined;
  const entries = entriesForCollection(collection, getKidsClassics());
  return entries.length > 0 ? { collection, entries } : undefined;
}

export function generateStaticParams() {
  return AUTHOR_COLLECTIONS.filter((collection) => collectionAt(collection.slug)).map((collection) => ({
    slug: collection.slug,
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const found = collectionAt(slug);
  if (!found) return {};
  return {
    title: "Fairy tales by " + found.collection.name + " for 8-12 year olds",
    description: shelfDescription(found.collection, shelfStats(found.entries)),
    alternates: { canonical: "/authors/" + found.collection.slug + "/" },
  };
}

export default async function AuthorCollectionRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = collectionAt(slug);
  if (!found) notFound();
  const { collection, entries } = found;
  const stats = shelfStats(entries);

  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Authors", path: "/authors/" },
    { name: collection.name, path: "/authors/" + collection.slug + "/" },
  ];

  return (
    <div className="page">
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          collectionJsonLd({
            name: collection.name,
            description: collection.summary,
            path: "/authors/" + collection.slug + "/",
            entries,
          }),
        ]}
      />

      <section className="section">
        <Breadcrumbs crumbs={crumbs} />
        <h1 className="lede" style={{ marginBlockStart: "var(--space-sm)" }}>
          {collection.name}
        </h1>
        <p className="lede__note">{collection.body}</p>
        <p className="shelf-facts">
          {storiesLabel(entries.length)} retold here, {minutesLabel(stats.min, stats.max)} each — read
          aloud or read alone.
        </p>
      </section>

      <section className="section section--tight" aria-label={"Stories by " + collection.name}>
        <div className="grid">
          {entries.map((entry) => (
            <StoryCard key={entry.slug} entry={entry} level={2} />
          ))}
        </div>
      </section>
    </div>
  );
}
