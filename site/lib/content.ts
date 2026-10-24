import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { readingTimeFor } from "./site.ts";
import {
  classicSchema,
  provenanceSchema,
  seriesSchema,
  storySchema,
  themeSchema,
  type Provenance,
  type Rating,
} from "./schema.ts";
import { isAdult, type AgeTier, type Genre } from "./tiers.ts";
import { entryPath } from "./urls.ts";

export type EntryKind = "story" | "classic";

export type Entry = {
  kind: EntryKind;
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
  /**
   * Who the story is for, carried through to the pages so the shelf can state its
   * promise next to the title (ADR-0001). One field; `isAdult` is derived from it
   * wherever a gate is needed, never stored.
   */
  ageTier: AgeTier;
  /**
   * From the closed vocabulary, in the writer's order — the first one is the primary
   * genre, and so the one the story's URL names (site/lib/urls.ts).
   */
  genres: Genre[];
  themes: string[];
  byline: string;
  cover: string;
  coverAlt: string;
  body: string;
  wordCount: number;
  readingTime: number;
  url: string;
  /** Absent on old stories, which were written before the rating existed (ADR-0005). */
  rating?: Rating;
  /** Absent for a standalone story, which is the default shape rather than a fallback (ADR-0004). */
  series?: string;
  seriesOrder?: number;
  provenance?: Provenance;
  /**
   * The tale this classic retells, as a reader would search for it.
   *
   * `provenance.source` is written for a person — `Jacob and Wilhelm Grimm, "Cinderella"` —
   * and a search engine needs the tale itself: the source name is the query the page should
   * answer ("cinderella story") and the retold title deliberately is not. Absent on an
   * original story, which retells nothing (issue #110).
   */
  sourceTale?: string;
  /**
   * The narration ledger entry, when this story has one. Presence means
   * content/audio.json recorded a completed MP3 in R2; the player builds its URL from the
   * slug. Only children's stories are narrated, so a gated story should never carry it.
   */
  audio?: { seconds: number };
};

export type SeriesHub = {
  slug: string;
  title: string;
  summary: string;
  /**
   * The series' own audience, not a derived one. A hub is a page like any other, so
   * whether it is a children's page is answered by the same question that answers it for
   * a story — and a hub that answered it from its episodes would answer differently as
   * they publish (ADR-0002).
   */
  ageTier: AgeTier;
  themes: string[];
  byline: string;
  url: string;
  episodes: Entry[];
};

export type ThemeHub = {
  slug: string;
  title: string;
  summary: string;
  url: string;
  entries: Entry[];
};

function resolveContentRoot(): string {
  const candidates = [
    process.env.CONTENT_DIR,
    path.resolve(process.cwd(), "content"),
    path.resolve(process.cwd(), "..", "content"),
  ].filter((c): c is string => Boolean(c));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
  }
  throw new Error(`content/ directory not found. Looked in: ${candidates.join(", ")}`);
}

const CONTENT_ROOT = resolveContentRoot();

/**
 * The narration ledger, keyed by slug. Missing is normal: a fixture build has no ledger,
 * and a story simply has no listen controls until the queue reaches it.
 */
type AudioEntry = { seconds: number };
let audioIndex: Map<string, AudioEntry> | undefined;

function getAudioIndex(): Map<string, AudioEntry> {
  if (audioIndex) return audioIndex;
  audioIndex = new Map();
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(CONTENT_ROOT, "audio.json"), "utf8")) as {
      stories?: Record<string, { seconds?: unknown }>;
    };
    for (const [slug, entry] of Object.entries(parsed.stories ?? {})) {
      if (typeof entry?.seconds === "number" && entry.seconds > 0) {
        audioIndex.set(slug, { seconds: entry.seconds });
      }
    }
  } catch {
    // No ledger yet: every story renders without audio controls.
  }
  return audioIndex;
}

function readMarkdown(dir: string): { file: string; data: unknown; body: string }[] {
  const abs = path.join(CONTENT_ROOT, dir);
  if (!fs.existsSync(abs)) return [];

  return fs
    .readdirSync(abs)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .sort()
    .map((name) => {
      const file = path.join(abs, name);
      const raw = fs.readFileSync(file, "utf8");
      const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
      if (!match) {
        throw new Error(`${path.relative(CONTENT_ROOT, file)}: missing YAML frontmatter block`);
      }
      return { file, data: parseYaml(match[1]), body: match[2].trim() };
    });
}

/** One line per problem, prefixed with the file, so a failed build says where to look. */
function describeIssues(file: string, issues: { path: PropertyKey[]; message: string }[]): string {
  return issues.map((i) => `  ${file}: ${i.path.join(".") || "(root)"} — ${i.message}`).join("\n");
}

