#!/usr/bin/env node
/**
 * Builds the 1200x630 social card for every story.
 *
 *   node --experimental-strip-types scripts/build-og-images.mjs   # after next build
 *
 * A shared link is the only growth channel this site has while it has no backlinks, and the
 * card it carried was a 512x768 portrait cover that every platform crops. The card puts the
 * art on the left (420x630 — exactly a cover's 2:3 shape, so no art is lost) and the title on
 * the right, with "A retelling of Cinderella" for a classic, because the source tale is what
 * a parent recognises (issue #112).
 *
 * **Rendered cards are cached by a hash of everything that goes into one** — the SVG (title,
 * meta, colours, font stack), the cover bytes, and the render options — in
 * `site/.cache/og`. A publish changes exactly one card; the other seventy are copied. The
 * cache sits outside `site/out` because Next owns that directory. Delete it freely: the next
 * build renders everything. CI restores it with a rolling key; together with the image
 * variants it removes about twenty seconds from a build that changes one story.
 *
 * Cards are generated, not committed: they are derived from the cover and the title, so a
 * retitle regenerates them, and 65 JPEGs in git would be 65 files to keep in step. Written
 * into the exported site, which is what gets deployed.
 *
 * The font stack matters: this runs on a laptop and on an ubuntu runner, so it asks for
 * something both have and lets the last generic family be the guarantee. Inter's absence on
 * the runner is why the stack ends in a generic, and verify-build checks the card actually
 * has ink in it — a card that rendered no text is worse than no card.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { getEntries } from "../site/lib/content.ts";
import { secondName as secondNameOf } from "../site/lib/retold.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "site", "out");
const OG = path.join(OUT, "og");
const CACHE = path.join(ROOT, "site", ".cache", "og");

const WIDTH = 1200;
const HEIGHT = 630;
/** 420x630 is 2:3, exactly a cover's shape: the art is cropped by nothing. */
const ART_WIDTH = 420;
const PAD = 56;

/* The site's tokens, sampled: paper oklch(97% 0.012 78), ink oklch(21% 0.014 60), accent
   oklch(52% 0.152 42). A card is not a page; approximating them keeps this script free of a
   CSS parser. */
const PAPER = "#f7f2ea";
const INK = "#241d18";
const MUTED = "#6b5f54";
const ACCENT = "#b4552a";
const FONT = "DejaVu Serif, Georgia, Palatino, 'Times New Roman', serif";

/* Everything outside the SVG that shapes the JPEG. The SVG carries the rest of the template;
   change a render option here or below and bump this so old cards cannot be reused. */
const RENDER_VERSION = "og-v1";

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** A greedy wrap on a character budget: the panel and the font size are both fixed here. */
function wrap(text, perLine, maxLines) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const candidate = line ? line + " " + word : word;
    if (!line || candidate.length <= perLine) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = kept[maxLines - 1].replace(/\s+\S*$/, "") + "…";
  return kept;
}

fs.mkdirSync(CACHE, { recursive: true });
const entries = getEntries();
fs.rmSync(OG, { recursive: true, force: true });
fs.mkdirSync(OG, { recursive: true });

let built = 0;
let fromCache = 0;
let rendered = 0;
let skipped = 0;

for (const entry of entries) {
  const coverPath = path.join(ROOT, "site", "public", entry.cover);
  // The fixture set has no art for its made-up stories; a card is skipped rather than
  // failing a fixture build, and verify-build requires one for every real story.
  if (!fs.existsSync(coverPath)) {
    skipped++;
    continue;
  }

  const long = entry.title.length > 46;
  const fontSizes = long ? 42 : 52;
  const lines = wrap(entry.title, long ? 30 : 26, 3);
  const lineHeight = Math.round(fontSizes * 1.16);
  const titleTop = 150;

  const secondName = secondNameOf(entry);
  const meta = secondName
    ? "A retelling of " + secondName
    : "Ages " + entry.ageTier + " · " + entry.readingTime + " min read";

  const tspans = lines
    .map((line, index) => '<tspan x="' + (ART_WIDTH + PAD) + '" dy="' + (index === 0 ? 0 : lineHeight) + '">' + escapeXml(line) + "</tspan>")
    .join("");

  const metaY = titleTop + (lines.length - 1) * lineHeight + 74;

  const svg =
    '<svg width="' + WIDTH + '" height="' + HEIGHT + '" xmlns="http://www.w3.org/2000/svg">' +
    '<text x="' + (ART_WIDTH + PAD) + '" y="' + titleTop + '" font-family="' + FONT + '" font-size="' + fontSizes +
    '" font-weight="600" fill="' + INK + '">' + tspans + "</text>" +
    '<text x="' + (ART_WIDTH + PAD) + '" y="' + metaY + '" font-family="' + FONT + '" font-size="26" fill="' + MUTED + '">' +
    escapeXml(meta) + "</text>" +
    '<text x="' + (ART_WIDTH + PAD) + '" y="' + (HEIGHT - 52) + '" font-family="' + FONT + '" font-size="24" ' +
    'letter-spacing="3" fill="' + ACCENT + '">WishingTales</text>' +
    "</svg>";

  const coverBytes = fs.readFileSync(coverPath);
  const hash = crypto
    .createHash("sha256")
    .update(svg)
    .update(coverBytes)
    .update(RENDER_VERSION + "|" + WIDTH + "x" + HEIGHT + "|art" + ART_WIDTH + "|jpeg82mozjpeg")
    .digest("hex")
    .slice(0, 16);
  const cached = path.join(CACHE, entry.slug + "-" + hash + ".jpg");
  const target = path.join(OG, entry.slug + ".jpg");

  if (fs.existsSync(cached)) {
    fs.copyFileSync(cached, target);
    fromCache++;
    built++;
    continue;
  }

  const art = await sharp(coverPath).resize(ART_WIDTH, HEIGHT, { fit: "cover" }).toBuffer();

  const buffer = await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: PAPER } })
    .composite([
      { input: art, left: 0, top: 0 },
      { input: Buffer.from(svg), left: 0, top: 0 },
    ])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  fs.writeFileSync(cached, buffer);
  fs.writeFileSync(target, buffer);
  rendered++;
  built++;
}

console.log(
  "wrote " + built + " social card(s) to site/out/og (" + fromCache + " from cache, " + rendered +
    " rendered)" + (skipped ? ", " + skipped + " skipped (no cover art)" : ""),
);
