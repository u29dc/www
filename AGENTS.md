> `www` is the Astro / MDX / raw TypeScript site for Incomplete Infinity / U29DC.

## 1. Documentation

- Primary references: [Astro](https://docs.astro.build/en/getting-started/), [Astro MDX](https://docs.astro.build/en/guides/integrations-guide/mdx/), [Astro content collections](https://docs.astro.build/en/guides/content-collections/), [Vite](https://vite.dev/guide/), [MDX](https://mdxjs.com/), [Tailwind CSS](https://tailwindcss.com/docs), [Cloudflare Workers](https://developers.cloudflare.com/workers/), [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API), [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- Local source-of-truth files: [`package.json`](package.json), [`astro.config.mjs`](astro.config.mjs), [`wrangler.jsonc`](wrangler.jsonc), [`public/_headers`](public/_headers), [`src/layouts/SiteLayout.astro`](src/layouts/SiteLayout.astro), [`src/content.config.ts`](src/content.config.ts)
- Edit [`AGENTS.md`](AGENTS.md) only; [`README.md`](README.md) and [`CLAUDE.md`](CLAUDE.md) are symlinks to it for tool compatibility.
- Do not push from this repo. Commits, when requested, are local-only unless Han gives explicit later approval to publish.

## 2. Repository Structure

```text
.
├── src/
│   ├── pages/              Astro routes, article exports, sitemap, robots, llms.txt
│   ├── layouts/            global document shell and metadata
│   ├── components/         chrome, home, artifacts, MDX, logo, and core UI components
│   ├── content/            authored MDX artifacts
│   ├── data/               site copy, links, marks, and constants
│   ├── features/           browser-only enhancement modules
│   ├── lib/                portable content, media, RAF, WebGL, and markdown utilities
│   └── styles/             tokens, base, layout, prose, preview, and motion CSS
├── public/                 static headers, icons, local fonts, marks, logo, and OG image
├── astro.config.mjs        Astro, MDX, Tailwind, and Cloudflare adapter config
├── wrangler.jsonc          Cloudflare Worker and asset deployment config
└── AGENTS.md               canonical repo-level agent instructions
```

- Start with [`src/layouts/SiteLayout.astro`](src/layouts/SiteLayout.astro) for shell, metadata, header persistence, and client feature imports.
- Start with [`src/pages/index.astro`](src/pages/index.astro) for homepage composition and [`src/pages/[slug].astro`](src/pages/[slug].astro) for artifact pages.
- Start with [`src/content.config.ts`](src/content.config.ts), [`src/lib/artifacts.ts`](src/lib/artifacts.ts), and [`src/lib/markdown.ts`](src/lib/markdown.ts) for content collection, visibility, sorting, and markdown export behavior.

## 3. Stack

| Layer            | Choice                                 | Notes                                                                                                            |
| ---------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Routing / render | Astro static output                    | Cloudflare adapter emits Worker-compatible static assets                                                         |
| Content          | MDX content collections                | authored artifacts in `src/content/*.mdx`                                                                        |
| Styling          | Tailwind CSS v4 + CSS tokens           | inline utilities for component-local styling; shared CSS for tokens, layout, global selectors, and runtime hooks |
| Browser logic    | raw TypeScript modules                 | imported once from `SiteLayout.astro` and reinitialized around Astro swaps                                       |
| Motion / scroll  | Astro transitions + shared RAF + Lenis | keep motion transform/opacity-based and reduced-motion aware                                                     |
| Graphics         | standalone WebGL utilities             | keep canvas logic portable outside Astro                                                                         |
| Deployment       | Cloudflare Workers                     | headers live in `public/_headers`; Worker config lives in `wrangler.jsonc`                                       |

## 4. Commands

- `bun install` - install dependencies and refresh the lockfile.
- `bun run dev` - start Astro locally on `localhost:3000`.
- `bun run build` - build the Astro site.
- `bun run preview` - preview the production build.
- `bun run update` - update normal packages, then re-pin Astro, MDX, and the Cloudflare adapter to alpha.
- `bun run util:format` - apply and verify formatting with Oxfmt.
- `bun run util:lint` - lint and auto-fix with Oxlint.
- `bun run util:check` - format, lint-fix, type-check, and build.
- `bun run util:clean` - remove Astro/build caches.

## 5. Architecture

- [`src/layouts/SiteLayout.astro`](src/layouts/SiteLayout.astro) owns global CSS, metadata, canonical/OG/Twitter tags, font preloads, the persistent header, grid guide, page shell, Astro client router, and browser feature imports.
- [`src/pages/index.astro`](src/pages/index.astro) composes the homepage in this order: origin, protocols, artifact studies, artifact fragments, optional signals, connect.
- [`src/pages/[slug].astro`](src/pages/[slug].astro) renders artifact detail pages with article metadata, copy-markdown controls, MDX content, hidden metadata, and connect footer.
- [`src/pages/[slug].md.ts`](src/pages/[slug].md.ts), [`src/pages/[slug].txt.ts`](src/pages/[slug].txt.ts), and [`src/pages/llms.txt.ts`](src/pages/llms.txt.ts) are first-class machine-readable surfaces. Keep them aligned with visible content when copy or MDX behavior changes.
- Runtime behavior uses `data-*` attributes as the contract between Astro markup, CSS, and `src/features/*`. Prefer extending existing hooks over adding framework state.

## 6. Content and Assets

- MDX frontmatter controls artifact type, date, visibility, thumbnails, hover previews, and export metadata. `isArtifactItem: false` hides an artifact from public listings and exports.
- [`src/lib/markdown.ts`](src/lib/markdown.ts) powers markdown/text exports and first-media extraction. Changes here affect article routes, `llms.txt`, copy buttons, and hover preview defaults.
- Rich origin copy in [`src/components/home/origin.astro`](src/components/home/origin.astro) and plain origin copy in [`src/data/copy.ts`](src/data/copy.ts) should stay semantically aligned.
- Local fonts and mark assets live under [`public/fonts`](public/fonts) and [`public/assets/marks`](public/assets/marks). Article media resolves through the configured media base URL, currently `https://storage.u29dc.com/media/`.
- This repository is public. Do not add private vault material, client-sensitive detail, secrets, or personal runtime data.

## 7. Conventions

- Keep content portable. Prefer MDX frontmatter and content collections over framework-specific data machinery.
- Keep creative effects portable. Put canvas/WebGL/WebGPU logic in standalone TypeScript modules that can survive a future framework migration.
- Keep Astro pages mostly static. Add client JavaScript only for visible interaction, media, graphics, or progressive enhancement.
- Do not reintroduce Svelte, React, Vue, or another UI framework unless a specific interactive component justifies the dependency.
- Prefer plain `.astro`, `.mdx`, `.ts`, and CSS files until a heavier abstraction is clearly useful.
- Prefer inline Tailwind utilities for component-local styling. Keep shared CSS for tokens, document defaults, layout primitives, MDX prose, animation selectors, and runtime state selectors.
- Use Lucide icons where an icon is needed. Avoid manually drawn one-off SVGs unless a logo or effect requires custom drawing.

## 8. Constraints

- Treat [`src/styles/layout.css`](src/styles/layout.css), `layout-grid`, `layout-lane`, and `layout-lane-wide` as high blast-radius. They align the header, homepage, article pages, connect footer, and grid guide.
- Treat [`src/lib/logo.ts`](src/lib/logo.ts), [`src/features/logo.ts`](src/features/logo.ts), and [`src/lib/webgl.ts`](src/lib/webgl.ts) as fragile visual code. Preserve reduced-motion, low-power fallback, canvas visibility, and nonblank rendering.
- Treat [`src/features/preview.ts`](src/features/preview.ts), [`src/lib/hover-preview.ts`](src/lib/hover-preview.ts), and [`src/lib/raf.ts`](src/lib/raf.ts) as performance-sensitive interaction code. Keep pointer work RAF-batched and transform/opacity-only.
- Treat [`public/_headers`](public/_headers), [`wrangler.jsonc`](wrangler.jsonc), and [`astro.config.mjs`](astro.config.mjs) as deployment/security-sensitive. Run the full quality gate after config changes.
- Do not edit generated output such as `dist/`, `.astro/`, `.wrangler/`, `node_modules/`, or cache directories.

## 9. Validation

- Required gate for code, config, content-export, and dependency changes: `bun run util:check`.
- For dependency or config changes, run `bun install` first when the lockfile may need to change.
- For visual work, run `bun run dev` and verify desktop and mobile browser views before reporting completion.
- For hover previews, page transitions, smooth scroll, and WebGL work, verify client-side navigation as well as first load.
- For WebGL/WebGPU work, verify reduced-motion, low-power fallback, canvas visibility, and nonblank rendering.
- If validation is intentionally limited, state exactly what was not run and the residual risk.
