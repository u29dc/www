> `www` is the Astro / MDX / raw TypeScript site for Incomplete Infinity / U29DC.

## 1. Documentation

- Primary references: [Astro](https://docs.astro.build/en/getting-started/), [Astro MDX](https://docs.astro.build/en/guides/integrations-guide/mdx/), [Astro content collections](https://docs.astro.build/en/guides/content-collections/), [Vite](https://vite.dev/guide/), [MDX](https://mdxjs.com/), [Tailwind CSS](https://tailwindcss.com/docs), [Cloudflare Workers](https://developers.cloudflare.com/workers/), [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API), [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- Local source-of-truth files: [`package.json`](package.json), [`astro.config.ts`](astro.config.ts), [`wrangler.jsonc`](wrangler.jsonc), [`public/_headers`](public/_headers), [`src/layouts/layout.astro`](src/layouts/layout.astro), [`src/app/app.ts`](src/app/app.ts), [`src/app/runtime/loop.ts`](src/app/runtime/loop.ts), [`src/content.config.ts`](src/content.config.ts)
- Edit [`AGENTS.md`](AGENTS.md) only; [`README.md`](README.md) and [`CLAUDE.md`](CLAUDE.md) are symlinks to it for tool compatibility.

## 2. Repository Structure

```text
.
├── src/
│   ├── pages/              Astro routes, article exports, sitemap, robots, llms.txt
│   ├── layouts/            global document shell and metadata
│   ├── components/         chrome, home, artifacts, MDX, logo, and core UI components
│   ├── content/            authored MDX artifacts
│   ├── data/               site copy, links, marks, and constants
│   ├── app/                browser runtime, lifecycle owners, route bridge, loop, scroll, motion, and WebGL
│   ├── lib/                portable content, media URL, markdown, and build/export utilities
│   └── styles/             tokens, base, layout, prose, preview, and motion CSS
├── public/                 static headers, icons, local fonts, marks, logo, and OG image
├── astro.config.ts         Astro, MDX, Tailwind, GLSL string minification, and Cloudflare adapter config
├── wrangler.jsonc          Cloudflare Worker and asset deployment config
└── AGENTS.md               canonical repo-level agent instructions
```

- Start with [`src/layouts/layout.astro`](src/layouts/layout.astro) for shell, metadata, header persistence, grid guide, route router, and the single browser app import.
- Start with [`src/app/app.ts`](src/app/app.ts), [`src/app/runtime/task.ts`](src/app/runtime/task.ts), and [`src/app/runtime/loop.ts`](src/app/runtime/loop.ts) for browser runtime ownership, task order, and frame-loop behavior.
- Start with [`src/pages/index.astro`](src/pages/index.astro) for homepage composition and [`src/pages/[slug].astro`](src/pages/[slug].astro) for artifact pages.
- Start with [`src/content.config.ts`](src/content.config.ts), [`src/lib/artifacts.ts`](src/lib/artifacts.ts), and [`src/lib/markdown.ts`](src/lib/markdown.ts) for content collection, visibility, sorting, and markdown export behavior.

## 3. Stack

| Layer            | Choice                                | Notes                                                                                                            |
| ---------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Routing / render | Astro static output                   | Cloudflare adapter emits Worker-compatible static assets                                                         |
| Content          | MDX content collections               | authored artifacts in `src/content/*.mdx`                                                                        |
| Styling          | Tailwind CSS v4 + CSS tokens          | inline utilities for component-local styling; shared CSS for tokens, layout, global selectors, and runtime hooks |
| Browser logic    | raw TypeScript runtime in `src/app`   | one app bootstrap, explicit lifecycle owners, and a single shared frame loop                                     |
| Motion / scroll  | Astro route bridge + custom app loop  | no Lenis; keep hot motion transform/opacity-based, native-scroll compatible, and reduced-motion aware            |
| Graphics         | standalone WebGL under `src/app/logo` | keep canvas logic portable outside Astro and routed through the app runtime                                      |
| Deployment       | Cloudflare Workers                    | headers live in `public/_headers`; Worker config lives in `wrangler.jsonc`                                       |

## 4. Commands

- `bun install` - install dependencies and refresh the lockfile.
- `bun run dev` - start Astro locally on `localhost:3000`.
- `bun run build` - build the Astro site.
- `bun run preview` - preview the production build.
- `bun run deploy` - run `bun run util:check`, then deploy with Wrangler.
- `bun run update` - update normal packages, then re-pin Astro, MDX, and the Cloudflare adapter to alpha.
- `bun run util:format` - apply and verify formatting with Oxfmt.
- `bun run util:lint` - lint and auto-fix with Oxlint.
- `bun run util:check` - format, lint-fix, type-check, and build.
- `bun run util:clean` - remove Astro/build caches.

## 5. Architecture

- [`src/layouts/layout.astro`](src/layouts/layout.astro) owns global CSS, metadata, canonical/OG/Twitter tags, font preloads, the persistent header, grid guide, page shell, route router, and the single browser runtime import.
- [`src/pages/index.astro`](src/pages/index.astro) composes the homepage in this order: origin, protocols, artifact studies, artifact fragments, optional signals, connect.
- [`src/pages/[slug].astro`](src/pages/[slug].astro) renders artifact detail pages with article metadata, MDX content, hidden metadata, and connect footer.
- [`src/pages/[slug].md.ts`](src/pages/[slug].md.ts), [`src/pages/[slug].txt.ts`](src/pages/[slug].txt.ts), [`src/pages/llms.txt.ts`](src/pages/llms.txt.ts), [`src/pages/rss.xml.ts`](src/pages/rss.xml.ts), and [`src/pages/feed.json.ts`](src/pages/feed.json.ts) are first-class machine-readable surfaces. Keep them aligned with visible content when copy or MDX behavior changes.
- Runtime behavior uses `data-*` attributes as the contract between Astro markup, CSS, and `src/app/*`. Prefer extending existing hooks over adding framework state.
- [`src/app/app.ts`](src/app/app.ts) is the browser entrypoint. It initializes the Astro route adapter, then starts runtime owners in explicit order: device, route, scroll, motion, lines, media, preview, logo.
- [`src/app/runtime/loop.ts`](src/app/runtime/loop.ts) is the only app-owned `requestAnimationFrame` scheduler. Runtime owners wake it when work exists and sleep when idle.
- [`src/app/runtime/task.ts`](src/app/runtime/task.ts) defines the lifecycle owner contract. Normal owner files should read in this order: imports, types/constants, scoped state, `createTask`, then lifecycle methods `preinit`, `init`, `resize`, `update`, `post`, `dispose`.
- [`src/app/route/astro.ts`](src/app/route/astro.ts) and [`src/app/route/route.ts`](src/app/route/route.ts) isolate Astro transition events from the rest of the runtime. Other owners subscribe to route state instead of importing `astro:transitions/client`.
- [`src/app/motion/tokens.ts`](src/app/motion/tokens.ts) centralizes TypeScript-side motion, preview, media, and line-reveal timing defaults. Keep it aligned with [`src/styles/tokens.css`](src/styles/tokens.css) when CSS motion tokens change.
- [`src/app/scroll/scroll.ts`](src/app/scroll/scroll.ts) owns custom smooth scroll. Do not reintroduce Lenis; keep the model explicit with actual, animated, target, velocity, direction, limit, and native fallback state.
- [`src/app/logo/logo.ts`](src/app/logo/logo.ts), [`src/app/logo/renderer.ts`](src/app/logo/renderer.ts), and [`src/app/logo/webgl.ts`](src/app/logo/webgl.ts) own logo enhancement and WebGL fallback behavior.

Runtime philosophy:

- Every frame must have an owner, reason, and place in the loop.
- Async work may load, decode, play, or fail, but it should report state instead of owning runtime control flow.
- Device capability is policy. Expensive owners should ask the device profile before starting high-cost work.
- CSS transitions are valid when the runtime owns the state change, the transition is transform/opacity-oriented, reduced motion is explicit, and interruption/failure leaves the page usable.
- Keep Astro as the static renderer and route event source, not the center of browser architecture.

## 6. Content and Assets

- MDX frontmatter controls artifact type, date, visibility, thumbnails, hover previews, and export metadata. `isArtifactItem: false` hides an artifact from public listings and exports.
- [`src/lib/markdown.ts`](src/lib/markdown.ts) powers markdown/text exports and first-media extraction. Changes here affect article routes, `llms.txt`, and hover preview defaults.
- Rich origin copy in [`src/components/home/origin.astro`](src/components/home/origin.astro) and plain origin copy in [`src/data/copy.ts`](src/data/copy.ts) should stay semantically aligned.
- Local fonts and mark assets live under [`public/fonts`](public/fonts) and [`public/assets/marks`](public/assets/marks). Article media resolves through the configured media base URL, currently `https://storage.u29dc.com/assets/`.
- This repository is public. Do not add private vault material, client-sensitive detail, secrets, or personal runtime data.

## 7. Conventions

- Keep content portable. Prefer MDX frontmatter and content collections over framework-specific data machinery.
- Keep creative effects portable. Put browser runtime, canvas, WebGL, WebGPU, scroll, preview, and motion logic in `src/app` modules that can survive a future framework migration.
- Keep Astro pages mostly static. Add client JavaScript only for visible interaction, media, graphics, or progressive enhancement.
- Do not reintroduce Svelte, React, Vue, or another UI framework unless a specific interactive component justifies the dependency.
- Do not reintroduce Lenis or another scroll dependency unless a measured, reviewed need beats the custom runtime owner.
- Prefer plain `.astro`, `.mdx`, `.ts`, and CSS files until a heavier abstraction is clearly useful.
- Prefer one-word filenames for runtime owners and helpers where they stay clear: `scroll.ts`, `motion.ts`, `lines.ts`, `media.ts`, `logo.ts`, `route.ts`, `loop.ts`, `task.ts`.
- Keep `src/lib` free of browser runtime ownership. It is for portable content/export utilities, not app lifecycle, frame scheduling, or visual controllers.
- Prefer inline Tailwind utilities for component-local styling. Keep shared CSS for tokens, document defaults, layout primitives, MDX prose, animation selectors, and runtime state selectors.
- Use Lucide icons where an icon is needed. Avoid manually drawn one-off SVGs unless a logo or effect requires custom drawing.

## 8. Constraints

- Treat [`src/styles/layout.css`](src/styles/layout.css), `layout-grid`, `layout-lane`, and `layout-lane-wide` as high blast-radius. They align the header, homepage, article pages, connect footer, and grid guide.
- Treat [`src/app/runtime/loop.ts`](src/app/runtime/loop.ts), [`src/app/runtime/task.ts`](src/app/runtime/task.ts), and [`src/app/runtime/timer.ts`](src/app/runtime/timer.ts) as high blast-radius. They define frame order, lifecycle semantics, wake/sleep behavior, and timer handoff for the whole client runtime.
- Treat [`src/app/scroll/scroll.ts`](src/app/scroll/scroll.ts), [`src/app/scroll/animate.ts`](src/app/scroll/animate.ts), and [`src/app/scroll/virtual.ts`](src/app/scroll/virtual.ts) as performance-sensitive interaction code. Preserve native fallback, reduced-motion behavior, keyboard/bar/route scroll compatibility, and minimal wheel-handler work.
- Treat [`src/app/preview/preview.ts`](src/app/preview/preview.ts), [`src/lib/hover.ts`](src/lib/hover.ts), and [`src/app/lines/lines.ts`](src/app/lines/lines.ts) as performance-sensitive interaction code. Keep pointer work loop-batched and hot writes transform/opacity-oriented.
- Treat [`src/app/logo/logo.ts`](src/app/logo/logo.ts), [`src/app/logo/renderer.ts`](src/app/logo/renderer.ts), and [`src/app/logo/webgl.ts`](src/app/logo/webgl.ts) as fragile visual code. Preserve reduced-motion, low-power fallback, canvas visibility, and nonblank rendering.
- Treat [`public/_headers`](public/_headers), [`wrangler.jsonc`](wrangler.jsonc), and [`astro.config.ts`](astro.config.ts) as deployment/security-sensitive. Run the full quality gate after config changes.
- Do not edit generated output such as `dist/`, `.astro/`, `.wrangler/`, `node_modules/`, or cache directories.

## 9. Validation

- Required gate for code, config, content-export, and dependency changes: `bun run util:check`.
- For dependency or config changes, run `bun install` first when the lockfile may need to change.
- For visual work, run `bun run dev` and verify desktop and mobile browser views before reporting completion.
- For hover previews, page transitions, smooth scroll, and WebGL work, verify client-side navigation as well as first load.
- For WebGL/WebGPU work, verify reduced-motion, low-power fallback, canvas visibility, and nonblank rendering.
- If validation is intentionally limited, state exactly what was not run and the residual risk.
