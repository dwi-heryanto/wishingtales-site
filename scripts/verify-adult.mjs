#!/usr/bin/env node
/**
 * Drives the adult gate the way a reader meets it, in a real browser, against the fixture
 * build — the only build that has a 13+ and an 18+ story in it.
 *
 *   pnpm build:fixture && pnpm verify:adult
 *
 * Five things ADR-0002 promised, and this is where they are checked rather than asserted:
 * the notice comes before the story, it is remembered, the shelf and its stories are
 * `noindex`, the theme is dark rather than warm paper, and no children's page links to any
 * of it. `scripts/verify-build.mjs` checks the last three in the static output; these are
 * the ones that need a browser.
 *
 * The fixture content is used because it holds a `13+` and an `18+` story by construction.
 * `13+` ships (`worker/prompts/13+.md`, `TIER_PROFILES["13+"].ships`), so a real `13+`
 * story arrives in `content/` from a later cron run — and when it does, this gate still
 * drives the fixture set, where an `18+` story also exists. `18+` stays off by decision,
 * so the fixture set is the only place its half of the gate can be exercised at all.
 *
 * Exits non-zero on failure.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createReporter, goto, launchBrowser, startStaticServer } from "./lib/browser.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "site", "out");
const PORT = 8125;

const SHELF_18 = "/18+/";
const SHELF_13 = "/13+/";
const STORY_18 = "/18+/horror/what-the-fog-brought-in/";
const STORY_13 = "/13+/spooky/the-last-train-home/";
const GATED_CLASSIC = "/13+/horror/the-monkeys-paw/";

const KIDS_PAGES = [
  "/",
  "/browse/",
  "/stories/",
  "/classics/",
  "/series/",
  "/series/the-lantern-keepers/",
  "/themes/",
  "/themes/courage/",
  "/sources/",
  "/about/",

  "/8-12/",
  "/8-12/everyday-magic/the-tin-whistle/",
];

if (!fs.existsSync(OUT)) {
  console.error("site/out does not exist — run `pnpm build:fixture` first.");
  process.exit(1);
}

if (!fs.existsSync(path.join(OUT, "18+", "index.html"))) {
  console.error(
    "site/out has no /18+ shelf. This checks the fixture build (`pnpm build:fixture`); " +
      "the real content/ deliberately holds no adult story.",
  );
  process.exit(1);
}

/**
 * Every page the site itself marks as gated, read off the built HTML.
 *
 * Derived rather than listed, so a new adult fixture joins the check by existing and a
 * renamed one cannot quietly drop out of it.
 */
function gatedPaths() {
  const found = new Set();
  const walk = (dir) => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) walk(full);
      else if (item.name === "index.html") {
        const html = fs.readFileSync(full, "utf8");
        if (/data-adult=""/.test(html)) {
          found.add("/" + path.relative(OUT, full).replace(/index\.html$/, ""));
        }
      }
    }
  };
  walk(OUT);
  return found;
}

/** Paths as the browser sees them: no trailing slash, `+` decoded. */
const normalise = (href) =>
  decodeURIComponent(href.split("#")[0].split("?")[0]).replace(/\/+$/, "") || "/";

const reporter = createReporter();
const gated = gatedPaths();
const gatedNormalised = new Set([...gated].map(normalise));
const server = await startStaticServer(OUT, PORT);
const { cdp, close } = await launchBrowser({ workspace: ROOT, port: 8126, debuggingPort: 9334 });

/** What a reader can actually see: is the notice up, and is anything behind it? */
const VIEW_STATE = `(() => {
  const gate = document.querySelector(".adult-gate");
  const gated = document.querySelector(".adult-gated");
  /* checkVisibility, not the element's own \`display\`: the story is hidden by its
     ancestor, and a child of a display:none box still reports display:block. */
  const visible = (el) => Boolean(el) && el.checkVisibility();
  const ua = getComputedStyle(document.body).backgroundColor;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#010203";
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = ua;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
  return {
    notice: visible(gate),
    content: visible(gated),
    proseVisible: visible(document.querySelector(".prose")),
    theme: document.documentElement.getAttribute("data-reader-theme"),
    paper: Math.round((0.2126 * r + 0.7152 * g + 0.0722 * b) * 100) / 100,
    robots: [...document.querySelectorAll('meta[name="robots"]')].map((m) => m.content).join(" | "),
    ack: localStorage.getItem("wt:adult-ack"),
  };
})()`;

