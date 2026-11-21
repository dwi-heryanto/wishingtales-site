/**
 * The two closed vocabularies of ADR-0018: how strong a gated story's scare is,
 * and what a guardian is warned about. Closed the way the genre list is closed —
 * freeform warning tags are "filters that lie" — and checked mechanically at the
 * schema, so the same verdict a test gets is the verdict a reader gets months later.
 *
 * There is no "choose not to warn": a story carrying none of the four warnings
 * ships an empty list, which is "an honest 'none of these', not a shrug".
 */

/** A ladder, not a number — three grades match how a guardian chooses. */
export const INTENSITIES = ["spooky", "creepy", "intense"] as const;
export type Intensity = (typeof INTENSITIES)[number];

export const WARNINGS = ["peril", "death or loss", "frightening imagery", "psychological suspense"] as const;
export type Warning = (typeof WARNINGS)[number];

/** Display order, quiet to strong — the shelf filter sorts by it. */
export const INTENSITY_ORDER: Record<Intensity, number> = {
  spooky: 0,
  creepy: 1,
  intense: 2,
};

export const INTENSITY_LABEL: Record<Intensity, string> = {
  spooky: "Spooky",
  creepy: "Creepy",
  intense: "Intense",
};

export const WARNING_LABEL: Record<Warning, string> = {
  "peril": "Peril",
  "death or loss": "Death or loss",
  "frightening imagery": "Frightening imagery",
  "psychological suspense": "Psychological suspense",
};

/** Case-and-spacing normalisation for a model answer, the `parseGenres` precedent. */
export function normaliseIntensity(value: unknown): Intensity | null {
  const text = String(value ?? "").trim().toLowerCase();
  return (INTENSITIES as readonly string[]).includes(text) ? (text as Intensity) : null;
}

/** Keeps only the spellings that exist; an unknown warning is dropped, not corrected. */
export function parseWarnings(values: unknown): Warning[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<Warning>();
  for (const value of values) {
    const text = String(value).trim().toLowerCase();
    if ((WARNINGS as readonly string[]).includes(text)) seen.add(text as Warning);
  }
  return WARNINGS.filter((warning) => seen.has(warning));
}
