"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/format";

/**
 * The relative publish stamp on the fresh rail (ADR-0016 A3): "2 days ago",
 * computed client-side from the build stamp the page ships. The server renders
 * the absolute date and the first client render repeats it — a hydration-safe
 * swap, the AdultGate pattern — so the exported HTML never lies and a reader
 * with JavaScript gets the friendlier wording.
 */
export function PublishedStamp({ publishedAt, buildTime }: { publishedAt: string; buildTime: string }) {
  const [relative, setRelative] = useState<string | null>(null);

  useEffect(() => {
    const days = Math.floor((Date.parse(buildTime) - Date.parse(publishedAt)) / 86_400_000);
    if (days < 0 || days > 6) return;
    setRelative(days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`);
  }, [publishedAt, buildTime]);

  return <span className="card__stamp">{relative ?? formatDate(publishedAt)}</span>;
}
