import type { ReactNode } from "react";

/**
 * A deliberately small markdown reader for story bodies.
 *
 * It renders React nodes rather than an HTML string, so raw HTML in a draft can
 * never become markup on the page — there is no dangerouslySetInnerHTML here.
 * Supported: paragraphs, ## and ### headings, blockquotes, bullet lists, and
 * scene breaks written as *** or ---.
 */

const SCENE_BREAK = /^(?:\*\s*){3,}$|^-{3,}$|^(?:_\s*){3,}$/;

function smarten(text: string): string {
  return text
    .replace(/(^|[\s([\u2014\u2013"'])'/g, "$1\u2018")
    .replace(/'/g, "\u2019")
    .replace(/(^|[\s([\u2014\u2013])"/g, "$1\u201c")
    .replace(/"/g, "\u201d")
    .replace(/\s--\s/g, " \u2014 ")
    .replace(/\.\.\./g, "\u2026");
}

function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(smarten(text.slice(last, match.index)));
    const token = match[0];
    const key = `${keyPrefix}-${index++}`;

    if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{smarten(token.slice(2, -2))}</strong>);
    } else if (token.startsWith("[")) {
      const linkMatch = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      const label = linkMatch ? linkMatch[1] : token;
      const href = linkMatch ? linkMatch[2] : "#";
      const safe = href.startsWith("/") || href.startsWith("https://") ? href : "#";
      nodes.push(
        <a key={key} href={safe}>
          {smarten(label)}
        </a>,
      );
    } else {
      nodes.push(<em key={key}>{smarten(token.slice(1, -1))}</em>);
    }
    last = match.index + token.length;
  }

  if (last < text.length) nodes.push(smarten(text.slice(last)));
  return nodes;
}

export function StoryProse({ markdown, dropcap = true }: { markdown: string; dropcap?: boolean }) {
  const blocks = markdown.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  return (
    <div className={`prose${dropcap ? " prose--dropcap" : ""}`}>
      {blocks.map((block, blockIndex) => {
        const key = `b${blockIndex}`;

        if (SCENE_BREAK.test(block.replace(/\s/g, ""))) {
          return (
            <p className="scene-break" key={key} role="separator" aria-label="Scene break">
              ***
            </p>
          );
        }

        if (block.startsWith("### ")) {
          return <h3 key={key}>{inline(block.slice(4), key)}</h3>;
        }
        if (block.startsWith("## ")) {
          return <h2 key={key}>{inline(block.slice(3), key)}</h2>;
        }
        if (block.startsWith("> ")) {
          const quoted = block
            .split("\n")
            .map((line) => line.replace(/^> ?/, ""))
            .join(" ");
          return <blockquote key={key}>{inline(quoted, key)}</blockquote>;
        }
        if (/^[-*] /m.test(block) && block.split("\n").every((line) => /^[-*] /.test(line))) {
          return (
            <ul key={key}>
              {block.split("\n").map((line, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>{inline(line.replace(/^[-*] /, ""), `${key}-${itemIndex}`)}</li>
              ))}
            </ul>
          );
        }

        return <p key={key}>{inline(block.replace(/\n/g, " "), key)}</p>;
      })}
    </div>
  );
}
