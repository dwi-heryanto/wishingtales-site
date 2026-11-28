"use client";

import { useEffect } from "react";
import { readReadSlugs, stampVisit } from "@/lib/guest-state";

/**
 * One island for the page's ambient guest state (ADR-0016): the visit stamp
 * (`wt:lastVisit`, the max rule) and the read markers — a card whose story has
 * been opened gets its dot lit. Cards carry `data-wt-slug` and a hidden
 * `.card__read` dot server-side, so the exported HTML stays honest and this
 * island only ever turns things on.
 */
export function GuestState() {
  useEffect(() => {
    stampVisit();
    const read = new Set(readReadSlugs());
    if (read.size === 0) return;
    document.querySelectorAll<HTMLElement>("[data-wt-slug]").forEach((card) => {
      const slug = card.dataset.wtSlug;
      if (slug && read.has(slug)) card.classList.add("card--read");
    });
  }, []);
  return null;
}