/**
 * The tale a classic retells, from the source line a person wrote.
 *
 * Every classic in content/classics/ writes its source as `Author, "Tale"`, which is what
 * the sourcing rule produced; the quoted name is the tale. A source written another way
 * falls back to its last comma-separated part, and an unreadable one yields nothing rather
 * than a fragment — a wrong tale in a title is worse than no tale in it (issue #110).
 */
function sourceTaleFrom(source: string | undefined): string | undefined {
  if (!source) return undefined;
  /* Straight quotes are what the pipeline writes; curly ones are what a hand-written
     provenance line may carry, and either is just quoting around the title. */
  const quoted = /["“”]([^"“”]+)["“”]/.exec(source);
  const tale = (quoted ? quoted[1] : (source.split(",").pop() ?? "")).replace(/^[\s"“”'\u2018\u2019]+|[\s"“”'\u2018\u2019]+$/g, "");
  return tale.length > 0 ? tale : undefined;
}

function parseEntry(kind: EntryKind, file: string, data: unknown, body: string): Entry {
  const result = kind === "story" ? storySchema.safeParse(data) : classicSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid ${kind} frontmatter:\n${describeIssues(file, result.error.issues)}`);
  }
  const fm = result.data;
  const audio = getAudioIndex().get(fm.slug);
  const expected = path.basename(file, ".md");
  if (fm.slug !== expected) {
    throw new Error(`${file}: slug "${fm.slug}" does not match filename "${expected}.md"`);
  }

  const wordCount = body.split(/\s+/).filter(Boolean).length;

  const provenance = kind === "classic" && "provenance" in fm ? provenanceSchema.parse(fm.provenance) : undefined;

  return {
    kind,
    slug: fm.slug,
    title: fm.title,
    summary: fm.summary,
    publishedAt: fm.publishedAt,
    ageTier: fm.ageTier,
    genres: fm.genres,
    themes: fm.themes,
    byline: fm.byline,
    cover: fm.cover,
    coverAlt: fm.coverAlt,
    body,
    wordCount,
    readingTime: readingTimeFor(wordCount),
    // `/8-12/folk-tale/the-snow-queen/`: the tier and the primary genre are the address,
    // which is also the shelf the story is found on (ADR-0001, site/lib/urls.ts).
    url: entryPath(fm.ageTier, fm.genres[0], fm.slug),
    ...(fm.rating ? { rating: fm.rating } : {}),
    // `"series" in fm` narrows the union to the story frontmatter, which is the only
    // shape that carries the pair at all — classics are never series episodes.
    ...(kind === "story" && "series" in fm
      ? { series: fm.series, seriesOrder: fm.seriesOrder }
      : {}),
    ...(provenance ? { provenance, sourceTale: sourceTaleFrom(provenance.source) } : {}),
    ...(audio ? { audio } : {}),
  };
}

function loadEntries(kind: EntryKind): Entry[] {
  const dir = kind === "story" ? "stories" : "classics";
  return readMarkdown(dir)
    .map(({ file, data, body }) => parseEntry(kind, file, data, body))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

let cachedEntries: Entry[] | undefined;

/**
 * Two entries may not resolve to the same URL.
 *
 * A story and a classic used to be told apart by their first URL segment, so they could
 * share a slug. Under `/8-12/folk-tale/<slug>/` they cannot, and nothing else would
 * notice: one page would be written over the other and every link to the loser would
 * quietly point at the winner. Checked here rather than in the schema because it spans two
 * directories, and here rather than in a test because a collision is a broken site rather
 * than a broken test.
 */
function assertDistinctUrls(entries: Entry[]): void {
  const byUrl = new Map<string, string>();
  const collisions: string[] = [];
  for (const entry of entries) {
    const owner = byUrl.get(entry.url);
    if (owner) collisions.push(`${entry.url} — ${owner} and ${entry.slug}`);
    else byUrl.set(entry.url, entry.slug);
  }
  if (collisions.length > 0) {
    throw new Error(`Two entries resolve to the same URL:\n  ${collisions.join("\n  ")}`);
  }
}

/**
 * Two entries may not share a title either, not even across the two directories.
 *
 * The URL assert above cannot see two slugs spelling the same name: by 2026-10-24 the
 * library held two stories titled "The Lamp in the Hill" — an original and the Aladdin
 * retelling — at two clean addresses with nothing flagging them. A shared title is a broken
 * library rather than a broken page: two cards answer one name, the wall's search finds
 * both, and a reader cannot tell a reuse from the corpus. The same rule as the URL check:
 * thrown where a collision is visible, rather than left to a test that might not run.
 */
function assertDistinctTitles(entries: Entry[]): void {
  const byTitle = new Map<string, string>();
  const collisions: string[] = [];
  for (const entry of entries) {
    const owner = byTitle.get(entry.title.toLowerCase());
    if (owner) collisions.push(`"${entry.title}" — ${owner} and ${entry.slug}`);
    else byTitle.set(entry.title.toLowerCase(), entry.slug);
  }
  if (collisions.length > 0) {
    throw new Error(`Two entries share a title:\n  ${collisions.join("\n  ")}`);
  }
}

/** Every published entry, newest first. Drafts cannot appear here: they live on a branch. */
export function getEntries(): Entry[] {
  if (!cachedEntries) {
    cachedEntries = [...loadEntries("story"), ...loadEntries("classic")].sort((a, b) =>
      b.publishedAt.localeCompare(a.publishedAt),
    );
    assertDistinctUrls(cachedEntries);
    assertDistinctTitles(cachedEntries);
  }
  return cachedEntries;
}

export function getStories(): Entry[] {
  return getEntries().filter((e) => e.kind === "story");
}

export function getClassics(): Entry[] {
  return getEntries().filter((e) => e.kind === "classic");
}

/*
 * Two shelves out of one library: what a child-facing page may draw from, and what only
 * the gated area may.
 *
 * Older-tier stories are **never linked from kids pages, at all** (ADR-0002), and "never"
 * is why this is a filter on the source rather than a condition at each call site. A page
 * that forgets the condition is a link, and a link is the entire failure mode — the home
 * page, both indexes, every series and theme hub, the feed and the sitemap all read the
 * `Kids` accessors. The story route reads the unfiltered ones, because an adult story
 * still needs its own page.
 *
 * A page is a children's page when it is not *about* an adult-tier thing: `/themes/<slug>/`
 * always is one, a series hub is one when the series is, and a tier shelf is one when the
 * tier is. That is the same question `isAdult` answers everywhere else.
 */
export function getKidsEntries(): Entry[] {
  return getEntries().filter((entry) => !isAdult(entry.ageTier));
}

export function getKidsStories(): Entry[] {
  return getKidsEntries().filter((entry) => entry.kind === "story");
}

export function getKidsClassics(): Entry[] {
  return getKidsEntries().filter((entry) => entry.kind === "classic");
}

/**
 * ADR-0005's shelf order: rating first, recency breaks ties.
 *
 * The ADR says the rating does two jobs — ordering and a discard floor — and only the
 * second was ever implemented: every list shipped newest-first, which ADR-0009 recorded as
 * a drift. This implements the ordering, and `verify-build` asserts the built page order.
 *
 * A story without a rating predates the field (ADR-0005 makes it optional), so it sorts
 * after every rated story instead of pretending to a score; within a tie the newer story
 * leads, and the title keeps the order stable between identical builds.
 */
export function byRatingThenRecency(a: Entry, b: Entry): number {
  const ar = a.rating?.overall ?? -1;
  const br = b.rating?.overall ?? -1;
  if (br !== ar) return br - ar;
  return b.publishedAt.localeCompare(a.publishedAt) || a.title.localeCompare(b.title);
}

export function getEntriesAtTier(tier: AgeTier): Entry[] {
  return getEntries()
    .filter((entry) => entry.ageTier === tier)
    .sort(byRatingThenRecency);
}

/**
 * The entries that sit on one genre shelf at one tier.
 *
 * By `includes`, not by primary genre: the shelf is every story whose promise matches, so
 * `/8-12/spooky/` holds a story whose first genre is `spooky` and one that lists `spooky`
 * second as well. The *address* is the primary genre (site/lib/urls.ts); the shelves are
 * all of them, which is why a story can be linked from two places and live in one.
 */
export function getEntriesAt(tier: AgeTier, genre: Genre): Entry[] {
  return getEntries()
    .filter((entry) => entry.ageTier === tier && entry.genres.includes(genre))
    .sort(byRatingThenRecency);
}

export function getSeries(): SeriesHub[] {
  const hubs = readMarkdown("series").map(({ file, data }) => {
    const result = seriesSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid series frontmatter:\n${describeIssues(file, result.error.issues)}`);
    }
    const fm = result.data;
    const expected = path.basename(file, ".md");
    if (fm.slug !== expected) {
      throw new Error(`${file}: slug "${fm.slug}" does not match filename "${expected}.md"`);
    }
    const episodes = getStories()
      .filter((s) => s.series === fm.slug)
      .sort((a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0));
    return {
      slug: fm.slug,
      title: fm.title,
      summary: fm.summary,
      ageTier: fm.ageTier,
      themes: fm.themes,
      byline: fm.byline,
      url: `/series/${fm.slug}/`,
      episodes,
    };
  });

  /*
   * A story may only point at a series that exists, for the same reason it may only point
   * at a theme that exists: otherwise the episode is a "Part 1" of nothing. It would get
   * no series crumb, no series link and no hub card — a series with the series missing,
   * which is exactly the shape ADR-0004 rules out. Checked here rather than in the
   * schema because it is the one rule the schema cannot see: it spans two directories.
   */
  const known = new Set(hubs.map((hub) => hub.slug));
  const dangling = getStories()
    .filter((story) => story.series && !known.has(story.series))
    .map((story) => `${story.series} (used by ${story.slug})`);
  if (dangling.length > 0) {
    throw new Error(`Unknown series slugs — add content/series/<slug>.md:\n  ${dangling.join("\n  ")}`);
  }

  return hubs.sort((a, b) => a.title.localeCompare(b.title));
}

