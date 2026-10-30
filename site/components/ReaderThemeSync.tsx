"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { THEME_COLORS, defaultThemeForPath, isReaderTheme } from "@/lib/theme";

/**
 * Keeps the page's default theme honest across client-side navigation.
 *
 * The inline script in the layout settles the theme before first paint, but Next replaces
 * the page without re-running it: moving from an adult story to a children's one would
 * otherwise keep the dark theme (ADR-0002's third amendment). This runs on every path
 * change and does nothing when the reader has made a choice — the theme is an
 * accessibility setting before it is a brand marker.
 */
export function ReaderThemeSync() {
  const pathname = usePathname();

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("wt:theme");
    } catch {
      /* private mode: the default still applies */
    }
    if (isReaderTheme(stored)) return;

    const theme = defaultThemeForPath(pathname);
    document.documentElement.setAttribute("data-reader-theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLORS[theme]);
  }, [pathname]);

  return null;
}
