#!/usr/bin/env node
/**
 * Post-build verification. Checks the artefact we actually ship in site/out,
 * not the source: canonicals, JSON-LD, internal links, cover files, and the
 * promise that drafts never reach the static output.
 *
 * Usage: node scripts/verify-build.mjs   (run after `pnpm build`)
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { COVER_CEILING_BYTES } from "./lib/cover-image.mjs";
// One implementation with the page builder: a tale whose own name contains a comma
// ("Momotaro, the Peach Boy", "The Tiger, the Brahman, and the Jackal") only survives
// the quote-aware reader, and this file's old copy — split on the last comma — rejected
// both classics on the day they shipped.
import { sourceTaleFrom } from "../site/lib/content.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "site", "out");
const PUBLIC_DIR = path.join(ROOT, "site", "public");
const CONTENT_DIR = path.join(ROOT, "content");
const DRAFTS_DIR = path.join(ROOT, "drafts");

const failures = [];
const notes = [];

function fail(message) {
  failures.push(message);
}

function walk(dir, filter) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) return walk(full, filter);
    return filter(full) ? [full] : [];
  });
}

/** /8-12/adventure/x/ -> site/out/8-12/adventure/x/index.html (or an emitted file) */
function resolveInternalHref(href) {
  const clean = href.split("#")[0].split("?")[0];
  if (!clean.startsWith("/")) return true;
  const relative = clean.replace(/^\/+/, "");
  const candidates = [
    path.join(OUT, relative, "index.html"),
    path.join(OUT, relative),
    path.join(OUT, relative + ".html"),
  ];
  return candidates.some((candidate) => fs.existsSync(candidate));
}

/**
 * One spelling for "where does this path point".
 *
 * A tier is part of a URL (`/13+/`) and `+` is legal unencoded in a path, so the same page
 * can be written `/13+/` or `/13%2B/`. Both are the same page to a browser and have to be
 * the same page to this script, or the "never linked from kids pages" check below would
 * pass by spelling.
 */
function normalisePath(href) {
  const clean = href.split("#")[0].split("?")[0];
  let decoded = clean;
  try {
    decoded = decodeURIComponent(clean);
  } catch {
    /* not a path we can normalise; compare it as written */
  }
  return decoded.replace(/\/+$/, "") || "/";
}

if (!fs.existsSync(OUT)) {
  console.error("site/out does not exist — run \`pnpm build\` first.");
  process.exit(1);
}

// 1 · required top-level files
for (const file of ["index.html", "404.html", "sitemap.xml", "robots.txt", "rss.xml", "_headers", "_redirects"]) {
  if (!fs.existsSync(path.join(OUT, file))) fail("missing site/out/" + file);
}

const htmlFiles = walk(OUT, (f) => f.endsWith(".html"));
notes.push(htmlFiles.length + " HTML pages built");

// 2 · every published story has a page, and drafts have none
const contentSlugs = [];
const contentEntries = [];
/**
 * Published stories the adult gate keeps out of the sitemap (ADR-0002).
 *
 * Read from the frontmatter, not from the built pages, because two checks below need it
 * *before* the pages are parsed: a gated story is correctly absent from the sitemap, and
 * the first one to ship made `pnpm verify` fail for hiding it properly.
 */
