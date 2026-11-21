import Link from "next/link";
import { NavPanel } from "@/components/NavPanel";
import { accountsEnabled } from "@/lib/accounts";
import { genreShelvesAt, kidsLibrary } from "@/lib/browse";
import { COLLECTIONS, entriesForCollection } from "@/lib/collections";
import { getKidsEntries } from "@/lib/content";

/**
 * The main menu, grouped by the question a reader is asking rather than by where a page
 * lives on disk.
 *
 * The old menu was `Stories · Classics · Series · Themes · About`, five peers drawn from
 * three different axes, and the first of them was the trap: "Stories" listed originals, so
 * the one label that sounded like *everything* was in fact a subset. This one leads with
 * **All stories** (a page that really does hold every children's story), then the two
 * classifications a reader browses by, genre and series, each with the shelves it
 * actually holds, then the plain pages in a "More" group.
 *
 * Genre and series get panels rather than pages of their own because a menu that makes you
 * guess which genre you want, then loads a page to find out, is two steps for one question.
 * The panels are a NavPanel disclosure (site/components/NavPanel.tsx): hover or click on
 * desktop, focus for the keyboard, and on touch — where there is no hover — the trigger
 * link still goes to /browse/#genres and /series/, the same answers as pages.
 *
 * On a phone (site/app/globals.css, the ≤40rem block) the plain page links fold into the
 * Browse panel's "More" column and the caret shows, so the header is one row: the two
 * links a reader opens most, everything else one tap away in the panel. A no-JS phone
 * reader still reaches Themes and About from the footer, which carries them on every page;
 * the footer also carries Account, for the same reason.
 *
 * Render-time content reads are the build's problem, not the reader's — this is a static
 * export, and these are the same facts /browse/ prints.
 */
export function SiteHeader() {
  const genres = genreShelvesAt();
  const series = kidsLibrary().series;
  /* The length collections (ADR-0016 A5): the menu carries the ones that have entries,
     so a fixture build with one short shelf never links a page that was not built. */
  const collections = COLLECTIONS.map((collection) => ({
    href: "/collections/" + collection.slug + "/",
    label: collection.name,
    count: entriesForCollection(collection, getKidsEntries()).length,
  })).filter((collection) => collection.count > 0);

  return (
    <header className="header">
      <div className="page header__inner">
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2xs)" }}>
          <Link className="wordmark" href="/">
            Wishing<span className="wordmark__tale">Tales</span>
          </Link>
          {/*
           * The shelf promise beside the wordmark (issue #208): the age band is the
           * first fact a parent checks, and until now it only lived on cards. One
           * badge, not a tier switcher — the site ships one children's tier today.
           * On a phone it steps aside (globals.css): there the badge crowded the one
           * row the header has, and every card still opens with the same fact.
           */}
          <span className="nav__age">Ages 8-12</span>
        </div>

        <nav className="nav" aria-label="Main">
          <Link className="nav__link nav__link--lead" href="/browse/">
            All stories
          </Link>

          {/*
           * One Browse panel instead of two (issue #208): the two classifications a
           * reader browses by — genre and series — open under a single label, each
           * column keeping its own "all" link. The label still goes to /browse/ for
           * touch and no-JS readers, which carries both lists (ADR-0008's contract).
           * The third column, "More", is the plain pages: it exists for phones, where
           * their links are folded into this panel (globals.css hides it on desktop,
           * where the links are already in the nav).
           */}
          <NavPanel
            label="Browse"
            href="/browse/"
            groups={[
              {
                title: "Genres",
                items: genres.map((shelf) => ({ href: shelf.href, label: shelf.label, count: shelf.count })),
                href: "/browse/#genres",
                allLabel: "All genres",
              },
              {
                title: "Series",
                items: series.map((hub) => ({ href: hub.url, label: hub.title, count: hub.episodes.length })),
                href: "/series/",
                allLabel: "All series",
              },
              {
                title: "More",
                pages: true,
                items: [
                  ...collections,
                  { href: "/themes/", label: "Themes" },
                  { href: "/about/", label: "About" },
                  ...(accountsEnabled() ? [{ href: "/account/", label: "Account" }] : []),
                ],
              },
            ]}
          />

          <Link className="nav__link nav__link--page" href="/themes/">
            Themes
          </Link>
          <Link className="nav__link nav__link--page" href="/about/">
            About
          </Link>
          {accountsEnabled() ? (
            <Link className="nav__link nav__link--page" href="/account/">
              Account
            </Link>
          ) : null}
          {/*
           * The favorites shelf (ADR-0016 A1) as an icon link: it is a personal page, not
           * a classification, so it takes the last slot rather than a menu panel, and the
           * heart is the same affordance the cards carry. No accounts gate it — favorites
           * are a browser fact, not an account feature.
           */}
          <Link className="nav__heart" href="/favorites/" aria-label="Your favorites">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M12 21s-7.5-4.9-10-9.5C.5 8 2.5 4 6.5 4c2.4 0 4.2 1.3 5.5 3.2C13.3 5.3 15.1 4 17.5 4c4 0 6 4 4.5 7.5C19.5 16.1 12 21 12 21z" />
            </svg>
          </Link>
        </nav>
      </div>
    </header>
  );
}
