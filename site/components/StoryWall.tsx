"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StoryCard } from "@/components/StoryCard";
import type { Entry } from "@/lib/content";
import { TIME_FILTERS, inTimeFilter } from "@/lib/reading-time";
import {
  EMPTY_WALL,
  SORTS,
  matchesWall,
  readWallState,
  searchText,
  sortEntries,
  writeWallState,
  type SortId,
  type WallState,
} from "@/lib/wall";

/*
 * Page sizes follow the grid's own shape: two rows of its columns. 8 / 6 / 4 keeps a
 * page to one screenful of shelf. Paging and filtering are client-side only: the page
 * has no page-N URLs, and a reader without JavaScript gets the full wall.
 */
const DESKTOP = 8; // >= 960px: two rows of four
const TABLET = 6; // 640-959px: two rows of three
const PHONE = 4; // below 640px: two rows of two

type GenreFacet = { genre: string; label: string; count: number };
type ThemeFacet = { slug: string; title: string; count: number };

/**
 * The /browse/ card wall: search, filters, sort and paging in one state machine.
 *
 * Why one component rather than a pager plus a search box: the two answer the same
 * question ("what is left on the wall"), and two controllers over one list drift the
 * moment a filter changes what "page two" means. The state lives in the URL so a result
 * can be bookmarked; history.replaceState keeps the Back button for navigation rather
 * than for keystrokes.
 *
 * Every card stays in the DOM (ADR-0009). Filtering and paging only add .card--offpage,
 * which is display:none — so a reader without JavaScript still gets the whole wall, and
 * the crawl that checks children's pages link no adult page still sees every story link.
 * The toolbar only renders after hydration, for the same reason the pager did: controls
 * that do nothing are worse than no controls.
 */