const gatedSlugs = new Set();
for (const collection of ["stories", "classics"]) {
  const dir = path.join(CONTENT_DIR, collection);
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".md") || name === "README.md") continue;
    const slug = name.replace(/\.md$/, "");
    const file = path.join(dir, name);
    const raw = fs.readFileSync(file, "utf8");
    // Accept both `status: published` and `status: "published"`: the worker's YAML
    // serialiser quotes, and publish:draft writes a bare value.
    const status = /^status:\s*(\S+)\s*$/m.exec(raw)?.[1]?.replace(/^["']|["']$/g, "");
    if (status !== "published") {
      fail("content/" + collection + "/" + name + " has status " + status + " — content/ holds published stories only");
    }
    const tier = /^ageTier:\s*"?([^"\s]+)"?\s*$/m.exec(raw)?.[1];
    if (tier === "13+" || tier === "18+") gatedSlugs.add(slug);
    /*
     * A classic's source line is `Author, "Tale"`; the tale is what a search engine should
     * find in the page title, so it is read here to compare against the built page below
     * (issue #110).
     */
    /*
     * The tale comes from the same function the page builder uses, so a tale whose own
     * name contains a comma survives. The raw YAML value carries escaped quotes; unescape
     * before asking, or the quoted-name branch never matches.
     */
    const sourceLine = /^  source:\s*"(.+)"\s*$/m.exec(raw)?.[1] ?? "";
    const sourceTale = sourceTaleFrom(sourceLine.replace(/\\"/g, '"')) ?? "";

    /*
     * ADR-0005's ordering needs the two numbers a shelf sorts on. They come from this same
     * frontmatter pass rather than a second reader. An old story may carry no rating (the
     * field is optional), so its rating stays NaN and it sorts last.
     */
    const title = (/^title:\s*(.+)$/m.exec(raw)?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
    const rating = Number(/^  overall:\s*([0-9]+(?:\.[0-9]+)?)\s*$/m.exec(raw)?.[1] ?? NaN);
    const publishedAt = (/^publishedAt:\s*"?([0-9-]+)"?\s*$/m.exec(raw)?.[1] ?? "").trim();

    contentSlugs.push(slug);
    contentEntries.push({ collection, slug, sourceTale, title, rating, publishedAt });
  }
}

if (fs.existsSync(DRAFTS_DIR)) {
  const draftSlugs = fs
    .readdirSync(DRAFTS_DIR)
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replace(/\.md$/, ""));
  for (const slug of draftSlugs) {
    for (const collection of ["stories", "classics"]) {
      if (fs.existsSync(path.join(OUT, collection, slug, "index.html")) && !contentSlugs.includes(slug)) {
        fail("draft " + slug + " was built into site/out/" + collection + "/" + slug);
      }
    }
  }
  if (draftSlugs.length > 0) notes.push(draftSlugs.length + " draft(s) present and kept out of the build");

  /*
   * A draft and its published counterpart must not coexist.
   *
   * `publishDraft` writes content/<collection>/<slug>.md and *then* deletes
   * drafts/<slug>.md. If that delete fails — a transient GitHub error is enough — the
   * branch holds both, and merging the pull request puts a `status: draft` file on main.
   *
   * Nothing else catches that. The draft under `drafts/` is valid frontmatter, `content/`
   * is untouched and correct, and this script's other draft check only asks whether a
   * draft was *built*, which it never is. It took a person noticing a stray file in a
   * diff, and it happened on 2026-10-12: `drafts/the-second-night-a-light-for-the-lost.md`
   * reached main exactly this way.
   *
   * Checked here rather than as "drafts/ is tracked on main" because a draft legitimately
   * exists on a drafts/<slug> branch, and CI validates those pull requests. Coexistence is
   * the state that is wrong on every branch.
   */
  for (const slug of draftSlugs) {
    for (const collection of ["stories", "classics"]) {
      if (fs.existsSync(path.join(CONTENT_DIR, collection, slug + ".md"))) {
        fail(
          "drafts/" + slug + ".md exists alongside content/" + collection + "/" + slug +
            ".md — a publish wrote the story but did not delete the draft, so merging this would put a draft on main",
        );
      }
    }
  }
}

// 3 · sitemap covers published URLs and nothing else
const sitemapPath = path.join(OUT, "sitemap.xml");
const verifiedSitemapPaths = [];
if (fs.existsSync(sitemapPath)) {
  const sitemap = fs.readFileSync(sitemapPath, "utf8");
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  notes.push(urls.length + " URLs in sitemap.xml");
  for (const url of urls) verifiedSitemapPaths.push(new URL(url).pathname);
  for (const slug of contentSlugs) {
    const inSitemap = urls.some((url) => url.includes("/" + slug + "/"));
    if (gatedSlugs.has(slug)) {
      // The stronger claim, and the reason this branch exists: a gated story is not
      // merely allowed to be absent, it must be. Advertising it in the sitemap is the
      // thing ADR-0002 forbids.
      if (inSitemap) {
        fail("sitemap.xml lists " + slug + ", which is behind the adult notice — a gated page is not a page to advertise");
      }
      continue;
    }
    if (!inSitemap) {
      fail("sitemap.xml is missing published story " + slug);
    }
  }
  for (const pathname of verifiedSitemapPaths) {
    if (!resolveInternalHref(pathname)) fail("sitemap.xml lists " + pathname + " but no page was built for it");
  }
}

/*
 * 4 · every story URL from before the tier and genre segments still resolves
 *
 * ADR-0001 moved a story under its tier and genre, which broke every address the site had
 * ever published. The list that repairs them is generated at build time
 * (`scripts/write-redirects.mjs`) because a committed one would go stale the first time
 * the pipeline published a story — so this checks the artefact Cloudflare Pages will
 * actually read, not the recipe that wrote it.
 *
 * The destination is checked against the sitemap rather than recomputed: the sitemap is
 * built from the same `entry.url` the page's canonical and breadcrumb use, so agreeing
 * with it is agreeing with all three. A redirect that lands on a 404 is worse than a 404,
 * because it says the page moved somewhere.
 */
const redirectsPath = path.join(OUT, "_redirects");
if (fs.existsSync(redirectsPath)) {
  const rules = fs
    .readFileSync(redirectsPath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split(/\s+/));
  notes.push(rules.length + " redirect(s) in _redirects");

  for (const { collection, slug } of contentEntries) {
    const from = "/" + collection + "/" + slug + "/";
    const rule = rules.find(([source]) => source === from);
    if (!rule) {
      fail("_redirects has no rule for " + from + " — the pre-tier URL of a published story must keep resolving");
      continue;
    }
    const [, to, status] = rule;
    if (status !== "301") fail("_redirects sends " + from + " with status " + status + " — a permanent move wants a 301");
    /*
     * The destination has to be *that story's* address, and a page has to exist there.
     *
     * It used to be checked against the sitemap, which conflates "this build published it"
     * with "this build advertises it". Those came apart the moment a 13+ story shipped: its
     * address is right and it is deliberately absent from the sitemap, so the check failed
     * a build that was hidden correctly.
     */
    if (!to.endsWith("/" + slug + "/")) {
      fail("_redirects sends " + from + " to " + to + ", which is not that story's own address");
    }
    if (!resolveInternalHref(to)) fail("_redirects sends " + from + " to " + to + ", where no page was built");
  }
} else {
  fail("missing site/out/_redirects — run the site build through `pnpm build`, which writes it");
}