export function getSeriesHub(slug: string): SeriesHub | undefined {
  return getSeries().find((s) => s.slug === slug);
}

/**
 * The series a children's page may show: series that are not adult-tier, holding the
 * episodes that are not either.
 *
 * Both halves matter. Hiding an adult episode is the obvious one; hiding an adult series
 * is the other, because a hub page is as linkable as a story and its *titles* are the
 * content. An adult series is listed on the tier shelf instead.
 *
 * The unfiltered `getSeries()` stays for the story route, which needs the whole episode
 * order to find a gated story's next part.
 */
export function getKidsSeries(): SeriesHub[] {
  return getSeries()
    .filter((hub) => !isAdult(hub.ageTier))
    .map((hub) => ({ ...hub, episodes: hub.episodes.filter((entry) => !isAdult(entry.ageTier)) }));
}

/** The series behind the gate, listed on the adult shelf. */
export function getAdultSeries(): SeriesHub[] {
  return getSeries().filter((hub) => isAdult(hub.ageTier));
}

/**
 * Bedtime first. The audit's theme finding was that "Night" — the most obvious bedtime
 * door — sat in alphabetical order between "Home" and "Wonder", and that themes were
 * treated as an afterthought. The order is curated, not alphabetical: Night, then Home
 * (the "cosy" one), then the rest by title.
 */
