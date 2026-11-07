import Link from "next/link";
import { NavPanel } from "@/components/NavPanel";
import { genreShelvesAt, kidsLibrary } from "@/lib/browse";

/**
 * The main menu, grouped by the question a reader is asking rather than by where a page
 * lives on disk.
 *
 * The old menu was `Stories · Classics · Series · Themes · About`, five peers drawn from
 * three different axes, and the first of them was the trap: "Stories" listed originals, so
 * the one label that sounded like *everything* was in fact a subset. This one leads with
 * **All stories** (a page that really does hold every children's story), then the two
 * classifications a reader browses by — genre and series — each with the shelves it
 * actually holds, then themes and about.
 *
 * Genre and series get panels rather than pages of their own because a menu that makes you
 * guess which genre you want, then loads a page to find out, is two steps for one question.
 * The panels are a NavPanel disclosure (site/components/NavPanel.tsx): hover or click on
 * desktop, focus for the keyboard, and on touch — where there is no hover — the trigger
 * link still goes to /browse/#genres and /series/, the same answers as pages.
 *
 * Render-time content reads are the build's problem, not the reader's — this is a static
 * export, and these are the same facts /browse/ prints.
 */
export function SiteHeader() {
  const genres = genreShelvesAt();
  const series = kidsLibrary().series;

  return (
    <header className="header">
      <div className="page header__inner">
        <Link className="wordmark" href="/">
          Wishing<span className="wordmark__tale">Tales</span>
        </Link>

        <nav className="nav" aria-label="Main">
          <Link className="nav__link nav__link--lead" href="/browse/">
            All stories
          </Link>

          <NavPanel
            label="Genres"
            href="/browse/#genres"
            items={genres.map((shelf) => ({ href: shelf.href, label: shelf.label, count: shelf.count }))}
            allLabel="All genres"
          />

          <NavPanel
            label="Series"
            href="/series/"
            align="end"
            items={series.map((hub) => ({ href: hub.url, label: hub.title, count: hub.episodes.length }))}
            allLabel="All series"
          />

          <Link className="nav__link" href="/themes/">
            Themes
          </Link>
          <Link className="nav__link" href="/about/">
            About
          </Link>
        </nav>
      </div>
    </header>
  );
}
