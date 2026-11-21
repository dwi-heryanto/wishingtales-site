import { z } from "zod";

/**
 * Age tiers, the closed genre vocabulary, and the numbers that differ by tier.
 *
 * One module because two very different callers need the same answers: the site
 * validates frontmatter at build time, and the Worker builds prompts and runs the
 * mechanical review. The Worker already imports `site/lib/schema.ts`, so this is the
 * seam that keeps "what the build accepts" and "what the generator targets" from
 * drifting apart — the failure mode that let `ageBand: z.literal("10-12")` outlive the
 * decision to widen the audience (ADR-0001).
 */

/**
 * Four tiers, one field. `isAdult` is **derived**, never stored: a boolean beside the
 * tier cannot tell 13+ from 18+, which have different content rules, so it would have
 * to be a second field, and two fields that must agree eventually disagree (ADR-0001).
 *
 * The order is the reading order, youngest first, and `AGE_TIERS` is what the schema
 * enumerates — so a fifth tier cannot be invented in one place only.
 */
export const AGE_TIERS = ["4-8", "8-12", "13+", "18+"] as const;
export type AgeTier = (typeof AGE_TIERS)[number];

export const ageTierSchema = z.enum(AGE_TIERS);

/** What the gate reads. True for the tiers that carry adult content rules. */
export function isAdult(tier: AgeTier): boolean {
  return tier === "13+" || tier === "18+";
}

/**
 * The closed genre vocabulary (ADR-0001, GLOSSARY § Genre).
 *
 * Closed because an open one produces ten spellings of "folk tale" and shelves holding
 * one story each. The first seven are the ones the eleven published stories already
 * use — they had to survive the change, or the retier would have been a rewrite — and
 * the rest are what widening the product adds.
 *
 * `spooky` and `horror` are deliberately **two genres, not one**. A scary story for an
 * eight-year-old and a horror story for an adult are different promises to different
 * readers, and collapsing them is how a kids shelf ends up holding adult work.
 */
export const GENRES = [
  "adventure",
  "animal story",
  "everyday magic",
  "family",
  "fantasy",
  "folk tale",
  "funny",
  "mystery",
  "myth and legend",
  "quest",
  "slice of life",
  "spooky",
  "horror",
] as const;
export type Genre = (typeof GENRES)[number];

export const genreSchema = z.enum(GENRES);

/**
 * Genres a tier may carry, layered above the safety floor (ADR-0003).
 *
 * `horror` is the only genre restricted by tier today. Everything else is a matter of
 * treatment rather than subject: a `spooky` story at 8-12 is a creaking floorboard and
 * a friendly ghost, and at 18+ it can be genuinely frightening, which is what the tier
 * profiles below are for.
 */
export function genresAllowedAt(tier: AgeTier): readonly Genre[] {
  return isAdult(tier) ? GENRES : GENRES.filter((genre) => genre !== "horror");
}

/**
 * How many words, scenes and dialogue a tier gets.
 *
 * The dialogue curve is **not monotonic**, which is the least obvious thing here: 4-8
 * needs the highest share because the story is performed aloud by an adult, and the
 * adult tiers sit lower again because interiority replaces conversation (ADR-0001).
 *
 * `4-8` is designed but does not ship: it needs the picture-book prompt profile ADR-0001
 * describes, and an empty shelf is worse than no shelf — a content reason, not a safety
 * one. `13+` ships: the gate it was waiting on is in the code (#24) and `worker/prompts/13+.md`
 * is its profile (ADR-0006). `18+` is still off, on a profile nobody has written yet, and
 * it stays off deliberately: the owner's decision is to ship the teen tier now and keep
 * explicit horror off the site, so its numbers remain **provisional** — nothing has been
 * generated against them. A tier that ships is not necessarily a tier that is chosen
 * often: the run planner writes one `13+` story for every two `8-12` ones (see
 * `planSlot`), because the site's promise is children's stories and the adult shelf is
 * meant to grow slowly.
 */
export type TierProfile = {
  /** Words the story must fall inside. */
  minWords: number;
  maxWords: number;
  /** Scenes the plan should produce. */
  minScenes: number;
  maxScenes: number;
  /**
   * Whether the story may use `***` scene breaks.
   *
   * A read-aloud picture-book shape is one unbroken arc; scene breaks are a reading
   * skill the 4-8 reader does not have yet.
   */
  sceneBreaks: boolean;
  minDialogueShare: number;
  maxAverageSentence: number;
  maxLongestSentence: number;
  maxAverageParagraph: number;
  /** May the generator target this tier at all? */
  ships: boolean;
};

export const TIER_PROFILES: Record<AgeTier, TierProfile> = {
  "4-8": {
    minWords: 350,
    maxWords: 700,
    minScenes: 1,
    maxScenes: 1,
    sceneBreaks: false,
    minDialogueShare: 0.35,
    maxAverageSentence: 12,
    maxLongestSentence: 25,
    maxAverageParagraph: 40,
    ships: false,
  },
  "8-12": {
    minWords: 1150,
    maxWords: 2300,
    minScenes: 5,
    maxScenes: 7,
    sceneBreaks: true,
    minDialogueShare: 0.25,
    maxAverageSentence: 18,
    maxLongestSentence: 40,
    maxAverageParagraph: 60,
    ships: true,
  },
  "13+": {
    minWords: 1500,
    maxWords: 3500,
    minScenes: 5,
    maxScenes: 9,
    sceneBreaks: true,
    minDialogueShare: 0.2,
    maxAverageSentence: 22,
    maxLongestSentence: 45,
    maxAverageParagraph: 70,
    ships: true,
  },
  "18+": {
    minWords: 1500,
    maxWords: 5000,
    minScenes: 5,
    maxScenes: 12,
    sceneBreaks: true,
    minDialogueShare: 0.18,
    maxAverageSentence: 24,
    maxLongestSentence: 50,
    maxAverageParagraph: 80,
    ships: false,
  },
};

/** The tiers the generator is allowed to write for, in reading order. */
export const SHIPPING_TIERS = AGE_TIERS.filter((tier) => TIER_PROFILES[tier].ships);

/** The tier a story is written at when nothing asks for another one. */
export const DEFAULT_TIER: AgeTier = "8-12";

export function profileFor(tier: AgeTier): TierProfile {
  return TIER_PROFILES[tier];
}