const THEME_PRIORITY = ["night", "home"];

function themeRank(slug: string): number {
  const rank = THEME_PRIORITY.indexOf(slug);
  return rank === -1 ? THEME_PRIORITY.length : rank;
}

export function getThemes(): ThemeHub[] {
  const hubs = readMarkdown("themes").map(({ file, data }) => {
    const result = themeSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid theme frontmatter:\n${describeIssues(file, result.error.issues)}`);
    }
    const fm = result.data;
    const expected = path.basename(file, ".md");
    if (fm.slug !== expected) {
      throw new Error(`${file}: slug "${fm.slug}" does not match filename "${expected}.md"`);
    }
    return {
      slug: fm.slug,
      title: fm.title,
      summary: fm.summary,
      url: `/themes/${fm.slug}/`,
      entries: getEntries()
        .filter((e) => e.themes.includes(fm.slug))
        .sort(byRatingThenRecency),
    };
  });

  // A story may only point at themes that exist, otherwise the hub link 404s.
  const known = new Set(hubs.map((h) => h.slug));
  const dangling = new Set<string>();
  for (const entry of getEntries()) {
    for (const theme of entry.themes) if (!known.has(theme)) dangling.add(`${theme} (used by ${entry.slug})`);
  }
  if (dangling.size > 0) {
    throw new Error(`Unknown theme slugs — add content/themes/<slug>.md:\n  ${[...dangling].join("\n  ")}`);
  }

  return hubs.sort((a, b) => themeRank(a.slug) - themeRank(b.slug) || a.title.localeCompare(b.title));
}

/**
 * Theme hubs with the gated stories taken out.
 *
 * A theme is not adult content — `courage` is `courage` at every tier — so a hub stays a
 * children's page and lists only what a children's page may link. The theme itself is
 * still valid on an adult story, which is why the frontmatter check above still reads
 * every entry: an adult story pointing at a theme that does not exist is a broken build,
 * not a hidden one.
 */
export function getKidsThemes(): ThemeHub[] {
  return getThemes().map((hub) => ({
    ...hub,
    entries: hub.entries.filter((entry) => !isAdult(entry.ageTier)),
  }));
}

export function getKidsThemeHub(slug: string): ThemeHub | undefined {
  return getKidsThemes().find((t) => t.slug === slug);
}

/** Latest first, capped — used by the home feed and RSS, so it stays on the kids shelf. */
export function getLatest(count: number): Entry[] {
  return getKidsEntries().slice(0, count);
}

export function getBylineOf(entry: Entry): string {
  return entry.byline;
}
