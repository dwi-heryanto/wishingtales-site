/**
 * Narration URLs and labels.
 *
 * The MP3s live in R2 and are served by the Worker with Range support; the site is static,
 * so the player streams from there rather than proxying through Pages. CORS is open on the
 * audio route, which is what makes a cross-origin <audio> element work.
 */
export const AUDIO_ORIGIN =
  process.env.NEXT_PUBLIC_AUDIO_ORIGIN ?? "https://wishingtales-cron.m-dwiheryanto2.workers.dev";

export function audioUrl(slug: string): string {
  return AUDIO_ORIGIN + "/audio/" + encodeURIComponent(slug) + ".mp3";
}

/** m:ss, the shape a player shows. */
export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return minutes + ":" + String(rest).padStart(2, "0");
}
