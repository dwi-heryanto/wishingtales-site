# content/

Published stories only. Drafts never live here — they live under `drafts/` on a `drafts/<slug>` branch, and the pipeline moves them here when it merges its own pull request (see `docs/decisions.md` § D11).

| Path | URL | What it is |
| --- | --- | --- |
| `content/stories/<slug>.md` | `/<ageTier>/<genre>/<slug>/` | Original stories — standalone by default |
| `content/classics/<slug>.md` | `/<ageTier>/<genre>/<slug>/` | Retold public-domain classics |
| `content/series/<slug>.md` | `/series/<slug>/` | Series metadata (title, blurb, who it is for) |
| `content/themes/<slug>.md` | `/themes/<slug>/` | Theme hub metadata |

A story's address is derived from its frontmatter: the age tier and the **first** genre, so `ageTier: "8-12"` with `genres: ["folk tale", …]` becomes `/8-12/folk-tale/<slug>/`. That address is also the canonical, the breadcrumb and the sitemap entry — all of it from `site/lib/urls.ts`, so nothing has to be kept in step by hand. The pre-tier `/stories/<slug>/` and `/classics/<slug>/` addresses still resolve: the build writes `site/out/_redirects` from the same data, and `pnpm verify` fails if a redirect is missing or lands on a page that was not built.

Frontmatter is validated at build time against the schema in `site/lib/schema.ts`. A file that fails validation fails the build (and the CI check on the draft PR), so a malformed draft cannot be merged by accident.
