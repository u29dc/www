> `www` is an Astro / MDX / raw TypeScript site for U29DC.

## 1. Documentation

- Primary references: [Astro](https://docs.astro.build/en/getting-started/), [Astro MDX](https://docs.astro.build/en/guides/integrations-guide/mdx/), [Astro content collections](https://docs.astro.build/en/guides/content-collections/), [Vite](https://vite.dev/guide/), [MDX](https://mdxjs.com/), [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API), [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
- Edit [`AGENTS.md`](AGENTS.md) only; [`README.md`](README.md) and [`CLAUDE.md`](CLAUDE.md) are symlinks to it.
- Do not push from this repo. Commits, when requested, are local-only unless Han gives explicit later approval to publish.

## 2. Stack

- Astro owns routing, static output, content collections, and page rendering.
- MDX is the default authored-content format.
- Raw TypeScript modules should own canvas/WebGL/WebGPU effects.
- Do not reintroduce Svelte, React, Vue, or another UI framework unless a specific interactive component justifies the dependency.
- Prefer plain `.astro`, `.mdx`, `.ts`, and CSS files until a heavier abstraction is clearly useful.

## 3. Commands

- `bun install` - install dependencies and refresh the lockfile.
- `bun run dev` - start Astro locally.
- `bun run build` - build the Astro site.
- `bun run preview` - preview the production build.
- `bun run util:format` - apply and verify formatting with Oxfmt.
- `bun run util:lint` - lint and auto-fix with Oxlint.
- `bun run util:check` - format, lint-fix, type-check, and build.
- `bun run util:clean` - remove Astro/build caches.

## 4. Architecture Direction

- Keep content portable. Prefer MDX frontmatter and content collections over framework-specific data machinery.
- Keep creative effects portable. Put canvas/WebGL/WebGPU logic in standalone TypeScript modules that can survive a future framework migration.
- Keep Astro pages mostly static. Add client JavaScript only for visible interaction, media, graphics, or progressive enhancement.
- Use Vite through Astro. Do not add a parallel custom build pipeline unless a concrete asset/effect requirement needs it.

## 5. Validation

- For dependency or config changes, run `bun install` and `bun run util:check`.
- For visual work, run `bun run dev` and verify desktop/mobile browser screenshots before reporting completion.
- For WebGL/WebGPU work, verify reduced-motion, low-power fallback, canvas visibility, and nonblank rendering.
- If validation is intentionally limited, state that explicitly.
