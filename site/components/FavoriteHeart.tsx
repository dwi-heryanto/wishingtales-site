"use client";

import { useEffect, useState } from "react";
import { FAVORITES_EVENT, isFavorite, toggleFavorite } from "@/lib/guest-state";

/**
 * The heart (ADR-0016 A1): the only client affordance on a card. The card
 * itself stays server-rendered — this island reads and writes `wt:favorites`
 * in localStorage, so a favorite costs no account, no server write and no
 * telemetry (COPPA posture unchanged).
 *
 * Server render is always "not favorited" and the effect corrects it after
 * hydration — the same pattern AdultGate uses, so the exported HTML never
 * depends on a browser.
 */
export function FavoriteHeart({ slug, title, page = false }: { slug: string; title: string; page?: boolean }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(isFavorite(slug));
    const update = () => setOn(isFavorite(slug));
    window.addEventListener(FAVORITES_EVENT, update);
    return () => window.removeEventListener(FAVORITES_EVENT, update);
  }, [slug]);

  return (
    <button
      type="button"
      className={page ? "heart heart--page" : "heart"}
      aria-pressed={on}
      aria-label={on ? `Remove ${title} from favorites` : `Add ${title} to favorites`}
      onClick={() => setOn(toggleFavorite(slug))}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 21s-7.5-4.9-10-9.5C.5 8 2.5 4 6.5 4c2.4 0 4.2 1.3 5.5 3.2C13.3 5.3 15.1 4 17.5 4c4 0 6 4 4.5 7.5C19.5 16.1 12 21 12 21z" />
      </svg>
    </button>
  );
}
