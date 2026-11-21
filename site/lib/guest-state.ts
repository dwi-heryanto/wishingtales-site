/**
 * The guest state contract (ADR-0016).
 *
 * Three keys join `wt:progress` and the reader prefs under the same rules the
 * existing keys already follow: localStorage, `wt:`-namespaced, JSON, and
 * nothing leaving the device. The keys and their merge rules are the contract —
 * they may be added to, never silently changed, the same discipline as the
 * closed genre vocabulary:
 *
 * | Key          | Shape           | Merge rule when accounts sync  |
 * |--------------|-----------------|--------------------------------|
 * | wt:progress  | slug → position | furthest position wins         |
 * | wt:favorites | array of slugs  | set-union                      |
 * | wt:read      | array of slugs  | set-union                      |
 * | wt:lastVisit | ISO date        | max                            |
 * | wt:theme …   | per key         | last-write-wins                |
 *
 * `wt:favorites` is already the key `site/lib/accounts.ts` syncs, so the
 * account MVP inherits these without a state migration; `wt:read` stays local
 * until the server schema grows a home for it. Everything here is deliberately
 * boring: parse defensively, write atomically, and treat private mode as a
 * no-op rather than a crash.
 */

const FAVORITES_KEY = "wt:favorites";
const READ_KEY = "wt:read";
const LAST_VISIT_KEY = "wt:lastVisit";

/** Fired on `window` whenever favorites change, so shelves and hearts update live. */
export const FAVORITES_EVENT = "wt:favorites-changed";

/** The same ceiling the server's sync schema puts on favorites (`syncBodySchema`). */
const MAX_SLUGS = 500;

function readSlugArray(key: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.filter((slug): slug is string => typeof slug === "string"))];
  } catch {
    return [];
  }
}

function writeSlugArray(key: string, slugs: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(slugs));
  } catch {
    /* private mode */
  }
}

// ---------------------------------------------------------------------------
// Favorites (A1)
// ---------------------------------------------------------------------------

export function readFavorites(): string[] {
  return readSlugArray(FAVORITES_KEY);
}

export function writeFavorites(slugs: string[]): void {
  writeSlugArray(FAVORITES_KEY, [...new Set(slugs)].slice(0, MAX_SLUGS));
  try {
    window.dispatchEvent(new Event(FAVORITES_EVENT));
  } catch {
    /* no window (should not happen in a browser), nothing to update then */
  }
}

export function isFavorite(slug: string): boolean {
  return readFavorites().includes(slug);
}

/** Toggles one slug, returns whether it is now favorited. Insertion order preserved. */
export function toggleFavorite(slug: string): boolean {
  const current = readFavorites();
  const next = current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug];
  writeFavorites(next);
  return next.includes(slug);
}

// ---------------------------------------------------------------------------
// Read markers (A4, the minimal half — the "updated since last visit" badge
// stays deferred per the ADR)
// ---------------------------------------------------------------------------

export function readReadSlugs(): string[] {
  return readSlugArray(READ_KEY);
}

/** A story opening adds its slug to `wt:read`; set-union, oldest entries fall off the cap. */
export function markRead(slug: string): void {
  const current = readSlugArray(READ_KEY);
  if (current.includes(slug)) return;
  writeSlugArray(READ_KEY, [...current, slug].slice(-MAX_SLUGS));
}

// ---------------------------------------------------------------------------
// Last visit (freshness bookkeeping; max-merge on sync)
// ---------------------------------------------------------------------------

export function readLastVisit(): string | null {
  try {
    return localStorage.getItem(LAST_VISIT_KEY);
  } catch {
    return null;
  }
}

/** Stamps this visit; an older stamp never moves the date backwards (the max rule). */
export function stampVisit(): void {
  const now = new Date().toISOString();
  const previous = readLastVisit();
  if (previous && previous >= now) return;
  try {
    localStorage.setItem(LAST_VISIT_KEY, now);
  } catch {
    /* private mode */
  }
}