// 5 · per-page checks: canonical, JSON-LD, internal links, image files
const seenJsonLdTypes = new Set();
/** rel path -> the internal hrefs it emits, and the robots instruction it gives. */
const pageLinks = new Map();
const pageRobots = new Map();
/** rel path -> its meta description, checked for uniqueness in section 10. */
const pageDescriptions = new Map();
const adultPaths = new Set();
for (const file of htmlFiles) {
  const rel = path.relative(OUT, file).split(path.sep).join("/");

  // A search-engine verification file is not a page. Google's is one line, fetched
  // verbatim, with no canonical, heading or JSON-LD to check — and it has to be served
  // at the root, which is why it lives in site/public/ rather than being generated.
  if (/^google[0-9a-f]+\.html$/.test(rel)) continue;

  const html = fs.readFileSync(file, "utf8");
  pageDescriptions.set(rel, /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? "");

  // The 404 page is not indexable, so it carries no canonical and no JSON-LD.
  const isErrorPage = rel === "404.html" || rel.startsWith("404") || rel.includes("_not-found");

  /*
   * `data-adult` is the marker the gate itself reads (site/components/StoryPage.tsx), and
   * it is read here off the rendered attribute rather than out of content/: the React
   * payload also contains the string with an `$undefined` value on children's pages, and
   * a substring match would call every page an adult one.
   */
  const isAdultPage = /data-adult=""/.test(html);
  if (isAdultPage) adultPaths.add(normalisePath("/" + rel.replace(/index\.html$/, "")));

  const robots = [...html.matchAll(/<meta name="robots" content="([^"]*)"/g)].map((m) => m[1]);
  pageRobots.set(rel, robots);

  const canonical = isErrorPage ? null : /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
  if (!isErrorPage) {
    if (!canonical) {
      fail(rel + ": no canonical link");
    } else {
      const expectedPath = "/" + rel.replace(/index\.html$/, "");
      const canonicalPath = new URL(canonical).pathname;
      if (canonicalPath !== expectedPath) {
        fail(rel + ": canonical " + canonicalPath + " is not self-referencing (expected " + expectedPath + ")");
      }
    }
  }

  const h1Count = (html.match(/<h1/g) ?? []).length;
  if (!isErrorPage && h1Count !== 1) fail(rel + ": expected exactly one <h1>, found " + h1Count);

  // Heading levels must not skip (h1 -> h3): it breaks the screen-reader outline.
  if (!isErrorPage) {
    const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((match) => Number(match[1]));
    let previous = 0;
    for (const level of levels) {
      if (previous && level > previous + 1) {
        fail(rel + ": heading level jumps from h" + previous + " to h" + level);
        break;
      }
      previous = level;
    }
  }

  // Every image needs alt text; these pages carry generated cover art.
  for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\salt="[^"]+"/.test(tag)) {
      fail(rel + ": image without alt text — " + tag.slice(0, 80));
      break;
    }
  }

  if (/fonts\.(googleapis|gstatic)\.com/.test(html)) {
    fail(rel + ": references Google Fonts — fonts must be self-hosted at build time");
  }

  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const [, raw] of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/\\u003c/g, "<"));
    } catch (error) {
      fail(rel + ": JSON-LD does not parse (" + error.message + ")");
      continue;
    }
    for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
      seenJsonLdTypes.add(node["@type"]);
      if (node["@type"] === "Article") {
        for (const field of ["headline", "image", "datePublished", "author", "mainEntityOfPage"]) {
          if (!node[field]) fail(rel + ": Article JSON-LD missing " + field);
        }
      }
      if (node["@type"] === "BreadcrumbList") {
        const items = node.itemListElement ?? [];
        if (items.length < 2) fail(rel + ": BreadcrumbList has fewer than 2 items");
        items.forEach((item, index) => {
          if (item.position !== index + 1) fail(rel + ": BreadcrumbList positions are not sequential");
          if (!item.item || !item.name) fail(rel + ": BreadcrumbList item is missing name or item");
        });
      }
    }
  }

  for (const [, href] of html.matchAll(/href="(\/[^"]*)"/g)) {
    if (!resolveInternalHref(href)) fail(rel + ": broken internal link " + href);
    if (!isAdultPage) pageLinks.set(rel, [...(pageLinks.get(rel) ?? []), href]);
  }

  for (const [, src] of html.matchAll(/src="(\/covers\/[^"]+)"/g)) {
    if (!fs.existsSync(path.join(PUBLIC_DIR, src.replace(/^\//, "")))) {
      fail(rel + ": cover file missing from site/public" + src);
    }
  }
}

notes.push("JSON-LD types seen: " + [...seenJsonLdTypes].sort().join(", "));

// 6 · the adult gate (ADR-0002)
//
// Read off the built pages rather than out of content/, so these hold for whichever
// content was built: the fixture set today, and a real 13+ story the day one ships —
// at which point `pnpm verify` stops passing vacuously and starts guarding it.
//
// What is *not* checked here is that the story text is absent from the HTML: the site is
// a static export, so it is present by design. The gate is a speed bump, and a check that
// pretended otherwise would be the lie ADR-0002 is careful not to tell.
if (adultPaths.size > 0) notes.push(adultPaths.size + " gated page(s) behind the adult notice");

for (const [rel, robots] of pageRobots) {
  /*
   * Two robots instructions is one instruction with two answers, and Google resolves it
   * by believing the most restrictive — which would make a `noindex` page look gated while
   * the head also invited a crawl. It shipped once (a layout-level default beside the
   * page's own), and it is invisible in a browser.
   */
  if (robots.length > 1) {
    fail(rel + ": " + robots.length + " robots meta tags (" + robots.join(" | ") + ") — a page gives one instruction");
  }
}

const sitemapPage = path.join(OUT, "sitemap.xml");
const sitemapUrls = fs.existsSync(sitemapPage)
  ? [...fs.readFileSync(sitemapPage, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname)
  : [];
const sitemapPaths = new Set(sitemapUrls.map(normalisePath));

for (const pathName of adultPaths) {
  const noindex = [...pageRobots.entries()].some(
    ([rel, robots]) => normalisePath("/" + rel.replace(/index\.html$/, "")) === pathName && robots.some((r) => r.includes("noindex")),
  );
  if (!noindex) fail(pathName + " is behind the adult notice but does not say noindex — flip site/lib/gate.ts deliberately if that is meant");
  if (sitemapPaths.has(pathName)) fail("sitemap.xml lists " + pathName + ", which is behind the adult notice — a gated page is not a page to advertise");
}

/*
 * Older-tier stories are never linked from kids pages, *at all* (ADR-0002). This is the
 * check that holds the "never", and it is the reason it is here rather than in a page
 * component: the failure is a single `<a>` anywhere, added by anyone, for a good reason.
 */
for (const [rel, hrefs] of pageLinks) {
  for (const href of hrefs) {
    if (adultPaths.has(normalisePath(href))) {
      fail(rel + ": children's page links to gated page " + href + " — adult shelves are never linked from kids pages");
    }
  }
}

// 7 · the content index the Worker reads instead of reading the whole library
//
// It is a cache, so nothing breaks the moment it goes stale — which is exactly why it
// needs checking. A stale index does not fail, it quietly costs a read per story again,
// and enough of those put every run over Workers Free's 50-subrequest ceiling (issue
// #21). Regenerated by the script rather than re-derived here, so the format keeps one
// definition: the Worker's own module.
const indexGenerator = path.join(ROOT, "scripts", "build-index.mjs");
if (!fs.existsSync(indexGenerator)) {
  // The public site mirror carries no Worker, and so no index generator: the index is
  // copied in with the content by the mirror's sync, which means it cannot drift on its
  // own. Skipping is honest here; failing would mean the mirror can never pass its gate.
  notes.push("content/index.json drift check skipped (no index generator in this checkout)");
} else {
  try {
    execFileSync(
      process.execPath,
      ["--experimental-strip-types", indexGenerator, "--check"],
      { cwd: ROOT, stdio: "pipe" },
    );
    notes.push("content/index.json matches content/");
  } catch (error) {
    const detail = String(error.stderr ?? error.message).split("\n").filter(Boolean).slice(0, 4).join(" | ");
    fail("content/index.json is out of date — run `pnpm index:build` and commit it: " + detail);
  }
}

// 8 · every published cover at shipping weight
//
// The Worker draws covers with an image model, and an image model returns about 800 KB:
// three shipped at 455-740 KB on 2026-10-14 because no step of the pipeline ran
// `cover:optimize` (issue #37). `scripts/optimize-covers.mjs` now runs in the workflows
// before this check, so reaching the ceiling here means the optimizer did not run — a
// broken step rather than heavy art, which is why the ceiling sits far above the target
// the optimizer aims at. Checked against the built output, not the source: the artefact is
// what a reader downloads.
const coverBudget = path.join(OUT, "covers");
if (!fs.existsSync(coverBudget)) {
  fail("site/out/covers is missing — the build copies site/public/covers into the artefact");
} else {
  const oversized = fs
    .readdirSync(coverBudget)
    .filter((name) => /\.(jpe?g|png|webp)$/i.test(name) && name !== "placeholder.jpg")
    .map((name) => ({ name, size: fs.statSync(path.join(coverBudget, name)).size }))
    .filter((entry) => entry.size > COVER_CEILING_BYTES)
    .sort((a, b) => b.size - a.size);
  if (oversized.length > 0) {
    fail(
      oversized.length +
        " cover(s) above the " +
        Math.round(COVER_CEILING_BYTES / 1024) +
        " KB ceiling — run `pnpm cover:optimize:all` and commit it: " +
        oversized.map((entry) => entry.name + " (" + Math.round(entry.size / 1024) + " KB)").join(", "),
    );
  } else {
    notes.push("covers are at shipping weight");
  }
}

// 9 · a retold classic names the tale it retells, and an original claims none
//
// The retold title is the product's; the source tale is what people search for ("cinderella
// story"), so a classic page leads its <title> with the tale and carries it in the JSON-LD
// as the work it is based on (issue #110). A classic that keeps the tale's own traditional
// title answers to a single name — the tag is the tale itself, and the retelling line under
// the heading would only repeat it, which is exactly what `secondName` (site/lib/retold.ts)
// collapses into one name. An original must not claim a source it does not have — a check
// that only looked at the classic case would pass a page that started claiming one.
for (const { collection, slug, sourceTale } of contentEntries) {
  const page = htmlFiles.find((file) => path.basename(path.dirname(file)) === slug);
  if (!page) continue; // the missing-page check above already reports it
  const html = fs.readFileSync(page, "utf8");
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "";
  /*
   * React escapes what it writes into the title, so a tale with an apostrophe comes out as
   * &#x27; — "Mowgli's Brothers" and "The Emperor's New Clothes" both did, and comparing the
   * raw name failed two correct pages.
   */
  const escapedTale = (sourceTale ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
  const retelling = /<p class="reader__retelling">/.test(html);

  if (collection === "classics") {
    if (!sourceTale) {
      fail("content/classics/" + slug + ".md has no readable source tale in its provenance");
      continue;
    }
    /* The tag leads with the tale in either shape: "Tale — Retold Title" when the two names
       differ, or the bare tale when the retelling was told under the tale's own name. */
    if (!title.startsWith(escapedTale)) {
      fail(slug + ": title does not lead with the source tale — " + JSON.stringify(title));
    }
    /* The page says which tale it retells: the retelling line under the heading, or — only
       when the retold title IS the tale — the heading itself, which is the tag above. */
    const retoldTitleIsTheTale = !title.startsWith(escapedTale + " — ");
    if (!retelling && !retoldTitleIsTheTale) fail(slug + ": the classic page does not say which tale it retells");
    if (!/"isBasedOn"/.test(html)) fail(slug + ": JSON-LD does not name the work it is based on");
  } else if (retelling) {
    fail(slug + ": an original story claims to be a retelling");
  }
}
notes.push("classics name their source tale, originals claim none");

// 10 · every page describes itself, and no two describe themselves the same
//
// A shelf used to carry one templated line, which is how a dozen pages ended up saying the
// same words; the copy lives per shelf now (site/lib/shelf-copy.ts) and quotes that shelf's
// own counts (issue #111). This is what stops a new shelf shipping with a placeholder.
const describedBy = new Map();
for (const [rel, description] of pageDescriptions) {
  if (rel === "404.html" || rel.startsWith("404/") || rel.includes("_not-found")) continue;
  if (!description || description.trim().length < 60) {
    fail(rel + ": meta description missing or too short to be useful");
    continue;
  }
  const first = describedBy.get(description);
  if (first) fail(rel + " and " + first + " share a meta description — every page describes itself in its own words");
  else describedBy.set(description, rel);
}
notes.push(describedBy.size + " pages describe themselves uniquely");

// 11 · every shelf carries its written intro and its own facts
//
// The intro paragraph and the facts line are what make a shelf more than a list: the words
// a search engine can match, and the count, the length and two stories to start with for a
// parent deciding (issue #111). A shelf that loses them is a page of links again.
const TIER_SEGMENTS = new Set(["4-8", "8-12", "13+", "18+"]);
let shelvesChecked = 0;
for (const file of htmlFiles) {
  const rel = path.relative(OUT, file).split(path.sep).join("/");
  const withoutIndex = rel.replace(/index\.html$/, "").replace(/\/$/, "");
  const parts = withoutIndex.split("/");
  if (parts.length > 2 || !TIER_SEGMENTS.has(parts[0])) continue;
  const html = fs.readFileSync(file, "utf8");
  shelvesChecked++;
  if (!/<p class="lede__note">/.test(html)) fail(rel + ": shelf has no intro paragraph");
  if (!/<p class="shelf-facts">/.test(html)) fail(rel + ": shelf has no facts line (count, length, where to start)");
  if (!/<meta name="description"/.test(html)) fail(rel + ": shelf has no meta description");
}
notes.push(shelvesChecked + " shelf page(s) carry their intro and facts");

// 11b · shelves sort the way ADR-0005 says: rating first, recency breaks ties
//
// The rating has done one of its two ADR jobs — the discard floor — since it existed; the
// ordering half was never implemented, and ADR-0009 recorded that as a drift. This reads
// the order the built page actually prints and compares it with the frontmatter, so the
// drift cannot come back silently.
const ratingOrder = (entry) => (Number.isFinite(entry.rating) ? entry.rating : -1);
const shelfCompare = (a, b) =>
  ratingOrder(b) - ratingOrder(a) ||
  b.publishedAt.localeCompare(a.publishedAt) ||
  a.title.localeCompare(b.title);
/*
 * Keyed by slug, never by title. On 2026-10-20 the pipeline published a 13+ story called
 * "The Lamp in the Hill" while an 8-12 classic already carried that title; a title-keyed
 * map silently held the classic's rating, so every 13+ shelf looked out of order and the
 * deploy failed. Slugs are unique (the build asserts distinct URLs), titles are not.
 */
const entriesBySlug = new Map(contentEntries.map((entry) => [entry.slug, entry]));
const slugOfHref = (href) => {
  const clean = href.split("#")[0].split("?")[0];
  const parts = clean.split("/").filter(Boolean);
  try {
    return decodeURIComponent(parts[parts.length - 1] ?? "");
  } catch {
    return "";
  }
};

let orderedShelves = 0;
for (const file of htmlFiles) {
  const rel = path.relative(OUT, file).split(path.sep).join("/");
  const withoutIndex = rel.replace(/index\.html$/, "").replace(/\/$/, "");
  const parts = withoutIndex.split("/");
  const html = fs.readFileSync(file, "utf8");

  let hrefs = [];
  const storySection = /aria-labelledby="(?:tier|genre)-stories"[\s\S]*?<ul class="entry-list">([\s\S]*?)<\/ul>/.exec(html);
  if (storySection && parts.length <= 2 && TIER_SEGMENTS.has(parts[0])) {
    hrefs = [...storySection[1].matchAll(/<a class="entry-list__link[^"]*" href="([^"]+)"/g)].map((match) => match[1]);
  } else if (parts[0] === "themes" && parts.length === 2) {
    hrefs = [...html.matchAll(/<h2 class="card__title"><a[^>]*href="([^"]+)"/g)].map((match) => match[1]);
  } else {
    continue;
  }

  if (hrefs.length < 2) continue;
  const rows = hrefs.map((href) => entriesBySlug.get(slugOfHref(href)));
  if (rows.some((row) => !row)) continue; // a row this check does not own

  const outOfOrder = rows.findIndex((row, index) => index > 0 && shelfCompare(rows[index - 1], row) > 0);
  if (outOfOrder > 0) {
    const before = rows[outOfOrder - 1];
    const after = rows[outOfOrder];
    fail(
      rel + ": " + before.title + " (" + ratingOrder(before) + ") is listed above " +
        after.title + " (" + ratingOrder(after) + "), but ADR-0005 sorts by rating",
    );
  } else {
    orderedShelves++;
  }
}
if (orderedShelves === 0) fail("no shelf page could be checked for ADR-0005 ordering");
notes.push(orderedShelves + " shelf page(s) sort by rating, then recency");

// 12 · the crawl paths a story page offers: image entries in the sitemap, and neighbours
//
// Two things were missing rather than wrong. A story page linked one "next" story and the
// shelf above it, so a crawler reaching a story had no sideways path along the shelf; and
// the sitemap named the pages but never the cover art, which is the most distinctive thing
// on the page for image search (issue #113).
const sitemapFile = path.join(OUT, "sitemap.xml");
if (!fs.existsSync(sitemapFile)) {
  fail("site/out/sitemap.xml is missing");
} else {
  const sitemap = fs.readFileSync(sitemapFile, "utf8");
  const blocks = new Map();
  for (const block of sitemap.split("<url>").slice(1)) {
    const loc = /<loc>([^<]+)<\/loc>/.exec(block)?.[1];
    if (loc) blocks.set(loc, block);
  }
  let withImages = 0;
  for (const { slug } of contentEntries) {
    if (gatedSlugs.has(slug)) continue; // a noindexed page is absent from the sitemap by design
    const loc = [...blocks.keys()].find((candidate) => candidate.endsWith("/" + slug + "/"));
    if (!loc) continue; // the missing-page checks above already report a story with no page
    if (blocks.get(loc).includes("<image:loc>")) withImages++;
    else fail(slug + ": its sitemap entry names no image — the cover is what image search has to work with");
  }
  notes.push(withImages + " story entries carry their cover in the sitemap");
}

/*
 * Two neighbours, not one: "Next" alone means a reader who lands on a story can only walk
 * forward, and Google follows a page's links to decide what it is near. Counted on the
 * built page's own hrefs, so a link added anywhere counts.
 */
const STORY_PATH = /^\/(4-8|8-12|13\+|18+)\/[a-z0-9-]+\/[a-z0-9-]+\/$/;
let storiesWithNeighbours = 0;
for (const [rel, hrefs] of pageLinks) {
  const pageSlug = rel.split("/").slice(-2)[0];
  // A gated shelf is noindex and deliberately thin; this rule is about pages Google is
  // asked to index.
  if (gatedSlugs.has(pageSlug)) continue;
  if (!/^(4-8|8-12|13\+|18+)\/[a-z0-9-]+\/[a-z0-9-]+\/index\.html$/.test(rel)) continue;
  const neighbours = new Set(hrefs.filter((href) => STORY_PATH.test(href.split("#")[0].split("?")[0])));
  if (neighbours.size >= 2) storiesWithNeighbours++;
  else fail(rel + ": links " + neighbours.size + " other story — a shelf walk needs the story before and the one after");
}
notes.push(storiesWithNeighbours + " story page(s) link the stories either side on their shelf");

// 13 · every story has a 1200x630 social card, and its page points at it
//
// A shared link is the only growth channel this site has while it has no backlinks, and
// the card it carried was a portrait cover that every platform crops. The card is built by
// scripts/build-og-images.mjs as the last step of the build (issue #112).
const OG_DIR = path.join(OUT, "og");
let cardsChecked = 0;
for (const { slug } of contentEntries) {
  if (gatedSlugs.has(slug)) continue;
  const card = path.join(OG_DIR, slug + ".jpg");
  if (!fs.existsSync(card)) {
    fail("no social card for " + slug + " — scripts/build-og-images.mjs runs as the last step of the build");
    continue;
  }
  const meta = await sharp(card).metadata();
  if (meta.width !== 1200 || meta.height !== 630) {
    fail(slug + ": social card is " + meta.width + "x" + meta.height + ", not 1200x630");
    continue;
  }
  /*
   * The card is only worth having if the words are on it. The text panel is measured on
   * its own — x from 476 (the art ends at 420 plus the padding), y from 80 — so a font the
   * runner does not have shows up as paper-coloured pixels and fails here instead of
   * shipping a blank card. The threshold is generous: ink is near-black, paper near-white.
   */
  const panel = await sharp(card).extract({ left: 476, top: 80, width: 600, height: 380 }).toBuffer();
  const stats = await sharp(panel).stats();
  const darkest = Math.min(...stats.channels.map((channel) => channel.min));
  if (darkest > 80) {
    fail(slug + ": the social card has no ink in its text panel (darkest pixel " + darkest + ") — the font did not render");
    continue;
  }
  cardsChecked++;
}
notes.push(cardsChecked + " story social card(s) at 1200x630, with their text rendered");

/* The page has to point at it, with the size declared, or the card is invisible. */
for (const rel of pageLinks.keys()) {
  if (!/^(4-8|8-12|13\+|18+)\/[a-z0-9-]+\/[a-z0-9-]+\/index\.html$/.test(rel)) continue;
  const slug = rel.split("/").slice(-2)[0];
  if (gatedSlugs.has(slug)) continue;
  const html = fs.readFileSync(path.join(OUT, rel), "utf8");
  const ogImage = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1];
  if (ogImage !== "https://wishingtales.pages.dev/og/" + slug + ".jpg") {
    fail(rel + ": og:image is " + JSON.stringify(ogImage) + ", not the story's social card");
  }
  if (!/<meta property="og:image:width" content="1200"/.test(html) || !/<meta property="og:image:height" content="630"/.test(html)) {
    fail(rel + ": og:image:width/height are not declared as 1200x630");
  }
}

// 14 · covers ship in modern formats, and the pages name them
//
// A cover is the largest thing on a card, a shelf row and the reader, and it was a 512x768
// JPEG of about 50 KB. The variants are written by scripts/build-image-variants.mjs as the
// last step of the build; measured on one cover, WebP at 512 is 38 KB, AVIF at 512 is 34 KB,
// and the 256s are 13 and 11 KB (issue #114).
const coverDir = path.join(OUT, "covers");
let variantsChecked = 0;
let jpegTotal = 0;
let webpTotal = 0;
for (const { slug } of contentEntries) {
  if (gatedSlugs.has(slug)) continue;
  const jpeg = path.join(coverDir, slug + ".jpg");
  if (!fs.existsSync(jpeg)) continue; // the cover check above reports a missing file
  jpegTotal += fs.statSync(jpeg).size;
  for (const variant of ["256.webp", "512.webp", "256.avif", "512.avif"]) {
    const file = path.join(coverDir, slug + "-" + variant);
    if (!fs.existsSync(file)) {
      fail(slug + ": missing the " + variant + " cover — scripts/build-image-variants.mjs runs as the last step of the build");
    } else if (variant === "512.webp") {
      webpTotal += fs.statSync(file).size;
    }
  }
  variantsChecked++;
}
/*
 * The aggregate, not one file at a time: a cover that is already tiny can encode larger, and
 * failing the build over one of those would be false. The library as a whole must get lighter.
 */
if (webpTotal >= jpegTotal) {
  fail("the WebP 512 covers are not smaller than the JPEGs (" + Math.round(webpTotal / 1024) + " KB vs " + Math.round(jpegTotal / 1024) + " KB)");
}
notes.push(variantsChecked + " cover(s) also ship as AVIF and WebP (JPEG " + Math.round(jpegTotal / 1024) + " KB → WebP " + Math.round(webpTotal / 1024) + " KB)");

for (const rel of pageLinks.keys()) {
  if (!/^(4-8|8-12|13\+|18+)\/[a-z0-9-]+\/[a-z0-9-]+\/index\.html$/.test(rel)) continue;
  const slug = rel.split("/").slice(-2)[0];
  if (gatedSlugs.has(slug)) continue;
  const html = fs.readFileSync(path.join(OUT, rel), "utf8");
  if (!/<picture>/.test(html)) {
    fail(rel + ": the cover is a bare <img> — a modern browser should get AVIF or WebP");
  } else if (!/<source type="image\/avif"/.test(html) || !/<source type="image\/webp"/.test(html)) {
    fail(rel + ": the cover is not offered as both AVIF and WebP");
  }
}

// 15 · the writer collections are linked, listed, and not thin
//
// "Grimm fairy tales" is a query; "The Hazel Tree and the Golden Slipper" is not. Each of
// the three writers with a real shelf has a page, the index links them, and each page lists
// actual stories instead of promising a collection it cannot show (issue #115).
const authorsIndex = path.join(OUT, "authors", "index.html");
if (!fs.existsSync(authorsIndex)) {
  fail("site/out/authors/index.html is missing — the author hub is part of the browse surface");
} else {
  const indexHtml = fs.readFileSync(authorsIndex, "utf8");
  const linked = [...new Set([...indexHtml.matchAll(/href="(\/authors\/[a-z0-9-]+\/)"/g)].map((match) => match[1]))];
  if (linked.length < 2) fail("the authors index links " + linked.length + " collection(s) — it is a hub");
  const sitemapText = fs.existsSync(path.join(OUT, "sitemap.xml")) ? fs.readFileSync(path.join(OUT, "sitemap.xml"), "utf8") : "";
  for (const href of ["/authors/", ...linked]) {
    if (!sitemapText.includes("<loc>https://wishingtales.pages.dev" + href + "</loc>")) fail(href + " is missing from the sitemap");
  }
  for (const href of linked) {
    const page = path.join(OUT, href.replace(/^\//, ""), "index.html");
    if (!fs.existsSync(page)) { fail(href + ": the authors index links a page that was not built"); continue; }
    const html = fs.readFileSync(page, "utf8");
    const stories = new Set([...html.matchAll(/href="(\/(?:4-8|8-12|13\+|18+)\/[a-z0-9-]+\/[a-z0-9-]+\/)"/g)].map((m) => m[1]));
    if (stories.size < 2) fail(href + ": lists " + stories.size + " story — a collection page that thin is not worth indexing");
  }
  notes.push(linked.length + " writer collection page(s), each listing its stories");
}

// 16 · the time shelves are reachable, listed, and linked from the hub
//
// "A story that fits before lights out" is the second question after the age, and the
// library has the data for it. Two shelves: under ten minutes, and twelve and up
// (issue #115).
const timeIndex = path.join(OUT, "reading-time", "index.html");
if (!fs.existsSync(timeIndex)) {
  fail("site/out/reading-time/index.html is missing — the time hub is part of the browse surface");
} else {
  const browsePath = path.join(OUT, "browse", "index.html");
  const browseHtml = fs.existsSync(browsePath) ? fs.readFileSync(browsePath, "utf8") : "";
  const timeSitemap = fs.existsSync(path.join(OUT, "sitemap.xml")) ? fs.readFileSync(path.join(OUT, "sitemap.xml"), "utf8") : "";
  const timeLinked = [...new Set([...fs.readFileSync(timeIndex, "utf8").matchAll(/href="(\/reading-time\/[a-z0-9-]+\/)"/g)].map((match) => match[1]))];
  for (const href of timeLinked) {
    if (!browseHtml.includes('href="' + href + '"')) {
      fail(href + " is not linked from /browse/ — a shelf nobody can find is not a shelf");
    }
    const page = path.join(OUT, href.replace(/^\//, ""), "index.html");
    if (!fs.existsSync(page)) { fail(href + ": linked from the hub but not built"); continue; }
    const stories = new Set([...fs.readFileSync(page, "utf8").matchAll(/href="(\/(?:4-8|8-12|13\+|18+)\/[a-z0-9-]+\/[a-z0-9-]+\/)"/g)].map((m) => m[1]));
    if (stories.size < 2) fail(href + ": lists " + stories.size + " story — a band with one story is not a shelf");
    if (!timeSitemap.includes("<loc>https://wishingtales.pages.dev" + href + "</loc>")) fail(href + " is missing from the sitemap");
  }
  notes.push(timeLinked.length + " reading-time shelf(ves), each linked from /browse/");
}

// 17 · report
for (const note of notes) console.log("  · " + note);
if (failures.length > 0) {
  console.error("\n" + failures.length + " problem(s):");
  for (const message of failures) console.error("  ✘ " + message);
  process.exit(1);
}
console.log("\n✔ build verified: canonicals, JSON-LD, internal links, covers, drafts excluded");
