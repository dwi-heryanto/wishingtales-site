import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { StoryCard } from "@/components/StoryCard";
import { getKidsEntries } from "@/lib/content";
import { breadcrumbJsonLd, collectionJsonLd, type Crumb } from "@/lib/jsonld";
import { TIME_SHELVES, entriesForTimeShelf } from "@/lib/reading-time";
import { minutesLabel, shelfDescription, shelfStats } from "@/lib/shelf-copy";

export const dynamicParams = false;

function shelfAt(slug: string) {
  const shelf = TIME_SHELVES.find((candidate) => candidate.slug === slug);
  if (!shelf) return undefined;
  const entries = entriesForTimeShelf(shelf, getKidsEntries());
  return entries.length > 0 ? { shelf, entries } : undefined;
}

export function generateStaticParams() {
  return TIME_SHELVES.filter((shelf) => shelfAt(shelf.slug)).map((shelf) => ({ slug: shelf.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const found = shelfAt(slug);
  if (!found) return {};
  return {
    title: found.shelf.name + " for 8-12 year olds",
    description: shelfDescription(found.shelf, shelfStats(found.entries)),
    alternates: { canonical: "/reading-time/" + found.shelf.slug + "/" },
  };
}

export default async function ReadingTimeShelfRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = shelfAt(slug);
  if (!found) notFound();
  const { shelf, entries } = found;
  const stats = shelfStats(entries);

  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Reading time", path: "/reading-time/" },
    { name: shelf.name, path: "/reading-time/" + shelf.slug + "/" },
  ];

  return (
    <div className="page">
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          collectionJsonLd({
            name: shelf.name,
            description: shelf.summary,
            path: "/reading-time/" + shelf.slug + "/",
            entries,
          }),
        ]}
      />

      <section className="section">
        <Breadcrumbs crumbs={crumbs} />
        <h1 className="lede" style={{ marginBlockStart: "var(--space-sm)" }}>
          {shelf.name}
        </h1>
        <p className="lede__note">{shelf.body}</p>
        <p className="shelf-facts">
          {entries.length} {entries.length === 1 ? "story" : "stories"}, {minutesLabel(stats.min, stats.max)} each
          — read aloud or read alone.
        </p>
      </section>

      <section className="section section--tight" aria-label={shelf.name}>
        <div className="grid">
          {entries.map((entry) => (
            <StoryCard key={entry.slug} entry={entry} level={2} />
          ))}
        </div>
      </section>
    </div>
  );
}
