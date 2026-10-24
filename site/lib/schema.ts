import { z } from "zod";
import { ageTierSchema, genreSchema } from "./tiers.ts";

/**
 * Frontmatter contract (docs/execution-plan.md § Content spec).
 *
 * Validation runs at build time, which makes the CI check on a draft PR the
 * thing that stops a malformed story from being merged. Drafts are excluded by
 * construction: `status` is a literal, so a file that still says "draft" cannot
 * live under content/.
 *
 * The audience and the genre vocabulary come from `./tiers.ts`, which the Worker reads
 * too — so the build and the generator cannot disagree about what a valid story is.
 */

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase words separated by single hyphens");

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

/**
 * Public-domain provenance. The two .max() calls are the site's sourcing rule
 * (first published ≤ 1930 AND author died ≤ 1955) written down as code, so a
 * classic that does not clear the rule cannot be built or published.
 */
export const provenanceSchema = z.strictObject({
  source: z.string().min(1),
  author: z.string().min(1),
  deathYear: z.number().int().max(1955, "author must have died in or before 1955"),
  firstPublished: z.number().int().max(1930, "first publication must be 1930 or earlier"),
  edition: z.string().min(1),
  pdBasis: z.string().min(1),
  verifiedOn: isoDate,
  notes: z.string().optional(),
});

/**
 * A quality score from named axes averaged into one number (ADR-0005).
 *
 * The axes are stored beside the average so a disagreement with the score can be traced
 * to the axis that produced it — "is the ending earned?" is answerable, "is this good?"
 * is not, and a bare float cannot be argued with.
 *
 * **Optional in the schema, mandatory from the generator.** The eleven stories written
 * before the rating existed have none, and inventing scores for them to satisfy a
 * validator would be a lie in the frontmatter. A new story cannot be published without
 * one; an old one is not retroactively graded.
 */
export const ratingSchema = z.strictObject({
  overall: z.number().min(1).max(5),
  axes: z.record(z.string(), z.number().min(1).max(5)),
});

const commonEntry = {
  title: z.string().min(1).max(120),
  slug,
  /** One or two sentences. Used for cards, meta description and OG description. */
  summary: z.string().min(40).max(300),
  status: z.literal("published"),
  publishedAt: isoDate,
  /**
   * Who the story is for. One field, four values, and `isAdult` derived from it rather
   * than stored beside it (ADR-0001).
   */
  ageTier: ageTierSchema,
  /** From the closed vocabulary. An open list produced ten spellings of "folk tale". */
  genres: z.array(genreSchema).min(1).max(3),
  themes: z.array(slug).min(1),
  rating: ratingSchema.optional(),
  aiAssisted: z.literal(true),
  byline: z.string().min(1),
  cover: z.string().regex(/^\/covers\/[a-z0-9-]+\.(webp|jpg|png)$/, "cover must live at /covers/<slug>.(webp|jpg|png)"),
  coverAlt: z.string().min(10),
};

/**
 * An original story. **Standalone by default** (ADR-0004): series membership is
 * optional, and a story that names a series must also say where it sits in it.
 *
 * Both halves of that are checked, because the failure mode is asymmetric: a story with
 * a `series` and no `seriesOrder` silently joins a series at an undefined position, and
 * one with an order and no series is a dangling number nobody reads.
 *
 * The shape and the refinement are separate consts because zod 4 will not `.extend()` a
 * schema that carries a refinement, and the draft shape has to obey the same rule — a
 * draft that breaks it would only fail after it had been written to a branch.
 */
const storyShape = {
  ...commonEntry,
  series: slug.optional(),
  seriesOrder: z.number().int().positive().optional(),
};

const seriesOrderPaired = (story: { series?: string; seriesOrder?: number }) =>
  Boolean(story.series) === Boolean(story.seriesOrder);

const SERIES_ORDER_MESSAGE = {
  message: "series and seriesOrder must be present together or absent together",
  path: ["seriesOrder"],
};

export const storySchema = z.strictObject(storyShape).refine(seriesOrderPaired, SERIES_ORDER_MESSAGE);

/** A retold classic: provenance is mandatory, series membership is not. */
export const classicSchema = z.strictObject({
  ...commonEntry,
  provenance: provenanceSchema,
});

export const seriesSchema = z.strictObject({
  title: z.string().min(1).max(80),
  slug,
  summary: z.string().min(40).max(300),
  status: z.literal("published"),
  ageTier: ageTierSchema,
  themes: z.array(slug).min(1),
  byline: z.string().min(1),
});

export const themeSchema = z.strictObject({
  title: z.string().min(1).max(40),
  slug,
  summary: z.string().min(20).max(200),
});

/**
 * A draft is the published shape with status "draft". Validating against this at
 * generation time means a draft arriving on a branch is already publishable
 * except for the human edit and the status flip.
 */
export const draftStorySchema = z
  .strictObject({ ...storyShape, status: z.literal("draft") })
  .refine(seriesOrderPaired, SERIES_ORDER_MESSAGE);
export const draftClassicSchema = classicSchema.extend({ status: z.literal("draft") });

export type Provenance = z.infer<typeof provenanceSchema>;
export type Rating = z.infer<typeof ratingSchema>;
export type StoryFrontmatter = z.infer<typeof storySchema>;
export type ClassicFrontmatter = z.infer<typeof classicSchema>;
export type SeriesFrontmatter = z.infer<typeof seriesSchema>;
export type ThemeFrontmatter = z.infer<typeof themeSchema>;