try {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  /*
   * Emulate a reader whose browser has never expressed a colour-scheme preference, in the
   * light direction. Headless Chrome answers `prefers-color-scheme: dark` on a dark-mode
   * host, and the theme check below is about which default the *page* brings — a dark host
   * would make a children's page dark too, and the comparison would say nothing.
   */
  await cdp.send("Emulation.setEmulatedMedia", {
    media: "",
    features: [{ name: "prefers-color-scheme", value: "light" }],
  });

  // ---- the notice comes first ----------------------------------------------
  // Land on the origin first: localStorage is not reachable from about:blank.
  await goto(cdp, server.origin, "/");
  await cdp.evaluate("localStorage.clear()");

  for (const [url, what] of [
    [SHELF_18, "the 18+ shelf"],
    [STORY_18, "an 18+ story"],
    [SHELF_13, "the 13+ shelf"],
    [STORY_13, "a 13+ story"],
    [GATED_CLASSIC, "a 13+ retold classic"],
  ]) {
    await goto(cdp, server.origin, url);
    const state = await cdp.evaluate(VIEW_STATE);
    reporter.check(
      `${what} shows the notice, not the story`,
      state.notice && !state.content && !state.proseVisible && state.ack === null,
      JSON.stringify(state),
    );
  }

  // ---- opening one is remembered -------------------------------------------
  await goto(cdp, server.origin, SHELF_18);
  await cdp.evaluate("[...document.querySelectorAll('.adult-gate button')].find((b) => b.textContent.includes('adult')).click()");
  await new Promise((resolve) => setTimeout(resolve, 200));
  const opened = await cdp.evaluate(VIEW_STATE);
  reporter.check(
    "the click-through opens the shelf and is written to localStorage",
    !opened.notice && opened.content && Boolean(opened.ack),
    JSON.stringify({ notice: opened.notice, content: opened.content, ack: opened.ack }),
  );

  await goto(cdp, server.origin, STORY_18);
  const remembered = await cdp.evaluate(VIEW_STATE);
  reporter.check(
    "the next adult story opens without asking again — one-time, per browser",
    !remembered.notice && remembered.content && remembered.proseVisible,
    JSON.stringify({ notice: remembered.notice, prose: remembered.proseVisible }),
  );

  // A separate reader, in a separate browser, is asked again: the ack is per browser and
  // not per site. Clearing it stands in for the second visitor.
  await cdp.evaluate("localStorage.removeItem('wt:adult-ack')");
  await goto(cdp, server.origin, STORY_18);
  const secondReader = await cdp.evaluate(VIEW_STATE);
  reporter.check(
    "clearing the browser's memory brings the notice back",
    secondReader.notice && !secondReader.proseVisible,
    JSON.stringify({ notice: secondReader.notice, prose: secondReader.proseVisible }),
  );

  // ---- dark, not warm paper ------------------------------------------------
  await cdp.evaluate("localStorage.clear()");
  await goto(cdp, server.origin, SHELF_18);
  const dark = await cdp.evaluate(VIEW_STATE);
  await goto(cdp, server.origin, "/");
  const kidsPaper = await cdp.evaluate(VIEW_STATE);
  reporter.check(
    "an adult page renders in the dark reader theme, and a children's page does not",
    dark.theme === "dark" && dark.paper < 40 && kidsPaper.theme === "light" && kidsPaper.paper > 200,
    `adult paper ${dark.paper} (${dark.theme}) vs children's ${kidsPaper.paper} (${kidsPaper.theme})`,
  );

  /*
   * The default belongs to the address, not to the browser (ADR-0002's third amendment).
   * A dark-mode host is the case that used to decide it: the children's page followed the
   * OS, so on a dark laptop it used to look like the adult shelf. Repeat both pages with
   * the host forced dark — the children's page must stay warm paper.
   */
  await cdp.send("Emulation.setEmulatedMedia", {
    media: "",
    features: [{ name: "prefers-color-scheme", value: "dark" }],
  });
  await cdp.evaluate("localStorage.clear()");
  await goto(cdp, server.origin, "/");
  const kidsOnDarkHost = await cdp.evaluate(VIEW_STATE);
  await goto(cdp, server.origin, SHELF_18);
  const adultOnDarkHost = await cdp.evaluate(VIEW_STATE);
  reporter.check(
    "a dark-mode host does not decide the theme: children stay light, adults stay dark",
    kidsOnDarkHost.theme === "light" && kidsOnDarkHost.paper > 200 &&
      adultOnDarkHost.theme === "dark" && adultOnDarkHost.paper < 40,
    "dark host: children's " + kidsOnDarkHost.paper + " (" + kidsOnDarkHost.theme + "), adult " +
      adultOnDarkHost.paper + " (" + adultOnDarkHost.theme + ")",
  );
  await cdp.send("Emulation.setEmulatedMedia", {
    media: "",
    features: [{ name: "prefers-color-scheme", value: "light" }],
  });
  await cdp.evaluate("localStorage.clear()");

  /*
   * The other direction, and the one the inline script cannot cover: Next replaces the
   * page on a client-side navigation without re-running it. Leaving an adult story for the
   * children's library must hand the theme back (ReaderThemeSync).
   */
  await cdp.evaluate("localStorage.clear()");
  await goto(cdp, server.origin, STORY_18);
  await cdp.evaluate(
    "[...document.querySelectorAll('.adult-gate a')].find((a) => a.textContent.includes('children')).click()",
  );
  await new Promise((resolve) => setTimeout(resolve, 700));
  const backToKids = await cdp.evaluate(VIEW_STATE);
  reporter.check(
    "walking back to the children's library restores the warm-paper theme",
    backToKids.theme === "light" && backToKids.paper > 200,
    "back on " + (await cdp.evaluate("location.pathname")) + ": " + backToKids.theme + ", paper " + backToKids.paper,
  );
  await cdp.evaluate("localStorage.clear()");

  // The reader's own choice still wins: the theme control is an accessibility setting and
  // the ADR asks for a different default, not for overruling it.
  await cdp.evaluate("localStorage.setItem('wt:theme', 'light')");
  await goto(cdp, server.origin, STORY_18);
  const chosen = await cdp.evaluate(VIEW_STATE);
  reporter.check(
    "a reader who chose light gets light, notice and all",
    chosen.theme === "light" && chosen.paper > 200 && chosen.notice,
    `${chosen.theme}, paper ${chosen.paper}`,
  );
  await cdp.evaluate("localStorage.clear()");

  // ---- noindex, and no route to it from the children's library -------------
  for (const url of [SHELF_18, STORY_18, SHELF_13, STORY_13, GATED_CLASSIC]) {
    await goto(cdp, server.origin, url);
    const state = await cdp.evaluate(VIEW_STATE);
    reporter.check(`${url} is noindex`, state.robots.includes("noindex"), state.robots || "(no robots meta)");
  }

  reporter.check(
    "the fixture build really has gated pages to check",
    gated.size >= 6,
    [...gated].sort().join(", "),
  );

  for (const url of KIDS_PAGES) {
    await goto(cdp, server.origin, url);
    const leaked = await cdp.evaluate(`(() => {
      const gated = ${JSON.stringify([...gatedNormalised])};
      const norm = (href) => decodeURIComponent(new URL(href, location.origin).pathname).replace(/\\/+$/, "") || "/";
      return [...document.querySelectorAll("a[href^='/']")]
        .map((a) => a.getAttribute("href"))
        .filter((href) => gated.includes(norm(href)));
    })()`);
    reporter.check(`${url} links to no gated page`, leaked.length === 0, leaked.join(", "));
  }

  // ---- the feed ------------------------------------------------------------
  await goto(cdp, server.origin, "/rss.xml");
  const feed = await cdp.evaluate("document.body.textContent");
  const feedLinks = [...feed.matchAll(/<link>([^<]+)<\/link>/g)].map((match) => match[1]);
  const leakedFeed = feedLinks.filter((link) => gatedNormalised.has(normalise(new URL(link).pathname)));
  reporter.check("the RSS feed carries no gated story", leakedFeed.length === 0, leakedFeed.join(", "));
} finally {
  close();
  server.close();
}

reporter.finish();
