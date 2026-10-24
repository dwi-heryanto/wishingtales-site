#!/usr/bin/env node
/**
 * Drives the real corpus's /browse/ card wall the way a reader pages through it: the
 * wall is paged client-side (8 cards on desktop, 6 on tablet, 4 on a phone), every
 * story is reachable across the pages, off-page cards stay in the DOM but hidden, and
 * the pager's controls hold — Next stops on the last page, Previous on the first.
 *
 *   pnpm build && node scripts/verify-pagination.mjs   # needs the real content
 *
 * Runs as the second half of `pnpm verify`, so every real build is checked.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createReporter, goto, launchBrowser, startStaticServer } from "./lib/browser.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "site", "out");
const PORT = 8127;

if (!fs.existsSync(OUT)) {
  console.error("site/out does not exist — run pnpm build first.");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const reporter = createReporter();

const server = await startStaticServer(OUT, PORT);
let browser;
try {
  browser = await launchBrowser({ workspace: ROOT, port: PORT, debuggingPort: 8128 });
  const { cdp } = browser;

  const visibleTitles = () =>
    cdp.evaluate(
      "[...document.querySelectorAll('.card')]" +
        ".filter((c) => getComputedStyle(c).display !== 'none')" +
        ".map((c) => (c.querySelector('.card__title')?.textContent ?? '').trim())"
    );
  const firstVisible = () =>
    cdp.evaluate(
      "([...document.querySelectorAll('.card')]" +
        ".find((c) => getComputedStyle(c).display !== 'none')" +
        "?.querySelector('.card__title')?.textContent?.trim() ?? '')"
    );
  const next = async () => {
    await cdp.evaluate("document.querySelector('.pager__next')?.click()");
    await sleep(200);
  };
  const prev = async () => {
    await cdp.evaluate("document.querySelector('.pager__prev')?.click()");
    await sleep(200);
  };
  const nextDisabled = () =>
    cdp.evaluate("document.querySelector('.pager__next')?.disabled === true");

  // A real desktop: the headless default (800px) would page the tablet size.
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await goto(cdp, server.origin, "/browse/", { settle: 900 });

  const wall = await cdp.evaluate(
    "(() => {" +
      "const cards = [...document.querySelectorAll('.card')];" +
      "const titles = cards.map((c) => c.querySelector('.card__title')?.textContent?.trim() ?? '');" +
      "return {" +
      "total: cards.length," +
      "unique: new Set(titles).size," +
      "visible: cards.filter((c) => getComputedStyle(c).display !== 'none').length," +
      "pager: !!document.querySelector('.pager')," +
      "pages: document.querySelectorAll('.pager__page').length," +
      // A card must still carry a link to its story. Nothing asserted this before,
      // so a redesign could have dropped the anchor and quietly shrunk the adult-link
      // crawl's coverage with a green build (ADR-0009).
      "linked: cards.every((c) => !!c.querySelector('a[href^=\"/\"]'))," +
      "first: titles[0]," +
      "ariaCurrent: document.querySelector('.pager__page[aria-current]')?.textContent?.trim() ?? ''" +
      "};" +
      "})()"
  );

  reporter.check(
    "the wall keeps every story card in the DOM, each once",
    wall.total >= 20 && wall.unique === wall.total,
    wall.total + " cards, " + wall.unique + " unique"
  );
  reporter.check(
    "page one shows a pageful (8), not the whole wall",
    wall.visible === 8 && wall.total > 8,
    wall.visible + " visible of " + wall.total
  );
  reporter.check(
    "the pager is present and marks page one",
    wall.pager && wall.pages >= 2 && wall.ariaCurrent === "1",
    wall.pages + " page buttons, current=" + wall.ariaCurrent
  );
  reporter.check(
    "every card still links to its story",
    wall.linked === true,
    wall.total + " cards, all linked"
  );

  // Walk every page forward until Next is spent: each page turns up fresh cards,
  // and the union is the whole library exactly once.
  const seen = new Set(await visibleTitles());
  const firsts = [await firstVisible()];
  let steps = 0;
  while (!(await nextDisabled()) && steps < 40) {
    await next();
    steps++;
    for (const title of await visibleTitles()) seen.add(title);
    firsts.push(await firstVisible());
  }
  reporter.check(
    "every page opens on a different story",
    new Set(firsts).size === firsts.length,
    firsts.slice(0, 5).join(" | ") + (firsts.length > 5 ? " …" : "")
  );
  reporter.check(
    "paging through reaches every story exactly once",
    seen.size === wall.total,
    seen.size + " reached of " + wall.total
  );
  reporter.check(
    "Next is spent on the last page",
    (await nextDisabled()) && steps > 0,
    steps + " page turns before Next disabled"
  );

  // Walk back until Previous is spent, then confirm it is page one again.
  let backSteps = 0;
  while (!(await cdp.evaluate("document.querySelector('.pager__prev')?.disabled === true")) && backSteps < 40) {
    await prev();
    backSteps++;
  }
  const backOnOne =
    (await cdp.evaluate("document.querySelector('.pager__page[aria-current]')?.textContent?.trim() ?? ''")) === "1";
  reporter.check(
    "Previous walks back to page one and spends itself",
    backOnOne && backSteps > 0,
    backSteps + " steps back, current=" + (backOnOne ? "1" : "?")
  );


  /*
   * Search and filters (ADR-0009). The wall keeps every card in the DOM and hides the
   * ones that do not match, so three things must hold at once: the count shrinks, the
   * URL carries the query, and the DOM does not.
   */
  const typeQuery = async (value) => {
    await cdp.evaluate(
      "(() => {" +
        "const input = document.querySelector('#story-search');" +
        "const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;" +
        "setter.call(input, " + JSON.stringify(value) + ");" +
        "input.dispatchEvent(new Event('input', { bubbles: true }));" +
        "})()"
    );
    await sleep(350);
  };
  const visibleCount = () =>
    cdp.evaluate(
      "[...document.querySelectorAll('.card')].filter((c) => getComputedStyle(c).display !== 'none').length"
    );
  const statusText = () =>
    cdp.evaluate("document.querySelector('.wall__status [role=status]')?.textContent?.trim() ?? ''");

  await goto(cdp, server.origin, "/browse/", { settle: 900 });
  await typeQuery("spooky");
  const filteredVisible = await visibleCount();
  const filteredStatus = await statusText();
  const filteredUrl = await cdp.evaluate("location.search");
  const keptInDom = await cdp.evaluate("document.querySelectorAll('.card').length");
  reporter.check(
    "search narrows the wall and keeps every card in the DOM",
    filteredVisible > 0 && filteredVisible <= 8 && keptInDom === wall.total,
    filteredVisible + " visible, " + keptInDom + " in the DOM, status: " + filteredStatus
  );
  reporter.check(
    "a search is shareable through the URL",
    /(^|&|\?)q=spooky(&|$)/.test(filteredUrl) || filteredUrl.includes("q=spooky"),
    filteredUrl || "(empty)"
  );

  await typeQuery("zzzzzz");
  const emptyVisible = await visibleCount();
  const emptyState = await cdp.evaluate("!!document.querySelector('.wall__empty')");
  reporter.check(
    "a search with no matches says so instead of showing an empty grid",
    emptyVisible === 0 && emptyState,
    emptyVisible + " visible, empty state: " + emptyState
  );

  await cdp.evaluate("document.querySelector('.wall__clear')?.click()");
  await sleep(350);
  const clearedStatus = await statusText();
  const clearedUrl = await cdp.evaluate("location.search");
  reporter.check(
    "clearing the search restores the whole wall and a clean URL",
    clearedStatus.includes(String(wall.total)) && clearedUrl === "",
    "status: " + clearedStatus + ", url: " + (clearedUrl || "(clean)")
  );

  const chips = await cdp.evaluate("document.querySelectorAll('.wall__filters .chip').length");
  reporter.check(
    "the filter chips are buttons with pressed state and counts",
    chips >= 8 && (await cdp.evaluate("!!document.querySelector('.wall__filters .chip[aria-pressed]')")),
    chips + " chips"
  );

  // A tablet pages by six.
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 820,
    height: 1180,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await goto(cdp, server.origin, "/browse/", { settle: 800 });
  const tablet = await cdp.evaluate(
    "[...document.querySelectorAll('.card')].filter((c) => getComputedStyle(c).display !== 'none').length"
  );
  reporter.check("a tablet page shows six cards", tablet === 6, tablet + " visible");

  // A phone pages by four.
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await goto(cdp, server.origin, "/browse/", { settle: 800 });
  const mobile = await cdp.evaluate(
    "[...document.querySelectorAll('.card')].filter((c) => getComputedStyle(c).display !== 'none').length"
  );
  reporter.check("a phone page shows four cards", mobile === 4, mobile + " visible");
} finally {
  if (browser) await browser.close();
  server.close();
}
reporter.finish();
