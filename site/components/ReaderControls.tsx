"use client";

import { useEffect, useState } from "react";
import { THEME_COLORS } from "@/lib/theme";

const SCALES = [
  { label: "A", value: "1", title: "Smaller text", size: "0.8rem" },
  { label: "A", value: "1.12", title: "Standard text", size: "0.95rem" },
  { label: "A", value: "1.26", title: "Larger text", size: "1.1rem" },
];

const LEADING = [
  { label: "Tight", value: "1.55", title: "Tight spacing" },
  { label: "Normal", value: "1.68", title: "Normal spacing" },
  { label: "Loose", value: "1.9", title: "Loose spacing" },
];

const THEMES = [
  { id: "light", label: "Light" },
  { id: "sepia", label: "Sepia" },
  { id: "dark", label: "Dark" },
] as const;

type ThemeId = (typeof THEMES)[number]["id"];
const DEFAULT_SCALE = "1.12";
const DEFAULT_LEADING = "1.68";

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode — preferences simply do not persist */
  }
}

/**
 * Reading settings. Collapsed behind one line on phones (the story is the point),
 * open by default from tablet up. Every choice is applied to <html> and kept in
 * localStorage so it survives navigation; the pre-paint script in the layout
 * applies it again before the next page renders.
 *
 * Native radios rather than toggle buttons (ADR-0009): the three sizes are mutually
 * exclusive, so the platform announces "2 of 3" and arrow keys move between them for
 * free. The visible "A" is a glyph, not a name — each input carries the name a screen
 * reader needs ("Larger text"), which the old `title` attribute only implied. The
 * 44px target is CSS (.control-option), not padding on the glyph.
 *
 * `defaultTheme` is the theme a page falls back to when the reader has never chosen one.
 * An adult page hands in "dark" (ADR-0002), and the stored choice still wins over it: the
 * ADR asks for a different default, not for overruling an accessibility setting.
 */
export function ReaderControls({ defaultTheme }: { defaultTheme?: ThemeId }) {
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [leading, setLeading] = useState(DEFAULT_LEADING);
  const [theme, setTheme] = useState<ThemeId>("light");
  const [readAloud, setReadAloud] = useState(false);

  // Adopt whatever the pre-paint script already applied.
  useEffect(() => {
    setScale(read("wt:scale", DEFAULT_SCALE));
    setLeading(read("wt:leading", DEFAULT_LEADING));
    /*
     * Adopt what the pre-paint script actually applied. It knows the page's default from
     * the URL (ADR-0002's third amendment), so asking the OS again here would let the
     * control disagree with the page it is on.
     */
    const storedTheme = read("wt:theme", "");
    const applied = document.documentElement.getAttribute("data-reader-theme");
    setTheme(
      THEMES.some((option) => option.id === storedTheme)
        ? (storedTheme as ThemeId)
        : THEMES.some((option) => option.id === applied)
          ? (applied as ThemeId)
          : (defaultTheme ?? "light"),
    );
    setReadAloud(document.documentElement.getAttribute("data-mode") === "read-aloud");
  }, [defaultTheme]);

  function applyScale(value: string) {
    setScale(value);
    write("wt:scale", value);
    document.documentElement.style.setProperty("--reader-scale", value);
  }

  function applyLeading(value: string) {
    setLeading(value);
    write("wt:leading", value);
    document.documentElement.style.setProperty("--reader-leading", value);
  }

  function applyTheme(value: ThemeId) {
    setTheme(value);
    write("wt:theme", value);
    document.documentElement.setAttribute("data-reader-theme", value);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLORS[value]);
  }

  function toggleReadAloud() {
    const next = !readAloud;
    setReadAloud(next);
    write("wt:mode", next ? "read-aloud" : "normal");
    if (next) {
      document.documentElement.setAttribute("data-mode", "read-aloud");
    } else {
      document.documentElement.removeAttribute("data-mode");
    }
  }

  return (
    <details className="controls">
      <summary className="controls__summary">
        Reading settings
        <span className="visually-hidden"> — text size, spacing, theme and read-aloud mode</span>
      </summary>

      <div className="controls__panel">
        <fieldset className="controls__group">
          <legend className="controls__label">Text size</legend>
          <span className="controls__options">
          {SCALES.map((option) => (
            <label key={option.value} className="control-option">
              <input
                type="radio"
                name="reader-scale"
                value={option.value}
                checked={scale === option.value}
                onChange={() => applyScale(option.value)}
                aria-label={option.title}
              />
              <span className="control" style={{ fontSize: option.size }} aria-hidden="true">
                {option.label}
              </span>
            </label>
          ))}
          </span>
        </fieldset>

        <fieldset className="controls__group">
          <legend className="controls__label">Spacing</legend>
          <span className="controls__options">
          {LEADING.map((option) => (
            <label key={option.value} className="control-option">
              <input
                type="radio"
                name="reader-leading"
                value={option.value}
                checked={leading === option.value}
                onChange={() => applyLeading(option.value)}
                aria-label={option.title}
              />
              <span className="control control--text" aria-hidden="true">
                {option.label}
              </span>
            </label>
          ))}
          </span>
        </fieldset>

        <fieldset className="controls__group">
          <legend className="controls__label">Theme</legend>
          <span className="swatches">
            {THEMES.map((option) => (
              <label key={option.id} className="control-option control-option--swatch">
                <input
                  type="radio"
                  name="reader-theme"
                  value={option.id}
                  checked={theme === option.id}
                  onChange={() => applyTheme(option.id)}
                  aria-label={option.label + " theme"}
                />
                <span className={"swatch swatch--" + option.id} aria-hidden="true" />
              </label>
            ))}
          </span>
        </fieldset>

        <div className="controls__group">
          <button
            type="button"
            className="control control--text"
            aria-pressed={readAloud}
            onClick={toggleReadAloud}
          >
            {readAloud ? "Exit read-aloud" : "Read-aloud mode"}
          </button>
        </div>
      </div>
    </details>
  );
}
