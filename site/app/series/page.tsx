import type { Metadata } from "next";
import { getKidsSeries } from "@/lib/content";

const series = getKidsSeries();
const parts = series.reduce((total, hub) => total + hub.episodes.length, 0);

export const metadata: Metadata = {
  /*
   * A series index answers "bedtime story series" and "chapter books to read in order",
   * so the title says what it holds rather than repeating the menu label, and the
   * description quotes the shelf's own numbers (issue #111).
   */
  title: "Story series for 8-12 year olds",
  description:
    series.length + " original series to read in order — " + parts +
    " parts in all, each part a story of its own for readers of eight to twelve.",
  alternates: { canonical: "/series/" },
};

export default function SeriesIndex() {
  return (
    <div className="page">
      <section className="section">
        <h1 className="lede">Series</h1>
        <p className="lede__note">
          Every series is written part by part, in order. Start at part one and read on.
        </p>
        <p className="shelf-facts">
          {parts} parts across {series.length} series — each part is a story of its own, short
          enough for one sitting.
        </p>
      </section>

      <section className="section section--tight">
        {series.length === 0 ? (
          <p className="empty">
            No series published yet. The first one is being written and edited now.
          </p>
        ) : (
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
        )}
      </section>
    </div>
  );
}
