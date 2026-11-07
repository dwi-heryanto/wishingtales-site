import { isAdult, type AgeTier } from "./tiers";

/**
 * The adult gate (ADR-0002).
 *
 * WishingTales is one brand carrying adult content, which the owner chose against the
 * architect's advice, and this file is what that decision costs: the switch, the notice
 * key, and the one place that answers "may this be indexed?".
 *
 * **This is a speed bump, not enforcement.** The site is a static export, so a story's
 * text is in the HTML of its page whatever this file says — there is no server to check
 * anything, and D5 excludes one. It stops a child who taps the wrong shelf. It does not
 * stop a determined reader.
 */

/**
 * May the older tiers be indexed?
 *
 * One switch on purpose. Indexing adult content turns a kids brand into a mixed one, and
 * ADR-0002 wants undoing that to be one commit rather than an audit: flip this to `true`
 * and the adult shelves drop their `noindex` and return to `sitemap.xml`.
 *
 * It covers `13+` and `18+` together because `isAdult` is what the gate reads and both
 * tiers it covers are gated. The ADR names `18+` because that is the tier it is obviously
 * about; splitting the switch in two is how one of them gets forgotten.
 */
export const ADULT_INDEXING = false;

/**
 * The localStorage key that remembers the click-through, per browser.
 *
 * localStorage rather than a cookie: nothing here is sent anywhere, because there is
 * nowhere to send it, and a cookie would only be a promise the site cannot keep.
 */
export const ADULT_NOTICE_KEY = "wt:adult-ack";

/** Whether a shelf or a story at this tier may be indexed today. */
export function indexAllowed(tier: AgeTier): boolean {
  return ADULT_INDEXING || !isAdult(tier);
}
