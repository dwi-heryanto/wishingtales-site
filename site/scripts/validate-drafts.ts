/**
 * Validates every file in drafts/ against the frontmatter schema.
 *
 * The site build never sees drafts (they are excluded on purpose), so this is
 * the check that makes the CI run on a draft pull request meaningful: a draft
 * with broken frontmatter fails here instead of failing weeks later when
 * somebody moves it into content/.
 *
 * Run: pnpm validate:drafts
 */
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { draftClassicSchema, draftStorySchema } from "../lib/schema.ts";

const draftsDir = path.resolve(import.meta.dirname, "..", "..", "drafts");

if (!fs.existsSync(draftsDir)) {
  console.log("No drafts/ directory — nothing to validate.");
  process.exit(0);
}

const files = fs.readdirSync(draftsDir).filter((name) => name.endsWith(".md"));
if (files.length === 0) {
  console.log("drafts/ is empty — nothing to validate.");
  process.exit(0);
}

let failures = 0;

for (const name of files) {
  const file = path.join(draftsDir, name);
  const raw = fs.readFileSync(file, "utf8");
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);

  if (!match) {
    console.error("✘ drafts/" + name + ": missing YAML frontmatter block");
    failures++;
    continue;
  }

  let data: unknown;
  try {
    data = parseYaml(match[1]);
  } catch (error) {
    console.error("✘ drafts/" + name + ": frontmatter is not valid YAML — " + (error as Error).message);
    failures++;
    continue;
  }

  const body = match[2].trim();
  const words = body.split(/\s+/).filter(Boolean).length;
  const isClassic = typeof data === "object" && data !== null && "provenance" in data;
  const result = isClassic ? draftClassicSchema.safeParse(data) : draftStorySchema.safeParse(data);

  if (!result.success) {
    console.error("✘ drafts/" + name + " (" + (isClassic ? "classic" : "story") + ")");
    for (const issue of result.error.issues) {
      console.error("    " + (issue.path.join(".") || "(root)") + ": " + issue.message);
    }
    failures++;
    continue;
  }

  const slug = result.data.slug;
  if (slug !== name.replace(/\.md$/, "")) {
    console.error("✘ drafts/" + name + ": slug \"" + slug + "\" does not match the file name");
    failures++;
    continue;
  }

  const cover = path.resolve(import.meta.dirname, "..", "public", result.data.cover.replace(/^\//, ""));
  if (!fs.existsSync(cover)) {
    console.error("✘ drafts/" + name + ": cover " + result.data.cover + " is not in site/public");
    failures++;
    continue;
  }

  const flag = words < 1150 || words > 2400 ? " (length outside the 1,150–2,300 house range)" : "";
  console.log("✔ drafts/" + name + " — " + words + " words" + flag);
}

if (failures > 0) {
  console.error("\n" + failures + " draft(s) failed validation.");
  process.exit(1);
}
console.log("\nAll drafts valid.");
