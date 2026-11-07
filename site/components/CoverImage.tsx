import type { Entry } from "@/lib/content";

/**
 * A cover, in the formats and at the sizes the page actually draws it.
 *
 * Every cover is a 512x768 JPEG of about 50 KB, and it is the largest thing on a card, a
 * shelf row and the reader. The variants are written into the exported site by
 * `scripts/build-image-variants.mjs`; this component only names them, in the order a
 * browser can take them: AVIF, then WebP, then the JPEG that every browser has (issue #114).
 *
 * `sizes` is required rather than defaulted, because only the call site knows how wide the
 * image is drawn — a card grid, a 6rem shelf thumbnail and the reader's figure are three
 * different widths, and a wrong `sizes` makes the browser download the wrong file.
 */
export function CoverImage({
  entry,
  sizes,
  priority = false,
}: {
  entry: Entry;
  /** The widths this image is drawn at, in the CSS of the place it appears. */
  sizes: string;
  /** Set on the one image that is the page's largest paint: eager, high priority. */
  priority?: boolean;
}) {
  const base = entry.cover.replace(/\.jpe?g$/i, "");
  return (
    <picture>
      <source type="image/avif" srcSet={base + "-256.avif 256w, " + base + "-512.avif 512w"} sizes={sizes} />
      <source type="image/webp" srcSet={base + "-256.webp 256w, " + base + "-512.webp 512w"} sizes={sizes} />
      <img
        src={entry.cover}
        alt={entry.coverAlt}
        width={512}
        height={768}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
      />
    </picture>
  );
}
