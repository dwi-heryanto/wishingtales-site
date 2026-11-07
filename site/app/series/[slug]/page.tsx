import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdultGate } from "@/components/AdultGate";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { StoryCard } from "@/components/StoryCard";
import { getKidsSeries, getSeries, getSeriesHub } from "@/lib/content";
import { indexAllowed } from "@/lib/gate";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/jsonld";
import { isAdult } from "@/lib/tiers";

export const dynamicParams = false;

export function generateStaticParams() {
  return getSeries().map((hub) => ({ slug: hub.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const hub = getSeriesHub(slug);
  if (!hub) return {};
  return {
    title: hub.title,
    description: hub.summary,
    alternates: { canonical: hub.url },
    // An adult series is as indexable as an adult story, which is to say not at all
    // while the switch is off (ADR-0002).
    robots: indexAllowed(hub.ageTier) ? undefined : "noindex, nofollow",
  };
}

export default async function SeriesHubRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hub = getSeriesHub(slug);
  if (!hub) notFound();

  /*
   * The hub's own tier says which page this is, and therefore which episodes it may
   * show: a children's series hub lists only the episodes a child may be linked to, and
   * an adult series opens behind the notice like everything else on the far side
   * (ADR-0002). A children's hub can lose an episode to this — an episode retiered to
   * `13+` disappears from it rather than becoming a link — and that is the rule working.
   */
  const adult = isAdult(hub.ageTier);
  const episodes = adult
    ? hub.episodes
    : (getKidsSeries().find((kidsHub) => kidsHub.slug === hub.slug)?.episodes ?? []);

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Series", path: "/series/" },
    { name: hub.title, path: hub.url },
  ];

  return (
    <div className="page" data-adult={adult ? "" : undefined}>
      {adult ? <AdultGate what="shelf" /> : null}
      <div className="adult-gated">
        <JsonLd
          data={[
            breadcrumbJsonLd(crumbs),
            collectionJsonLd({
              name: hub.title,
              description: hub.summary,
              path: hub.url,
              entries: episodes,
            }),
          ]}
        />
        <section className="section">
          <Breadcrumbs crumbs={crumbs} />
          <h1 className="lede" style={{ marginBlockStart: "var(--space-sm)" }}>
            {hub.title}
          </h1>
          <p className="lede__note">{hub.summary}</p>
        </section>

        <section className="section section--tight" aria-labelledby="episodes">
          <div className="section__head">
            <h2 className="section__title" id="episodes">
              {episodes.length === 1 ? "1 part" : episodes.length + " parts"}
            </h2>
            <span className="section__link">Written by {hub.byline}</span>
          </div>
          {episodes.length === 0 ? (
            <p className="empty">The first part is in editing. It will appear here when it is ready.</p>
          ) : (
            <div className="grid">
              {episodes.map((episode) => (
                <StoryCard key={episode.slug} entry={episode} seriesTitle={hub.title} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
