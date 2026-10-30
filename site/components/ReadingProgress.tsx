"use client";

import { useEffect } from "react";

const KEY = "wt:progress";

type ProgressMap = Record<string, { pct: number; at: number; title: string; url: string }>;

export function storeProgress(slug: string, pct: number, title: string, url: string) {
  try {
    const map: ProgressMap = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    map[slug] = { pct, at: Date.now(), title, url };
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* private mode */
  }
}

/**
 * Thin bar at the top of the viewport plus a percent readout. Progress is
 * remembered per story so the home page can offer "carry on reading".
 */
export function ReadingProgress({ slug, title, url }: { slug: string; title: string; url: string }) {
  useEffect(() => {
    const root = document.documentElement;
    const bar = document.querySelector<HTMLElement>("[data-progress-bar]");
    let frame = 0;

    const update = () => {
      frame = 0;
      const max = root.scrollHeight - root.clientHeight;
      const pct = max <= 0 ? 100 : Math.min(100, Math.max(0, (root.scrollTop / max) * 100));
      if (bar) bar.style.setProperty("--progress", `${pct.toFixed(1)}%`);
      if (pct > 1 && pct < 99) storeProgress(slug, Math.round(pct), title, url);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [slug, title, url]);

  return (
    <div className="progress" data-progress-bar aria-hidden="true">
      <div className="progress__bar" />
    </div>
  );
}
