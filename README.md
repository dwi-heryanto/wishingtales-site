# WishingTales — the site

The front end of [WishingTales](https://wishingtales.pages.dev), a small library of
stories to read aloud to a child or read alone: retold classics and original tales, each
one complete in a single sitting.

This repository is the **website half** of the project, published so the front end can be
read, run and learned from. The story generator — the Worker, the writing prompts and the
public-domain sourcing research — is not part of it.

## Stack

- Next.js 16 with `output: export`: every page is static HTML, served by Cloudflare Pages
- TypeScript and React 19
- Hand-written CSS with design tokens; self-hosted fonts; no third-party scripts
- A verification suite that drives the built site in headless Chrome

## Layout

| Path | What lives there |
| --- | --- |
| `site/` | the Next.js app: pages, components, styles, public assets |
| `content/` | published stories (markdown + YAML frontmatter), series bibles, theme hubs |
| `scripts/` | the build's redirect writer and the verification suite |

## Run it

```sh
pnpm install
pnpm dev                                  # http://localhost:3000

pnpm typecheck && pnpm build && pnpm verify
```

The browser checks need the fixture library — a small set of made-up stories that
exercises every age tier, including the gated one:

```sh
pnpm build:fixture && pnpm verify:reader && pnpm verify:adult
```

## Notes

- `content/` holds published stories only; drafts never land here.
- The `13+` shelf is gated in the app and `noindex` to search engines, and children's
  pages never link to it.
- The story text is © WishingTales; the code is MIT — see [LICENSE](LICENSE).
