"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Candidate = { slug: string; title: string; url: string; cover: string; coverAlt: string; readingTime: number };

type ProgressMap = Record<string, { pct: number; at: number; title: string; url: string }>;

/**
 * Reads the reader's own localStorage. Renders nothing when there is no progress to
 * show — it never invents a "recommended for you" row.
 *
 * The v2 rail (issue #208) shows every unfinished story, not only the latest one:
 * cover, title, a progress bar and the minutes left. Covers come from the entries the
 * home page already passed in, so nothing is read that the build did not verify.
 */
export function ContinueReading({ entries }: { entries: Candidate[] }) {
  const [items, setItems] = useState<{ slug: string; title: string; url: string; pct: number }[]>([]);

  useEffect(() => {
    let map: ProgressMap = {};
    try {
      map = JSON.parse(localStorage.getItem("wt:progress") ?? "{}");
    } catch {
      return;
    }
    const known = new Map(entries.map((entry) => [entry.slug, entry]));
    const unfinished = Object.entries(map)
      .filter(([slug, value]) => known.has(slug) && value.pct >= 3 && value.pct <= 97)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, 6)
      .map(([slug, value]) => ({ slug, title: value.title, url: value.url, pct: value.pct }));

    if (unfinished.length > 0) setItems(unfinished);
  }, [entries]);

  if (items.length === 0) return null;

  return (
    <section className="section section--tight" aria-labelledby="continue-heading">
      <div className="section__head">
        <h2 className="section__title" id="continue-heading">
          Carry on reading
        </h2>
      </div>
      <div className="crail">
        {items.map((item) => {
          const entry = entries.find((candidate) => candidate.slug === item.slug);
          if (!entry) return null;
          /* The one number every story carries, cut by what is left: a fraction of the
             reading time, rounded up to the minute, at least one. */
          const minutesLeft = Math.max(1, Math.round((entry.readingTime * (100 - item.pct)) / 100));
          return (
            <div className="crail__item" key={item.slug}>
              <span className="crail__cover">
                <img src={entry.cover} alt={entry.coverAlt} loading="lazy" width={128} height={192} />
              </span>
              <div>
                <p className="crail__title">
                  <Link className="crail__link" href={item.url}>
                    {item.title}
                  </Link>
                </p>
                <div className="crail__track">
                  <span className="crail__fill" style={{ inlineSize: item.pct + "%" }} />
                </div>
                <p className="crail__left">
                  {item.pct}% read · about {minutesLeft} min left
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
