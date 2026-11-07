"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Candidate = { slug: string; title: string; url: string; cover: string; coverAlt: string };

type ProgressMap = Record<string, { pct: number; at: number; title: string; url: string }>;

/**
 * Reads the reader's own localStorage. Renders nothing when there is no
 * progress to show — it never invents a "recommended for you" row.
 */
export function ContinueReading({ entries }: { entries: Candidate[] }) {
  const [resume, setResume] = useState<{ pct: number; title: string; url: string } | null>(null);

  useEffect(() => {
    let map: ProgressMap = {};
    try {
      map = JSON.parse(localStorage.getItem("wt:progress") ?? "{}");
    } catch {
      return;
    }
    const known = new Set(entries.map((entry) => entry.slug));
    const unfinished = Object.entries(map)
      .filter(([slug, value]) => known.has(slug) && value.pct >= 3 && value.pct <= 97)
      .sort((a, b) => b[1].at - a[1].at);

    const latest = unfinished[0];
    if (latest) {
      setResume({ pct: latest[1].pct, title: latest[1].title, url: latest[1].url });
    }
  }, [entries]);

  if (!resume) return null;

  return (
    <section className="section section--tight" aria-labelledby="continue-heading">
      <div className="section__head">
        <h2 className="section__title" id="continue-heading">
          Carry on reading
        </h2>
        <span className="section__link">{resume.pct}% read</span>
      </div>
      <p style={{ fontFamily: "var(--font-prose)", fontSize: "var(--text-md)" }}>
        <Link href={resume.url}>{resume.title}</Link>
      </p>
    </section>
  );
}
