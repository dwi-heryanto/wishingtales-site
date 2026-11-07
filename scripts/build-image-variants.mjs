#!/usr/bin/env node
/**
 * Writes WebP and AVIF variants of every cover into the exported site.
 *
 *   node scripts/build-image-variants.mjs   # after next build, before verify
 *
 * Covers are 512x768 JPEGs at about 50 KB, and they are what a card, a shelf row and the
 * reader actually draw — the largest thing on most pages. Two sizes are enough: 256 for the
 * card grids and shelf thumbnails, 512 for the reader and for high-density phones. Measured
 * on one cover: 51 KB JPEG, 38 KB WebP at 512, 13 KB WebP at 256, 34 KB AVIF at 512, 11 KB
 * AVIF at 256 (issue #114).
 *
 * AVIF runs at effort 2, not the default 4: it produced the same 34 KB at 30 ms instead of
 * 177 ms, which is the difference between seven seconds and a minute for the whole library.
 *
 * **Encoded output is cached by source hash** in `site/.cache/image-variants`, so a build
 * that changes one story re-encodes one cover rather than seventy-one. The cache lives
 * outside `site/out` because Next owns and can clean that directory. It is safe to delete:
 * the next build regenerates every file. CI restores it with a rolling key, which is the
 * only cache that has ever moved this build's clock — the Next compiler cache did not.
 *
 * Variants are generated rather than committed, like the social cards: they are derived from
 * art that is already in the repository, and 260 binary files in git would be 260 files to
 * keep in step with the JPEGs.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_COVERS = path.join(ROOT, "site", "out", "covers");
const CACHE = path.join(ROOT, "site", ".cache", "image-variants");

if (!fs.existsSync(OUT_COVERS)) {
  console.error("site/out/covers is missing — run the site build first.");
  process.exit(1);
}

fs.mkdirSync(CACHE, { recursive: true });

const SIZES = [256, 512];
/** Bump when the encode settings below change, or a cached encode outlives its settings. */
const ENCODE_VERSION = "v1";

const covers = fs
  .readdirSync(OUT_COVERS)
  .filter((name) => /\.jpe?g$/i.test(name))
  .sort();

let written = 0;
let fromCache = 0;
let rendered = 0;
let bytes = 0;

for (const name of covers) {
  const source = path.join(OUT_COVERS, name);
  const sourceBytes = fs.readFileSync(source);
  const hash = crypto.createHash("sha256").update(sourceBytes).digest("hex").slice(0, 16);
  const base = name.replace(/\.jpe?g$/i, "");
  for (const width of SIZES) {
    for (const format of ["webp", "avif"]) {
      const target = path.join(OUT_COVERS, base + "-" + width + "." + format);
      const cached = path.join(CACHE, base + "-" + hash + "-" + ENCODE_VERSION + "-" + width + "." + format);

      if (fs.existsSync(cached)) {
        fs.copyFileSync(cached, target);
        bytes += fs.statSync(cached).size;
        fromCache++;
      } else {
        const image = sharp(source).resize(width, null, { withoutEnlargement: true });
        const buffer =
          format === "webp"
            ? await image.webp({ quality: 72 }).toBuffer()
            : await image.avif({ quality: 55, effort: 2 }).toBuffer();
        fs.writeFileSync(cached, buffer);
        fs.writeFileSync(target, buffer);
        bytes += buffer.length;
        rendered++;
      }
      written++;
    }
  }
}

console.log(
  "wrote " + written + " image variant(s) for " + covers.length + " cover(s) — " +
    Math.round(bytes / 1024) + " KB of webp/avif (" + fromCache + " from cache, " + rendered + " encoded)",
);
