#!/usr/bin/env node
/**
 * Exercises the built site in headless Chrome the way a reader would: change the
 * text size, switch theme, turn on read-aloud mode, read half a story, come back
 * to the home page. Also re-checks the phone widths for horizontal overflow.
 *
 *   pnpm build:fixture && pnpm verify:reader     # or after pnpm build
 *
 * Exits non-zero on failure.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createReporter, goto, launchBrowser, startStaticServer } from "./lib/browser.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "site", "out");
const PORT = 8123;
const STORY = "/8-12/adventure/the-first-lantern/";

if (!fs.existsSync(OUT)) {
  console.error("site/out does not exist — run pnpm build (or pnpm build:fixture) first.");
  process.exit(1);
}


/** Turns any computed colour into a WCAG contrast ratio, using the browser's own
 *  colour parsing (the themes are authored in OKLCH, which JS cannot convert). */
const CONTRAST_PROBE = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  function toRgb(color) {
    ctx.fillStyle = "#010203";
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    return [data[0], data[1], data[2]];
  }

  function luminance(rgb) {
    const channel = (value) => {
      const s = value / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
  }

  function effectiveBackground(element) {
    let node = element;
    while (node) {
      const background = getComputedStyle(node).backgroundColor;
      if (background && background !== "rgba(0, 0, 0, 0)" && background !== "transparent") return background;
      node = node.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  }

  window.__contrast = (targets) =>
    targets.map(({ selector, label, min }) => {
      const element = document.querySelector(selector);
      if (!element) return { label, missing: true };
      const style = getComputedStyle(element);
      const foreground = toRgb(style.color);
      const background = toRgb(effectiveBackground(element));
      const lightest = Math.max(luminance(foreground), luminance(background));
      const darkest = Math.min(luminance(foreground), luminance(background));
      return {
        label,
        ratio: Math.round(((lightest + 0.05) / (darkest + 0.05)) * 100) / 100,
        min,
        px: Math.round(parseFloat(style.fontSize)),
        weight: style.fontWeight,
      };
    });
})()`;

const STORY_TARGETS = [
  { selector: ".prose p", label: "story text", min: 4.5 },
  { selector: ".reader__summary", label: "standfirst", min: 4.5 },
  { selector: ".reader__meta span", label: "byline and date", min: 4.5 },
  { selector: ".eyebrow", label: "eyebrow label", min: 4.5 },
  { selector: ".controls__summary", label: "settings summary", min: 4.5 },
  { selector: ".control", label: "control label", min: 4.5 },
  { selector: ".reader__end-note a", label: "closing link", min: 4.5 },
  { selector: ".next-up a", label: "next-story link", min: 4.5 },
];

/*
 * The browse surfaces. The genre counts and the shelf cards are new text at 13–14px, which
 * is small text by WCAG's definition, so they are measured rather than eyeballed — the
 * counts sit on `--ink-faint` and one theme is always the one that fails.
 */
const BROWSE_TARGETS = [
  { selector: ".tag", label: "genre chip", min: 4.5 },
  { selector: ".tag__count", label: "genre chip count", min: 4.5 },
  { selector: ".shelf-card__title", label: "shelf card title", min: 4.5 },
  { selector: ".shelf-card__note", label: "shelf card note", min: 4.5 },
  { selector: ".shelf-card__unit", label: "shelf card unit", min: 4.5 },
  { selector: ".nav__panel-count", label: "nav panel count", min: 4.5 },
];

const HOME_TARGETS = [
  { selector: ".featured__summary", label: "featured summary", min: 4.5 },
  { selector: ".featured__meta", label: "featured meta", min: 4.5 },
  { selector: ".card__meta", label: "card meta", min: 4.5 },
  { selector: ".card__title", label: "card title", min: 4.5 },
  { selector: ".entry-list__meta", label: "list meta", min: 4.5 },
  { selector: ".btn--primary", label: "primary button", min: 4.5 },
  { selector: ".section__link", label: "section link", min: 4.5 },
];

async function checkContrast(theme, url, targets, label) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 2, mobile: true });
  await goto(cdp, server.origin, url);
  // Measure with motion switched off rather than sleeping and hoping. A
  // background colour still animating for a frame reads as the *previous*
  // theme, which produced a false "primary button 1.13:1" on CI while passing
  // locally - identical code, different frame timing.
  await cdp.evaluate(`(() => {
    document.documentElement.setAttribute("data-reader-theme", "${theme}");
    if (!document.getElementById("no-motion-for-measurement")) {
      const style = document.createElement("style");
      style.id = "no-motion-for-measurement";
      style.textContent = "*{transition:none !important;animation:none !important}";
      document.head.appendChild(style);
    }
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await cdp.evaluate(CONTRAST_PROBE);
  const rows = await cdp.evaluate("window.__contrast(" + JSON.stringify(targets) + ")");

  const missing = rows.filter((row) => row.missing).map((row) => row.label);
  const failures = rows.filter((row) => !row.missing && row.ratio < row.min);
  const measured = rows.filter((row) => !row.missing);
  const lowest = measured.reduce((worst, row) => (row.ratio < worst.ratio ? row : worst), measured[0]);

  reporter.check(
    `${theme} · ${label}: all text meets WCAG AA`,
    failures.length === 0 && missing.length === 0,
    failures.length
      ? failures.map((row) => row.label + " " + row.ratio + ":1 (needs " + row.min + ")").join(", ")
      : missing.length
        ? "not found: " + missing.join(", ")
        : `lowest ${lowest.ratio}:1 — ${lowest.label}`,
  );
  return measured;
}

const reporter = createReporter();
const server = await startStaticServer(OUT, PORT);
const { cdp, close } = await launchBrowser({ workspace: ROOT, port: 8124, debuggingPort: 9333 });

try {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

  // ---- a reading session on the story page ---------------------------------
  // Land on the origin first: localStorage is not reachable from about:blank.
  await goto(cdp, server.origin, "/");
  await cdp.evaluate("localStorage.clear()");
  await goto(cdp, server.origin, STORY);

  const heading = await cdp.evaluate("document.querySelector('h1')?.textContent ?? ''");
  reporter.check("story page renders its title", heading.includes("Lantern"), heading);

  /*
   * The cover is the largest paint on this page, so it must not be lazy; and since issue
   * #114 it is a <picture> offering AVIF and WebP at two sizes, with the JPEG as the
   * fallback for everything else. This reads the markup the browser actually got.
   */
  const cover = await cdp.evaluate(`(() => {
    const img = document.querySelector(".reader__figure img");
    if (!img) return null;
    const picture = img.closest("picture");
    const sources = picture ? [...picture.querySelectorAll("source")] : [];
    return {
      w: img.getAttribute("width"),
      h: img.getAttribute("height"),
      eager: img.getAttribute("loading") !== "lazy",
      priority: img.getAttribute("fetchpriority"),
      types: sources.map((source) => source.getAttribute("type")),
      twoSizes: sources.every((source) => (source.getAttribute("srcset") || "").includes("256w") && (source.getAttribute("srcset") || "").includes("512w")),
    };
  })()`);
  reporter.check(
    "cover is eager, sized, and offered as AVIF and WebP at two sizes",
    cover && cover.w === "512" && cover.h === "768" && cover.eager && cover.priority === "high" &&
      cover.types.includes("image/avif") && cover.types.includes("image/webp") && cover.twoSizes,
    JSON.stringify(cover),
  );

  /*
   * Native radios (ADR-0009): the old "S / M / L" buttons carried their name in a
   * `title` and had no group semantics. The control is now an input whose accessible
   * name is the thing it does, so the probe clicks the input the way a reader would.
   */
  await cdp.evaluate("document.querySelector('input[name=\"reader-scale\"][aria-label=\"Larger text\"]').click()");
  const scaleAfter = await cdp.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--reader-scale').trim()");
  const storedScale = await cdp.evaluate("localStorage.getItem('wt:scale')");
  const proseSize = await cdp.evaluate("getComputedStyle(document.querySelector('.prose')).fontSize");
  reporter.check("larger text changes the prose size and is stored", scaleAfter === "1.26" && storedScale === "1.26", `scale=${scaleAfter} prose=${proseSize}`);

  await cdp.evaluate("document.querySelector('input[name=\"reader-leading\"][aria-label=\"Loose spacing\"]').click()");
  const leading = await cdp.evaluate("getComputedStyle(document.querySelector('.prose')).lineHeight");
  reporter.check("line spacing control applies", Number.parseFloat(leading) > 30, `line-height=${leading}`);

  // Force light first so the switch is observable, and let the frame settle:
  // colours still animate for one frame even under reduced motion, so an
  // immediate read returns the previous value.
  const paperLightness = `(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const rgb = (color) => {
      ctx.fillStyle = "#010203";
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
    };
    const [r, g, b] = rgb(getComputedStyle(document.body).backgroundColor);
    return Math.round((0.2126 * r + 0.7152 * g + 0.0722 * b) * 100) / 100;
  })()`;

  await cdp.evaluate('document.documentElement.setAttribute("data-reader-theme", "light")');
  await new Promise((resolve) => setTimeout(resolve, 250));
  const lightPaper = await cdp.evaluate(paperLightness);

  /* Selecting the theme that is already applied fires no change event, so force the
     light choice first: on a dark-OS machine the pre-paint script has already chosen
     dark, and a click on the checked dark radio would be a no-op. */
  await cdp.evaluate("document.querySelector('input[name=\"reader-theme\"][value=\"light\"]').click()");
  await new Promise((resolve) => setTimeout(resolve, 250));
  await cdp.evaluate("document.querySelector('input[name=\"reader-theme\"][value=\"dark\"]').click()");
  await new Promise((resolve) => setTimeout(resolve, 250));
  const theme = await cdp.evaluate("document.documentElement.getAttribute('data-reader-theme')");
  const storedTheme = await cdp.evaluate("localStorage.getItem('wt:theme')");
  const darkPaper = await cdp.evaluate(paperLightness);
  reporter.check(
    "dark theme applies, repaints and is stored",
    theme === "dark" && storedTheme === "dark" && darkPaper < lightPaper - 40,
    `paper lightness ${lightPaper} -> ${darkPaper}`,
  );

  await cdp.evaluate("[...document.querySelectorAll('.controls button')].find((b) => b.textContent.includes('Read-aloud')).click()");
  const readAloud = await cdp.evaluate(`(() => ({
    mode: document.documentElement.getAttribute("data-mode"),
    stored: localStorage.getItem("wt:mode"),
    header: getComputedStyle(document.querySelector(".header")).display,
    footer: getComputedStyle(document.querySelector(".footer")).display,
  }))()`);
  reporter.check(
    "read-aloud mode hides the chrome",
    readAloud.mode === "read-aloud" && readAloud.header === "none" && readAloud.footer === "none",
    JSON.stringify(readAloud),
  );

  await cdp.evaluate("document.documentElement.removeAttribute('data-mode')");
  await cdp.evaluate("window.scrollTo(0, Math.round(document.documentElement.scrollHeight * 0.45))");
  await new Promise((resolve) => setTimeout(resolve, 400));
  const progress = await cdp.evaluate(`(() => {
    const bar = document.querySelector("[data-progress-bar] .progress__bar");
    const stored = JSON.parse(localStorage.getItem("wt:progress") ?? "{}");
    const entry = Object.values(stored)[0];
    return { width: bar ? getComputedStyle(bar).getPropertyValue("--progress").trim() : null, pct: entry ? entry.pct : null };
  })()`);
  reporter.check("progress bar advances and is remembered", Number.parseFloat(progress.width) > 5 && progress.pct > 5, JSON.stringify(progress));

  // ---- settings survive a real navigation ----------------------------------
  await goto(cdp, server.origin, "/");
  const restored = await cdp.evaluate(`(() => ({
    theme: document.documentElement.getAttribute("data-reader-theme"),
    scale: getComputedStyle(document.documentElement).getPropertyValue("--reader-scale").trim(),
  }))()`);
  reporter.check("stored settings are applied on load, untouched", restored.theme === "dark" && restored.scale === "1.26", JSON.stringify(restored));

  const resumeTitle = await cdp.evaluate(`(() => {
    const section = [...document.querySelectorAll("section")].find((s) => s.textContent.includes("Carry on reading"));
    return section ? section.querySelector("a")?.textContent ?? "" : "";
  })()`);
  reporter.check("home offers to carry on reading, naming the story", resumeTitle.includes("Lantern"), resumeTitle);

  // ---- the menu, and the page it promises ----------------------------------
  // The old menu said "Stories" and meant originals, with the classics somewhere else: the
  // one label that sounded like everything was a subset, which is the confusion the
  // revamp exists to end. These checks keep "All stories" honest — a page that really
  // holds the whole children's library, with the classification on it.
  await goto(cdp, server.origin, "/");
  const menu = await cdp.evaluate(`(() => {
    const links = [...document.querySelectorAll(".nav a")].map((a) => ({ text: a.textContent.trim(), href: a.getAttribute("href") }));
    return { count: links.length, lead: links[0] };
  })()`);
  reporter.check(
    "the menu leads with All stories and it goes to the whole library",
    menu.lead && menu.lead.text === "All stories" && menu.lead.href === "/browse/",
    JSON.stringify(menu.lead),
  );

  await goto(cdp, server.origin, "/browse/");
  const browse = await cdp.evaluate(`(() => {
    const titles = [...document.querySelectorAll(".card__title")].map((el) => el.textContent.trim());
    /*
     * The genre chips, scoped to their own section: /browse/ gained a second chip row for
     * the reading-time shelves (issue #115), and a check that means "every genre chip"
     * has to say which chips it means.
     */
    const chips = [...document.querySelectorAll("#genres .tag")].map((el) => ({ text: el.textContent.trim(), href: el.getAttribute("href") }));
    const timeChips = [...document.querySelectorAll("#reading-time .tag")].map((el) => ({ text: el.textContent.trim(), href: el.getAttribute("href") }));
    const shelves = [...document.querySelectorAll(".shelf-card")].map((el) => el.textContent.replace(/\\s+/g, " ").trim());
    const meta = [...document.querySelectorAll(".card__meta")].map((el) => el.textContent.trim());
    return { h1: document.querySelector("h1")?.textContent.trim() ?? "", titles, chips, timeChips, shelves, meta };
  })()`);

  /*
   * A shelf row must start its cover and its text on the same line. Baseline alignment
   * put the cover's bottom edge on the meta line in some engines and its top at the row in
   * others — the broken row a reader reported on /stories/ (2026-10-19).
   */
  await goto(cdp, server.origin, "/stories/");
  const shelfRow = await cdp.evaluate(`(() => {
    const item = document.querySelector(".entry-list__item");
    if (!item) return null;
    const link = item.querySelector(".entry-list__link");
    const cover = item.querySelector(".entry-list__cover").getBoundingClientRect();
    const meta = item.querySelector(".entry-list__meta").getBoundingClientRect();
    const summary = item.querySelector(".entry-list__summary").getBoundingClientRect();
    return {
      align: getComputedStyle(link).alignItems,
      topOffset: Math.round(meta.top - cover.top),
      bottomOverhang: Math.round(summary.bottom - cover.bottom),
    };
  })()`);
  reporter.check(
    "a shelf row starts its cover and its text on the same line",
    /* The row grows to whichever is taller; only the shared starting line is the contract. */
    shelfRow && shelfRow.align === "start" && Math.abs(shelfRow.topOffset) <= 2,
    JSON.stringify(shelfRow),
  );

  await goto(cdp, server.origin, "/browse/");
  reporter.check("the browse page is titled All stories", browse.h1 === "All stories", browse.h1);
  reporter.check(
    "browse lists every story card, each one once",
    browse.titles.length >= 3 && new Set(browse.titles).size === browse.titles.length,
    browse.titles.length + " cards: " + browse.titles.slice(0, 3).join(", "),
  );
  reporter.check(
    "the cards name a genre (the classification, on the card)",
    browse.meta.length === browse.titles.length && browse.meta.every((line) => /^[A-Z]/.test(line)),
    browse.meta.slice(0, 3).join(" | "),
  );
  /*
   * One chip is enough here, and the real corpus check (verify-build) is what requires both
   * bands: the fixture library is three short stories, so only "short reads" has anything on
   * it. This asserts the mechanism — a chip row that links to the time shelves.
   */
  reporter.check(
    "the reading-time shelves are reachable from the hub",
    browse.timeChips.length >= 1 && browse.timeChips.every((chip) => /^\/reading-time\/[a-z0-9-]+\/$/.test(chip.href)),
    JSON.stringify(browse.timeChips),
  );
  reporter.check(
    "every genre chip carries a count and a real shelf address",
    browse.chips.length > 0 && browse.chips.every((chip) => /\d+\s*stor(?:y|ies)$/.test(chip.text) && /^\/8-12\//.test(chip.href)),
    JSON.stringify(browse.chips.slice(0, 4)),
  );
  reporter.check(
    "the shelves offer age, kind, series and theme",
    ["Stories for 8-12", "Original stories", "Retold classics"].every((label) => browse.shelves.some((shelf) => shelf.includes(label))),
    browse.shelves.length + " shelf cards",
  );

  // ---- contrast in every reader theme --------------------------------------
  // Sanity check first: if the colour probe were broken (canvas refusing an
  // OKLCH value) every ratio would come back near 1:1 and the rest would be noise.
  const lightStoryText = await checkContrast("light", STORY, [STORY_TARGETS[0]], "probe sanity");
  reporter.check(
    "colour probe resolves OKLCH to a plausible ratio",
    lightStoryText[0].ratio > 8,
    lightStoryText[0].ratio + ":1 for near-black on cream",
  );

  const ratios = [];
  for (const theme of ["light", "sepia", "dark"]) {
    ratios.push(...(await checkContrast(theme, STORY, STORY_TARGETS.slice(1), "story page")));
    ratios.push(...(await checkContrast(theme, "/", HOME_TARGETS, "home page")));
    ratios.push(...(await checkContrast(theme, "/browse/", BROWSE_TARGETS, "browse page")));
    // The shelf row is the list a parent scans: its meta line is the one that measured
    // 4.97:1 before the audit, so it is measured on its own page as well as at home.
    ratios.push(
      ...(await checkContrast(
        theme,
        "/stories/",
        [
          { selector: ".entry-list__meta", label: "shelf row meta", min: 4.5 },
          { selector: ".entry-list__title", label: "shelf row title", min: 4.5 },
          { selector: ".entry-list__summary", label: "shelf row summary", min: 4.5 },
        ],
        "shelf list",
      )),
    );
  }

  // ---- phone widths --------------------------------------------------------
  for (const width of [320, 375, 414, 768]) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 2, mobile: width < 768 });
    // The shelf page is in this list because a shelf's intro and facts line are the newest
    // wide things on it: a long paragraph above a list is where a phone starts to scroll
    // sideways (issue #111).
    for (const url of ["/", STORY, "/stories/", "/classics/", "/browse/", "/8-12/adventure/"]) {
      await goto(cdp, server.origin, url);
      const overflow = await cdp.evaluate(`(() => {
        const vw = document.documentElement.clientWidth;
        const wide = [...document.querySelectorAll("body *")].filter((el) => {
          if (el.classList.contains("skip-link")) return false;
          const rect = el.getBoundingClientRect();
          return (rect.width > 0 || rect.height > 0) && (rect.right > vw + 1 || rect.left < -1);
        });
        return { vw, scrollWidth: document.documentElement.scrollWidth, offenders: wide.slice(0, 3).map((el) => el.tagName + "." + (el.className || "").toString().slice(0, 30)) };
      })()`);
      reporter.check(
        `no horizontal overflow at ${width}px — ${url}`,
        overflow.scrollWidth <= overflow.vw && overflow.offenders.length === 0,
        overflow.offenders.length ? JSON.stringify(overflow) : "",
      );
    }
  }

  // ---- touch targets and the shelf row's own words --------------------------
  /*
   * A finger needs 44px. The header grows its hit area with a pseudo-element so the bar does
   * not move; the chips and the pager grow for real on a phone. Measured by hit-testing, not
   * by reading boxes: the point of a hit area is that a tap lands on the control.
   */
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 375, height: 900, deviceScaleFactor: 2, mobile: true });
  await goto(cdp, server.origin, "/browse/");
  /*
   * Scroll each control into view before hit-testing: the first version measured a chip
   * 1006px down a 900px viewport, so elementFromPoint returned null and the check failed
   * for the wrong reason.
   */
  /* A previous run may have left read-aloud mode on, which hides the header by design. */
  await cdp.evaluate('localStorage.removeItem("wt:mode")');
  await goto(cdp, server.origin, "/browse/");
  const taps = await cdp.evaluate(`(() => {
    /* The first match with a box: the header also renders collapsed panel links, which have
     * none, and a check that measures one of those reports h=0 for nothing. */
    const visible = (selector) => [...document.querySelectorAll(selector)].find((node) => node.getBoundingClientRect().height > 0);
    /*
     * Each control is asserted by the mechanism it uses. The header grows an invisible hit
     * area (its box stays 31px), so it is hit-tested; the chips and the pager grow for real,
     * so their box must measure 44px. Hit-testing a chip failed on CI once — a point 21px
     * from the centre landed on whatever the runner painted over it — and a check that
     * breaks on paint order is a check nobody can trust.
     */
    const reach = (selector, label) => {
      const el = visible(selector);
      if (!el) return { label, present: false };
      el.scrollIntoView({ block: "center", inline: "center" });
      const r = el.getBoundingClientRect();
      const x = Math.round(r.left + r.width / 2);
      const y = Math.round(r.top + r.height / 2);
      const hits = (dy) => {
        const hit = document.elementFromPoint(x, y + dy);
        return !!hit && (hit === el || el.contains(hit) || hit.contains(el));
      };
      return { label, present: true, box: Math.round(r.height), ok: hits(-21) && hits(21) };
    };
    const measure = (selector, label) => {
      const el = visible(selector);
      if (!el) return { label, present: false };
      const h = el.getBoundingClientRect().height;
      return { label, present: true, box: Math.round(h), ok: h >= 44 };
    };
    const probes = [reach(".nav a", "nav link"), reach(".wordmark", "wordmark"), measure(".tag", "chip"), measure(".pager__page", "pager page")];
    return { probes, where: location.pathname, navCount: document.querySelectorAll(".nav a").length, header: !!document.querySelector("header") };
  })()`);
  reporter.check(
    "every header control reaches 44px to a tap and every chip measures 44px",
    /* The fixture has one page of stories, so the pager is legitimately absent there. */
    taps.header && taps.navCount > 0 && taps.probes.every((tap) => !tap.present || tap.ok),
    JSON.stringify(taps),
  );

  /*
   * Read-aloud mode is a story-page mode. It used to hide the header and footer on every
   * page, and the preference persists, so one try took the navigation away for good.
   */
  await cdp.evaluate('localStorage.setItem("wt:mode", "read-aloud")');
  await goto(cdp, server.origin, "/browse/");
  const modeOnBrowse = await cdp.evaluate(`(() => ({
    applied: document.documentElement.getAttribute("data-mode"),
    headerHeight: Math.round((document.querySelector("header")?.getBoundingClientRect().height ?? 0)),
  }))()`);
  await goto(cdp, server.origin, STORY);
  const modeOnStory = await cdp.evaluate(`(() => ({
    headerHeight: Math.round((document.querySelector("header")?.getBoundingClientRect().height ?? 0)),
  }))()`);
  await cdp.evaluate('localStorage.removeItem("wt:mode")');
  reporter.check(
    "read-aloud mode hides the chrome on a story page and leaves it elsewhere",
    modeOnBrowse.applied === "read-aloud" && modeOnBrowse.headerHeight > 0 && modeOnStory.headerHeight === 0,
    JSON.stringify({ modeOnBrowse, modeOnStory }),
  );

  await goto(cdp, server.origin, "/stories/");
  const rowMeta = await cdp.evaluate('document.querySelector(".entry-list__meta")?.textContent.trim() ?? ""');
  reporter.check(
    "a shelf row names the age and the reading time, not the publish date",
    /^Ages \S+ · \d+ min read$/.test(rowMeta) && !/\b20\d\d\b/.test(rowMeta),
    rowMeta,
  );

  /*
   * The shelf list uses the width it has. One column of rows left 372px of empty gutter at
   * 1280px; the two-column grid measured before it shipped removed the gutter, doubled the
   * rows above the fold and halved the scroll (UI audit, finding 6). Narrower desktops keep
   * one column, and this asserts both so neither can drift.
   */
  const listShape = async () =>
    cdp.evaluate(`(() => {
      const list = document.querySelector(".entry-list");
      const items = [...list.querySelectorAll(".entry-list__item")];
      const first = items[0].getBoundingClientRect();
      const summary = items[0].querySelector(".entry-list__summary").getBoundingClientRect();
      return {
        columns: getComputedStyle(list).gridTemplateColumns.split(" ").length,
        gutter: Math.round(first.right - summary.right),
        above: items.filter((item) => item.getBoundingClientRect().top < window.innerHeight).length,
      };
    })()`);

  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await goto(cdp, server.origin, "/stories/");
  const wide = await listShape();
  reporter.check(
    "the shelf list uses the width it has instead of leaving a third of it empty",
    /* Columns and gutter are the contract; how many rows fit depends on the corpus, so the
       count is reported but not asserted (the fixture's rows are taller than the real ones). */
    wide.columns === 2 && wide.gutter <= 40,
    JSON.stringify(wide),
  );

  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 768, height: 900, deviceScaleFactor: 1, mobile: false });
  await goto(cdp, server.origin, "/stories/");
  const narrow = await listShape();
  reporter.check(
    "a narrower desktop still gets one column of rows",
    narrow.columns === 1,
    JSON.stringify(narrow),
  );

  /*
   * A text-only row (series, authors, reading time) fills its column too: the 11rem meta
   * gutter that suits a full-width row left the title 256px in a 456px column.
   */
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await goto(cdp, server.origin, "/series/");
  const textRow = await cdp.evaluate(`(() => {
    const first = document.querySelector(".entry-list__item");
    if (!first) return null;
    const row = first.getBoundingClientRect();
    const summaryEl = first.querySelector(".entry-list__summary");
    const summary = summaryEl.getBoundingClientRect();
    const fontSize = parseFloat(getComputedStyle(summaryEl).fontSize);
    return {
      ratio: Number((summary.width / row.width).toFixed(2)),
      charsPerLine: Math.round(summary.width / (fontSize * 0.5)),
    };
  })()`);
  reporter.check(
    "a text-only row uses its column instead of an empty meta gutter",
    textRow === null || (textRow.ratio > 0.8 && textRow.charsPerLine >= 55),
    JSON.stringify(textRow),
  );

  /*
   * The keyboard focus ring, measured with a real Tab: focus() in script does not set
   * :focus-visible, and an outline read that way says "3px none" whether or not a ring
   * exists. WCAG 2.4.11 wants 3:1 for the focused control’s indicator.
   */
  for (const scheme of ["dark", "light"]) {
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
    await goto(cdp, server.origin, "/stories/");
    for (let step = 0; step < 4; step += 1) {
      await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", windowsVirtualKeyCode: 9, key: "Tab", code: "Tab" });
      await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", windowsVirtualKeyCode: 9, key: "Tab", code: "Tab" });
    }
    const ring = await cdp.evaluate(`(() => {
      const el = document.activeElement;
      if (!el) return null;
      const cs = getComputedStyle(el);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const rgb = (color) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); const d = ctx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
      const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      let node = el.parentElement;
      let bg = getComputedStyle(document.body).backgroundColor;
      while (node) { const c = getComputedStyle(node).backgroundColor; if (c && c !== "rgba(0, 0, 0, 0)") { bg = c; break; } node = node.parentElement; }
      const a = lum(rgb(cs.outlineColor));
      const b = lum(rgb(bg));
      return {
        focusVisible: el.matches(":focus-visible"),
        style: cs.outlineStyle,
        width: parseFloat(cs.outlineWidth),
        contrast: Number(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2)),
      };
    })()`);
    reporter.check(
      scheme + ": the keyboard focus ring is visible and clears 3:1",
      ring !== null && ring.focusVisible && ring.style === "solid" && ring.width >= 2 && ring.contrast >= 3,
      JSON.stringify(ring),
    );
  }
  // ---- the menu's baseline, and where a fragment link lands -----------------
  /*
   * Two alignment defects shipped in the first pass: plain nav links were stretched to the
   * panel groups' 44px line, so their text sat six pixels above the group labels; and a
   * fragment link landed its target under the sticky header. Both are invisible to a
   * build-only gate and obvious in a screenshot, so they are measured here.
   */
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 768, height: 900, deviceScaleFactor: 1, mobile: false });
  await goto(cdp, server.origin, "/");
  const navBaseline = await cdp.evaluate(
    "(() => {" +
      "const tops = [...document.querySelectorAll('.nav > *')].map((el) => {" +
      "const range = document.createRange();" +
      "range.selectNodeContents(el.querySelector('a') || el);" +
      "return Math.round(range.getBoundingClientRect().top);" +
      "});" +
      "return { tops, spread: Math.max(...tops) - Math.min(...tops) };" +
      "})()"
  );
  reporter.check(
    "every menu item shares one baseline, panels and plain links alike",
    navBaseline.tops.length >= 5 && navBaseline.spread <= 1,
    JSON.stringify(navBaseline.tops),
  );

  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await goto(cdp, server.origin, "/browse/#genres", { settle: 800 });
  const fragment = await cdp.evaluate(
    "(() => {" +
      "const header = document.querySelector('.header').getBoundingClientRect();" +
      "const target = document.getElementById('genres').getBoundingClientRect();" +
      "return { headerH: Math.round(header.height), gap: Math.round(target.top - header.bottom) };" +
      "})()"
  );
  reporter.check(
    "a genre link lands the shelf below the sticky header, not under it",
    fragment.gap >= 0 && fragment.gap <= 24,
    JSON.stringify(fragment),
  );
} finally {
  close();
  server.close();
}

reporter.finish();