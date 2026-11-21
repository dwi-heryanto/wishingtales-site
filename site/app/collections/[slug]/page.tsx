import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { StoryCard } from "@/components/StoryCard";
import { getKidsEntries } from "@/lib/content";
import { breadcrumbJsonLd, collectionJsonLd, type Crumb } from "@/lib/jsonld";
import { COLLECTIONS, entriesForCollection } from "@/lib/collections";
import { minutesLabel, shelfDescription, shelfStats } from "@/lib/shelf-copy";

export const dynamicParams = false;

function collectionAt(slug: string) {
  const collection = COLLECTIONS.find((candidate) => candidate.slug === slug);
  if (!collection) return undefined;
  const entries = entriesForCollection(collection, getKidsEntries());
  // A collection with nothing in it is not a page: the empty state is "no link
  // anywhere", which is the same answer the menu, /browse/ and the sitemap give.
  return entries.length > 0 ? { collection, entries } : undefined;
}

export function generateStaticParams() {
  return COLLECTIONS.filter((collection) => collectionAt(collection.slug)).map((collection) => ({
    slug: collection.slug,
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const found = collectionAt(slug);
  if (!found) return {};
  return {
    title: found.collection.name + " stories for 8-12 year olds",
    description: shelfDescription(found.collection, shelfStats(found.entries)),
    alternates: { canonical: "/collections/" + found.collection.slug + "/" },
  };
}

export default async function CollectionRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = collectionAt(slug);
  if (!found) notFound();
  const { collection, entries } = found;
  const stats = shelfStats(entries);

  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Collections", path: "/browse/#collections" },
    { name: collection.name, path: "/collections/" + collection.slug + "/" },
  ];

  return (
    <div className="page">
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          collectionJsonLd({
            name: collection.name,
            description: collection.summary,
            path: "/collections/" + collection.slug + "/",
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
          {entries.length} {entries.length === 1 ? "story" : "stories"}, {minutesLabel(stats.min, stats.max)} each,
          read aloud or read alone.
        </p>
      </section>

      <section className="section section--tight" aria-label={collection.name}>
        <div className="grid">
          {entries.map((entry) => (
            <StoryCard key={entry.slug} entry={entry} level={2} />
          ))}
        </div>
      </section>
    </div>
  );
}
