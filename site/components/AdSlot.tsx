/**
 * Reserved ad position (D6: v2 ads are contextual-only and free-tier-only, and the slots
 * exist in the layout from the start so adding them later is not a redesign). Renders
 * nothing today — no ad code ships in v1.
 *
 * **Kept deliberately, revisited 2026-10-13 (issue #18).** The slot is markup for a
 * monetisation plan four pages deny in plain words — the footer, the story end-note, the
 * about page and the privacy page all say "no ads" — and the obvious tidy-up is to delete
 * it until ads are a real plan. That was considered and rejected: the copy is true today
 * because the slot is empty, the reservation is what makes filling it later a content
 * decision rather than a layout one, and a reader sees nothing.
 *
 * What that costs is honesty about the direction of travel: **if these slots are ever
 * filled, the "no ads" promise has to come out of those four pages in the same change.**
 * A stale promise is worse than a missing feature, and this repo has already had to
 * delete "a person edits every story before it goes live" for exactly that reason.
 *
 * `index-foot` has no call site yet. It is part of the reserved pair rather than dead
 * code, but if the index never grows a footer slot, the variant should go.
 */
export function AdSlot({ name }: { name: "story-end" | "index-foot" }) {
  return <div className="ad-slot" data-ad-slot={name} aria-hidden="true" />;
}
