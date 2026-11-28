"use client";

import { useEffect } from "react";
import { markRead } from "@/lib/guest-state";

/** A story opening adds its slug to `wt:read` (ADR-0016 A4, the minimal half). */
export function RecordRead({ slug }: { slug: string }) {
  useEffect(() => {
    markRead(slug);
  }, [slug]);
  return null;
}
