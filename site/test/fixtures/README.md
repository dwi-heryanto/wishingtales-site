# Build fixtures

Not content. These eight markdown files exist so the site can be built, previewed and verified
before the first real story is published: `next build` with `output: export` refuses to generate a
dynamic route with no paths, so a completely empty `content/` cannot be built at all.

```sh
pnpm build:fixture && pnpm verify:reader && pnpm verify:adult   # the fixture pair, in this order
```

`pnpm verify` is **not** the fixture check: it verifies the real `content/` and fails against a
fixture build. The real gate is `pnpm typecheck && pnpm build && pnpm verify`, and mixing the two
orders is the trap AGENTS.md names.

`the-tin-whistle` is a **standalone story** — no `series`, no `seriesOrder` — and it is here for a
reason the older fixtures cannot cover: `/8-12/adventure/the-first-lantern/` is a series episode, and every
story in the real `content/` is too, so without this file nothing in either build proves that a
standalone story renders without series chrome. It is also the newest entry, so the home page's
featured slot is a standalone one.

`the-last-train-home` (`13+`) and `what-the-fog-brought-in` (`18+`, genre `horror`) exist for the
opposite reason: no adult story exists in the real `content/`, and none can while
`TIER_PROFILES[tier].ships` is false for both older tiers (#24 built the gate those tiers were
waiting on; they now wait on a prompt profile each). They are the only
way to see the notice, the `noindex`, the dark default and the missing links from kids pages working
at all — `pnpm verify:adult` drives exactly those in a real browser. Both are dated newer than every
children's story on purpose: if the filters ever stop filtering, the home page features an 18+ horror
story and the check that says it must not will fail.

`the-monkeys-paw` is a gated **classic**, which is a different path through the same rules: it has
provenance, it is listed on `/classics/` and `/sources/` when and only when it may be, and its "next"
offer has to stay on the adult side of the gate. A story and a classic are told apart by one block of
frontmatter and nothing else, so both need a gated example or half the filter is untested.

They borrow `the-first-lantern.png` and `the-tin-whistle.png` as placeholder covers rather than
adding art, and share the `courage` theme so the theme hub has a gated story it must not link.

The cover images they reference (`site/public/covers/the-first-lantern.png`,
`.../the-tin-whistle.png` and `.../the-fisherman-and-his-wife.png`) are flat colour placeholders
generated for this purpose.

Nothing here is ever published: the site only reads this directory when `CONTENT_DIR` points at it,
`publish:draft` never looks here, and `scripts/verify-build.mjs` checks `content/` — not this
directory — against the published set. Delete the whole directory once two real stories are live.
