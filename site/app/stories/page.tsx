import type { Metadata } from "next";
import { EntryList } from "@/components/EntryList";
import { JsonLd } from "@/components/JsonLd";
import { getKidsSeries, getKidsStories } from "@/lib/content";
import { collectionJsonLd } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "Original stories",
  description:
    "Original stories, each one complete and meant to be read in a single sitting — read aloud to a child, or read alone.",
  alternates: { canonical: "/stories/" },
};

export default function StoriesIndex() {
  const stories = getKidsStories();
  const series = getKidsSeries();

  return (
    <div className="page">
      <JsonLd
        data={collectionJsonLd({
          name: "Stories",
          description: "Original stories to read aloud or read alone.",
          path: "/stories/",
          entries: stories,
        })}
      />
      <section className="section">
        <h1 className="lede">Original stories</h1>
        <p className="lede__note">
          Written for WishingTales and complete in a single sitting — read aloud or read alone. Looking for everything,
          including the retold classics? That is <a href="/browse/">all stories</a>.
        </p>
      </section>

      <section className="section section--tight" aria-labelledby="all-stories">
        <div className="section__head">
          <h2 className="section__title" id="all-stories">
            {stories.length === 1 ? "1 story" : stories.length + " stories"}
          </h2>
          <a className="section__link" href="/series/">
            Browse by series
          </a>
        </div>
        <EntryList
          entries={stories}
          emptyNote="The first stories are being written now. Each one is reviewed by a model before it publishes itself — no person reads it first — so this shelf fills up slowly on purpose."
        />
      </section>

      {series.length > 0 ? (
        <section className="section section--tight" aria-labelledby="series-list">
          <h2 className="section__title" id="series-list">
            Series
          </h2>
          <ul className="entry-list">
            {series.map((hub) => (
              <li className="entry-list__item" key={hub.slug}>
                <a className="entry-list__link" href={hub.url}>
                  <span className="entry-list__meta">
                    {hub.episodes.length === 1 ? "1 part" : hub.episodes.length + " parts"}
                  </span>
                  <span className="entry-list__title">{hub.title}</span>
                  <span className="entry-list__summary">{hub.summary}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