export function StoryWall({
  entries,
  seriesTitles,
  genres,
  themes,
}: {
  entries: Entry[];
  seriesTitles: Map<string, string>;
  genres: GenreFacet[];
  themes: ThemeFacet[];
}) {
  const [state, setState] = useState<WallState>(EMPTY_WALL);
  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DESKTOP);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  const themeTitles = useMemo(() => new Map(themes.map((theme) => [theme.slug, theme.title])), [themes]);
  const haystacks = useMemo(
    () =>
      new Map(
        entries.map((entry) => [
          entry.slug,
          searchText(entry, entry.series ? seriesTitles.get(entry.series) : undefined, themeTitles),
        ]),
      ),
    [entries, seriesTitles, themeTitles],
  );

  useEffect(() => {
    const sync = () => setState(readWallState(window.location.search));
    sync();
    setMounted(true);
    const compute = () => {
      const width = window.innerWidth;
      setSize(width >= 960 ? DESKTOP : width >= 640 ? TABLET : PHONE);
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  /* Keep the URL shareable without adding a history entry per keystroke. */
  useEffect(() => {
    if (!mounted) return;
    const qs = writeWallState(state);
    const next = qs
      ? window.location.pathname + "?" + qs
      : window.location.pathname;
    if (window.location.pathname + window.location.search !== next) {
      window.history.replaceState(null, "", next + (window.location.hash || ""));
    }
  }, [state, mounted]);

  /* A new question starts on page one. */
  useEffect(() => {
    setPage(0);
  }, [state.q, state.time, state.genre, state.theme, state.sort]);

  const ordered = useMemo(() => sortEntries(entries, state.sort), [entries, state.sort]);
  const filtered = useMemo(
    () => ordered.filter((entry) => matchesWall(entry, state, haystacks.get(entry.slug) ?? "")),
    [ordered, state, haystacks],
  );
  const positions = useMemo(
    () => new Map(filtered.map((entry, index) => [entry.slug, index])),
    [filtered],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, totalPages - 1);
  const from = current * size;
  const to = Math.min(filtered.length, from + size);

  const timeCounts = useMemo(
    () =>
      Object.fromEntries(
        TIME_FILTERS.map((filter) => [
          filter.id,
          entries.filter((entry) => inTimeFilter(filter, entry.readingTime)).length,
        ]),
      ) as Record<string, number>,
    [entries],
  );

  const activeFilters =
    Number(Boolean(state.time)) + Number(Boolean(state.genre)) + Number(Boolean(state.theme));
  const hasQuery = Boolean(state.q.trim()) || activeFilters > 0;
  const status = hasQuery
    ? filtered.length === 1
      ? "1 story matches"
      : filtered.length + " stories match"
    : filtered.length === 1
      ? "1 story"
      : filtered.length + " stories";

  const go = (next: number) => {
    setPage(Math.max(0, Math.min(next, totalPages - 1)));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    anchorRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  };

  const clear = () => setState({ ...EMPTY_WALL, sort: state.sort });

  return (
    <>
      {mounted ? (
        <>
          <div className="wall__tools">
            <div className="wall__search" role="search">
              <label className="visually-hidden" htmlFor="story-search">
                Search stories
              </label>
              <input
                id="story-search"
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                value={state.q}
                onChange={(event) => setState({ ...state, q: event.target.value })}
                placeholder="Try lantern, funny, or Aladdin"
              />
            </div>

            <div className="wall__controls">
              <button
                type="button"
                className="wall__toggle"
                aria-expanded={filtersOpen}
                aria-controls="wall-filters"
                onClick={() => setFiltersOpen((open) => !open)}
              >
                Filters{activeFilters ? " (" + activeFilters + ")" : ""}
              </button>
              <label className="visually-hidden" htmlFor="story-sort">
                Sort stories
              </label>
              <select
                id="story-sort"
                className="wall__sort"
                value={state.sort}
                onChange={(event) => setState({ ...state, sort: event.target.value as SortId })}
              >
                {SORTS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            id="wall-filters"
            className={"wall__filters" + (filtersOpen ? " wall__filters--open" : "")}
          >
            <fieldset className="wall__group">
              <legend>How long have you got?</legend>
              <div className="wall__chips">
                {TIME_FILTERS.map((filter) => (
                  <Chip
                    key={filter.id}
                    pressed={state.time === filter.id}
                    count={timeCounts[filter.id]}
                    onClick={() =>
                      setState({ ...state, time: state.time === filter.id ? "" : filter.id })
                    }
                  >
                    {filter.label}
                  </Chip>
                ))}
              </div>
            </fieldset>

            {themes.length > 0 ? (
              <fieldset className="wall__group">
                <legend>Feeling</legend>
                <div className="wall__chips">
                  {themes.map((theme) => (
                    <Chip
                      key={theme.slug}
                      pressed={state.theme === theme.slug}
                      count={theme.count}
                      onClick={() =>
                        setState({ ...state, theme: state.theme === theme.slug ? "" : theme.slug })
                      }
                    >
                      {theme.title}
                    </Chip>
                  ))}
                </div>
              </fieldset>
            ) : null}

            <fieldset className="wall__group">
              <legend>Genre</legend>
              <div className="wall__chips">
                {genres.map((shelf) => (
                  <Chip
                    key={shelf.genre}
                    pressed={state.genre === shelf.genre}
                    count={shelf.count}
                    onClick={() =>
                      setState({ ...state, genre: state.genre === shelf.genre ? "" : shelf.genre })
                    }
                  >
                    {shelf.label}
                  </Chip>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="wall__status">
            <p role="status" aria-live="polite">
              {status}
            </p>
            {hasQuery ? (
              <button type="button" className="wall__clear" onClick={clear}>
                Clear search and filters
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      <div ref={anchorRef} className="wall-anchor" aria-hidden="true" />

      {filtered.length > 0 ? (
        <div className="grid grid--wide">
          {ordered.map((entry) => {
            const position = positions.get(entry.slug);
            return (
              <StoryCard
                key={entry.slug}
                entry={entry}
                seriesTitle={entry.series ? seriesTitles.get(entry.series) : undefined}
                offpage={mounted && (position === undefined || position < from || position >= to)}
              />
            );
          })}
        </div>
      ) : mounted ? (
        <div className="wall__empty">
          <h3 className="wall__empty-title">No stories match yet</h3>
          <p>Try a shorter word, or remove a filter. Clearing everything shows all {entries.length}.</p>
          <button type="button" className="btn btn--primary" onClick={clear}>
            Show all stories
          </button>
        </div>
      ) : null}

      {mounted && totalPages > 1 ? (
        <>
          <nav className="pager" aria-label="Story pages">
            <button className="pager__prev" onClick={() => go(current - 1)} disabled={current === 0}>
              Previous
            </button>
            {pageList(current, totalPages).map((item, index) =>
              item === "gap" ? (
                <span key={"gap" + index} className="pager__gap" aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  className="pager__page"
                  aria-current={item === current ? "page" : undefined}
                  onClick={() => go(item)}
                >
                  {item + 1}
                </button>
              )
            )}
            <button
              className="pager__next"
              onClick={() => go(current + 1)}
              disabled={current === totalPages - 1}
            >
              Next
            </button>
          </nav>
          <p className="pager__note">
            Showing {from + 1}–{to} of {filtered.length} stories
          </p>
        </>
      ) : null}
    </>
  );
}

function Chip({
  pressed,
  count,
  onClick,
  children,
}: {
  pressed: boolean;
  count?: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={"chip" + (pressed ? " chip--on" : "")}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
      {typeof count === "number" ? (
        <span className="chip__count">
          {count}
          <span className="visually-hidden"> {count === 1 ? "story" : "stories"}</span>
        </span>
      ) : null}
    </button>
  );
}

/** First and last pages always; the current page and its neighbours; gaps beyond. */
function pageList(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, n) => n);
  const items: (number | "gap")[] = [0];
  const start = Math.max(1, current - 1);
  const end = Math.min(total - 2, current + 1);
  if (start > 1) items.push("gap");
  for (let n = start; n <= end; n++) items.push(n);
  if (end < total - 2) items.push("gap");
  items.push(total - 1);
  return items;
}
