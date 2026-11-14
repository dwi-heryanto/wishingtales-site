import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { StoryCard } from "@/components/StoryCard";
import { getKidsSeries, getKidsThemeHub, getThemes } from "@/lib/content";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/jsonld";
import { shelfDescription, shelfFacts, shelfStats } from "@/lib/shelf-copy";

export const dynamicParams = false;

export function generateStaticParams() {
  return getThemes().map((hub) => ({ slug: hub.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const hub = getKidsThemeHub(slug);
  if (!hub) return {};
  /*
   * A theme hub is a shelf by another name — "stories about courage" — so it gets the same
   * treatment as a genre shelf: a title that reads like the query and a description with
   * that hub's own counts (issue #111).
   */
  return {
    title: `Stories about ${hub.title.toLowerCase()} for 8-12 year olds`,
    description: shelfDescription({ summary: hub.summary, body: "" }, shelfStats(hub.entries)),
    alternates: { canonical: hub.url },
  };
}

export default async function ThemeHubRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hub = getKidsThemeHub(slug);
  if (!hub) notFound();

  /*
   * A theme shelf mixes standalone stories and series episodes, so each card is told
   * which series its story belongs to. Without this an episode of a series would be
   * indistinguishable from a standalone story here — the two shapes a reader is meant to
   * be able to tell apart (ADR-0004).
   *
   * `getKidsThemeHub` has already taken the gated stories out (ADR-0002), so this page
   * cannot hand a child a link to one however hard it tries.
   */
  const series = getKidsSeries();

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Themes", path: "/themes/" },
    { name: hub.title, path: hub.url },
  ];

  return (
    <div className="page">
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          collectionJsonLd({
            name: hub.title,
            description: hub.summary,
            path: hub.url,
            entries: hub.entries,
          }),
        ]}
      />
      <section className="section">
        <Breadcrumbs crumbs={crumbs} />
        <h1 className="lede" style={{ marginBlockStart: "var(--space-sm)" }}>
          {hub.title}
        </h1>
        <p className="lede__note">{hub.summary}</p>
        <p className="shelf-facts">{shelfFacts(shelfStats(hub.entries))}</p>
      </section>

      <section className="section section--tight">
        {hub.entries.length === 0 ? (
          <p className="empty">No stories here yet.</p>
        ) : (
          <div className="grid">
            {hub.entries.map((entry) => (
              <StoryCard
                key={entry.slug}
                entry={entry}
                level={2}
                seriesTitle={series.find((item) => item.slug === entry.series)?.title}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
