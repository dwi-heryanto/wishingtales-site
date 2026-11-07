import type { AgeTier, Genre } from "./tiers";

/**
 * The words on a shelf.
 *
 * A genre page and an age page used to be one templated line each — "19 stories — folk tale
 * written for ages 8-12" — which is a label, not a page: it gave a search engine nothing to
 * match and a parent nothing to decide with (issue #111). The copy lives here, written per
 * shelf; the pages add the facts they own — how many stories, how long each runs — and links
 * to real stories, so no two shelves read alike.
 *
 * `summary` is written to stand alone: it opens the meta description. `body` is the intro
 * above the list. Neither names a story, because which stories sit on a shelf changes every
 * time the pipeline publishes; the page links the ones that are actually there.
 */
export type ShelfCopy = {
  summary: string;
  body: string;
};

/** One entry per genre. The tier sentence and the counts come from the page. */
export const GENRE_COPY: Record<Genre, ShelfCopy> = {
  adventure: {
    summary: "Adventure stories are journeys with something at stake and a hero who has to decide.",
    body: "The journeys here are short — a hill, a harbour, a door that was not there yesterday — and the danger is real without being frightening. Most take one sitting, which makes them good to read aloud.",
  },
  "animal story": {
    summary: "Animal stories let a reader try on another life for a few minutes.",
    body: "The animals are not decorations: they want things, they are proud or loyal or tired, and they notice what the people around them miss. Gentle enough for bedtime, and often the stories a younger reader asks for again.",
  },
  "everyday magic": {
    summary: "Everyday magic is the kind that could happen on your own street.",
    body: "A kettle that remembers, a map that is right too often, a shop that is only there on Tuesdays. The magic is small, the people are ordinary, and the world looks like the reader's own — which is exactly why it lands.",
  },
  family: {
    summary: "Family stories are about the people a reader already lives with.",
    body: "Brothers and sisters who are tired of each other, grandparents with a story to tell, a house full of noise that turns out to be the point. Nothing here needs a kingdom; the stakes are the ones at the kitchen table.",
  },
  fantasy: {
    summary: "Fantasy is the biggest tent here: invented worlds, old magic, rules worth learning.",
    body: "The magic keeps its own rules — the cost is real and it does not bend for the hero — and the stories run long enough to feel like a place. Good for a reader who has finished the folk tales and wants somewhere new.",
  },
  "folk tale": {
    summary: "Folk tales are the old stories, told aloud long before anyone wrote them down.",
    body: "These retellings keep the shape that made them last: three attempts, a clever youngest child, a kindness repaid at the worst possible moment. Most take a single sitting, which makes this the easiest shelf to read aloud.",
  },
  funny: {
    summary: "Funny stories are the ones a reader asks you to read twice, out loud.",
    body: "The humour is domestic: a rebellion in the laundry basket, a plan that cannot possibly work, a grown-up who is wrong in an obvious way. Short and quick, and written to be performed rather than read silently.",
  },
  mystery: {
    summary: "Mystery stories hand a reader a question and the clues to answer it.",
    body: "Nothing here is grim — the puzzle is a missing thing, a detail that does not fit, a door that should have been locked. A careful reader can usually solve it a page before the hero does, which is the point.",
  },
  "myth and legend": {
    summary: "Myth and legend are the stories people once used to explain the world.",
    body: "A bargain that has to be honoured, a light in the sky that somebody had to put there, gods with bad tempers and good reasons. These retellings keep the old weight without the old cruelty.",
  },
  quest: {
    summary: "Quest stories are about a thing that has to be fetched, and the road there.",
    body: "There is a destination, a companion, and at least one moment where turning back would be the sensible choice. The road is short enough for one sitting, and the ending is earned rather than handed over.",
  },
  "slice of life": {
    summary: "Slice-of-life stories are quiet on purpose: a day, a neighbour, one small change.",
    body: "Nothing is at stake except how somebody feels about it, which is often the hardest thing to write and the easiest to recognise. Good for the end of a long day, and for readers who find adventures tiring.",
  },
  spooky: {
    summary: "Spooky stories are creaking-floorboard scary, not nightmare scary.",
    body: "A light that will not go out, a staircase that whispers, a house that keeps a ledger of the hours. At this age the fright is a shiver and the ending is safe — which is why they get asked for again.",
  },
  horror: {
    summary: "Horror is the one genre written for the older shelf, where the fright is allowed to stay.",
    body: "These stories carry dread and consequence, and the ending does not always resolve warmly. They are written for teenagers and adults; nothing else on the site is like them.",
  },
};

/** The age shelves, in their own voice. Only the tiers that ship have an entry. */
export const TIER_COPY: Partial<Record<AgeTier, ShelfCopy>> = {
  "8-12": {
    summary: "Stories for 8-12 year olds: long enough to be a real story, short enough for one sitting.",
    body: "Every story on this shelf is written for readers of eight to twelve: a proper story with a beginning and an end, and short enough to finish before bedtime. They can be read aloud to a child, or read alone by one.",
  },
  "13+": {
    summary: "The 13+ shelf: longer stories, more consequence, and endings allowed to be complicated.",
    body: "These are written for teenagers and adults — more interiority, more weight, and a tone the children's shelves do not use. The notice before a story is the gate; everything on the other shelves is for younger readers.",
  },
};

/** What a shelf's own stories say about it: how many, and how long they run. */
export function shelfStats(entries: { readingTime: number }[]): { count: number; min: number; max: number } {
  const times = entries.map((entry) => entry.readingTime);
  return { count: entries.length, min: Math.min(...times), max: Math.max(...times) };
}

/** "12 minutes" or "9–15 minutes" — the range this shelf actually holds. */
export function minutesLabel(min: number, max: number): string {
  return min === max ? `${min} minutes` : `${min}–${max} minutes`;
}

/** The meta description: the shelf's own sentence plus the facts only that shelf has. */
export function shelfDescription(
  copy: ShelfCopy,
  stats: { count: number; min: number; max: number },
): string {
  const stories = stats.count === 1 ? "One story" : `${stats.count} stories`;
  return `${copy.summary} ${stories}, ${minutesLabel(stats.min, stats.max)} each.`;
}

/** The line under the intro, before the list: the count, the length, and how to read them. */
export function shelfFacts(stats: { count: number; min: number; max: number }): string {
  const stories = stats.count === 1 ? "One story here" : `${stats.count} stories here`;
  return `${stories}, ${minutesLabel(stats.min, stats.max)} each — read aloud or read alone.`;
}
