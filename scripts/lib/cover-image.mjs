/**
 * The image steps the two cover scripts share, in one place and on every
 * platform.
 *
 * These were raw `sips` calls, which made optimising a cover a macOS-only job.
 * sharp carries its own libvips for every platform this repo runs on, so one
 * code path yields the same 512x768 at the same weight everywhere — including
 * the Linux runner that sweeps covers.
 */
import sharp from "sharp";

/** The cards' 2:3, and the size `optimize-cover` settles on. */
const RATIO = 2 / 3;

/**
 * Shipping weight, and the ceiling nobody may cross.
 *
 * The encoder above targets roughly 100 KB (512x768, q68). `TARGET` is the point where a
 * cover is worth re-encoding: an image model returns about 800 KB, the hand-optimised
 * covers sit at 60-120 KB, and there is nothing between except an unoptimised draw. The
 * `CEILING` is the failure line for `pnpm verify`: above it the file is raw model output
 * that no step ever touched (the three found on 2026-10-14 were 455, 672 and 740 KB), and
 * it is deliberately far above `TARGET` so that art which legitimately re-encodes to
 * 130 KB does not fail a build forever for being 10 KB over an aspiration.
 */
export const COVER_TARGET_BYTES = 120 * 1024;
export const COVER_CEILING_BYTES = 250 * 1024;
export const CARD_WIDTH = 512;
export const CARD_HEIGHT = 768;

/**
 * Crop to the cards' 2:3, keeping the full height.
 *
 * `offsetX` picks which column to keep, for the generated square whose subject
 * sits left of centre. Without it the crop is centred.
 */
export async function cropToTwoThirds(input, output, offsetX) {
  const image = sharp(input, { failOn: "none" });
  const { width, height } = await image.metadata();
  const cropped = Math.round(height * RATIO);
  const left = Math.max(0, offsetX ?? Math.floor((width - cropped) / 2));
  await image
    .extract({ left, top: 0, width: cropped, height })
    .jpeg({ quality: 95 })
    .toFile(output);
  return { width: cropped, height };
}

/**
 * Resize to the card size and encode at the shipping quality, cropping to 2:3
 * if the source is not already that shape, so the route's cards never letterbox.
 */
export async function writeCardJpeg(input, output, quality = 68) {
  await sharp(input, { failOn: "none" })
    .resize(CARD_WIDTH, CARD_HEIGHT, { fit: "cover", position: "centre" })
    .jpeg({ quality })
    .toFile(output);
}
