> `www` is the Astro / MDX / raw TypeScript site for Incomplete Infinity / U29DC.

## 1. Documentation

- Primary references: [Astro](https://docs.astro.build/en/getting-started/), [Astro MDX](https://docs.astro.build/en/guides/integrations-guide/mdx/), [Astro content collections](https://docs.astro.build/en/guides/content-collections/), [Vite](https://vite.dev/guide/), [MDX](https://mdxjs.com/), [Tailwind CSS](https://tailwindcss.com/docs), [Cloudflare Workers](https://developers.cloudflare.com/workers/), [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API), [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- Local source-of-truth files: [`package.json`](package.json), [`astro.config.ts`](astro.config.ts), [`wrangler.jsonc`](wrangler.jsonc), [`wrangler.d.ts`](wrangler.d.ts), [`public/_headers`](public/_headers), [`src/layouts/layout.astro`](src/layouts/layout.astro), [`src/app/app.ts`](src/app/app.ts), [`src/app/core/app.ts`](src/app/core/app.ts), [`src/app/core/module.ts`](src/app/core/module.ts), [`src/content.config.ts`](src/content.config.ts), [`src/lib/seo.ts`](src/lib/seo.ts)
- Edit [`AGENTS.md`](AGENTS.md) only; [`README.md`](README.md) and [`CLAUDE.md`](CLAUDE.md) are symlinks to it for tool compatibility.

## 2. Repository Structure

```text
.
├── src/
│   ├── pages/              Astro routes, article exports, sitemap, robots, llms.txt
│   ├── layouts/            global document shell and metadata
│   ├── components/         chrome, home, artifacts, MDX, logo, and core UI components
│   ├── content/            authored MDX artifacts
│   ├── data/               site copy, links, mark metadata, and constants
│   ├── assets/             imported marks and local font sources
│   ├── app/                browser runtime: core loop, systems, UI owners, graphics, and runtime utilities
│   ├── lib/                portable content, media URL, markdown, and build/export utilities
│   └── styles/             tokens, base, layout, prose, preview, and motion CSS
├── public/                 static headers, icons, logo, and OG image
├── tests/                  runtime regression tests using node:test
├── astro.config.ts         Astro, MDX, Tailwind, GLSL string minification, and Cloudflare adapter config
├── wrangler.jsonc          Cloudflare Worker and asset deployment config
└── AGENTS.md               canonical repo-level agent instructions
```

- Start with [`src/layouts/layout.astro`](src/layouts/layout.astro) for shell, metadata, header persistence, grid guide, route router, and the single browser app import.
- Start with [`src/app/app.ts`](src/app/app.ts), [`src/app/core/app.ts`](src/app/core/app.ts), and [`src/app/core/module.ts`](src/app/core/module.ts) for browser runtime ownership, module order, and frame-loop behavior.
- Start with [`src/pages/index.astro`](src/pages/index.astro) for homepage composition and [`src/pages/[slug].astro`](src/pages/[slug].astro) for artifact pages.
- Start with [`src/content.config.ts`](src/content.config.ts), [`src/lib/artifacts.ts`](src/lib/artifacts.ts), and [`src/lib/markdown.ts`](src/lib/markdown.ts) for content collection, visibility, sorting, and markdown export behavior.

## 3. Stack

| Layer            | Choice                                    | Notes                                                                                                            |
| ---------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Routing / render | Astro static output                       | Cloudflare adapter emits Worker-compatible static assets                                                         |
| Content          | MDX content collections                   | authored artifacts in `src/content/*.mdx`                                                                        |
| Styling          | Tailwind CSS v4 + CSS tokens              | inline utilities for component-local styling; shared CSS for tokens, layout, global selectors, and runtime hooks |
| Browser logic    | raw TypeScript runtime in `src/app`       | one app bootstrap, explicit lifecycle owners, and a single shared frame loop                                     |
| Motion / scroll  | Astro route bridge + custom app loop      | custom scroll owner; keep hot motion transform/opacity-based, native-scroll compatible, and reduced-motion aware |
| Graphics         | standalone WebGL under `src/app/graphics` | keep canvas logic portable outside Astro and routed through the app runtime                                      |
| Deployment       | Cloudflare Workers                        | headers live in `public/_headers`; Worker config lives in `wrangler.jsonc`                                       |

## 4. Commands

- Toolchain: Bun `1.4.2` via `packageManager`; supported engines require Bun `>=1.4.2` and Node `>=22.22.1`.
- `bun install` - install dependencies and refresh the lockfile.
- `bun run dev` - start Astro locally on `localhost:3000`.
- `bun run build` - build and minify the Astro site, then validate generated output and article export headers.
- `bun run preview` - preview the production build.
- `bun run test` - run the regression suite with Bun's runner and the portable `node:test` API.
- `bun run deploy` - run `bun run util:check`, then deploy with Wrangler.
- `bun run cf:deploy:dry` - run the full quality gate, then run a Wrangler dry-run deploy.
- `bun run cf:dev` - build and run the Cloudflare Worker locally with Wrangler.
- `bun run cf:types` - regenerate [`wrangler.d.ts`](wrangler.d.ts) from [`wrangler.jsonc`](wrangler.jsonc).
- `bun run cf:types:check` - verify generated Cloudflare types are current.
- `bun run astro:check` - run Astro diagnostics.
- `bun run util:fix` - apply formatting and lint auto-fixes.
- `bun run util:format` - apply and verify formatting with Oxfmt.
- `bun run util:format:check` - verify formatting without writing files.
- `bun run util:lint` - lint and auto-fix with Oxlint.
- `bun run util:lint:check` - lint without writing files.
- `bun run util:types` - run Astro diagnostics plus script, test, Cloudflare, and generated Worker type checks.
- `bun run util:output` - validate generated page/export invariants and write exact noindex header rules for article Markdown/text exports.
- `bun run util:check` - verify formatting, lint, types, regression tests, and build without writing source files.
- `bun run util:clean` - remove Astro/build caches.

## 5. Architecture

- [`src/layouts/layout.astro`](src/layouts/layout.astro) owns global CSS, metadata, canonical/OG/Twitter tags, font preloads, the persistent header, grid guide, page shell, route router, and the single browser runtime import.
- [`src/pages/index.astro`](src/pages/index.astro) composes the homepage in this order: origin, artifact studies, artifact fragments, optional signals, connect.
- [`src/pages/[slug].astro`](src/pages/[slug].astro) renders artifact detail pages with article metadata, MDX content, hidden metadata, and connect footer.
- [`src/pages/[slug].md.ts`](src/pages/[slug].md.ts), [`src/pages/[slug].txt.ts`](src/pages/[slug].txt.ts), [`src/pages/llms.txt.ts`](src/pages/llms.txt.ts), [`src/pages/rss.xml.ts`](src/pages/rss.xml.ts), and [`src/pages/feed.json.ts`](src/pages/feed.json.ts) are first-class machine-readable surfaces. Keep them aligned with visible content when copy or MDX behavior changes.
- [`src/lib/seo.ts`](src/lib/seo.ts) centralizes site-local path validation, absolute URL construction, XML escaping, feed sorting, and fallback feed dates for generated routes.
- Runtime behavior uses `data-*` attributes as the contract between Astro markup, CSS, and `src/app/*`. Extend the existing hook contract for new runtime state.
- [`src/app/app.ts`](src/app/app.ts) is the browser composition root. It starts systems first (`device`, `theme`, `route`, `input`, `scroll`, `motion`) and UI owners second (`lines`, `media`, `preview`, `logo`).
- [`src/app/core/app.ts`](src/app/core/app.ts) is the only app-owned `requestAnimationFrame` scheduler. Runtime modules request frames through context and return `true` from `update()` only while they need continuous work; frame callbacks must be isolated so one owner cannot leave the loop in a stuck ticking state.
- `window.wwwRuntimeDiagnostics()` returns a bounded, in-memory runtime snapshot for debugging: owner/phase/error-category counts, frame positions, and pending callback count. It excludes error messages, stacks, URLs, DOM content, and user data; it sends and persists nothing.
- [`src/app/core/module.ts`](src/app/core/module.ts) defines the lifecycle module contract. Owner files should read in this order: imports, types/constants, class fields, lifecycle methods `preinit`, `init`, `refresh`, `resize`, `update`, `dispose`, then private helpers and exports.
- [`src/app/core/state.ts`](src/app/core/state.ts) owns stable cross-owner state types so `core` does not import downstream systems or UI.
- [`src/app/core/tokens.ts`](src/app/core/tokens.ts) centralizes TypeScript-side motion, preview, media, and line-reveal timing defaults. Keep it aligned with [`src/styles/tokens.css`](src/styles/tokens.css) when CSS motion tokens change.
- [`src/app/systems/input.ts`](src/app/systems/input.ts) owns global browser input listeners and exposes frame input state plus cancellable pointer/wheel/click intents. It also releases active input on blur, pagehide, and hidden visibility states.
- [`src/app/systems/route.ts`](src/app/systems/route.ts) owns route state and the Astro transition bridge. Other owners subscribe to route state instead of importing `astro:transitions/client`; route transitions carry IDs so stale transition work can be ignored.
- [`src/app/systems/theme.ts`](src/app/systems/theme.ts) owns runtime theme/color-scheme state and subscriptions.
- [`src/app/systems/scroll.ts`](src/app/systems/scroll.ts) owns custom smooth scroll. Keep the model explicit with actual, animated, target, velocity, direction, limit, and native fallback state.
- [`src/app/ui/lines.ts`](src/app/ui/lines.ts), [`src/app/ui/media.ts`](src/app/ui/media.ts), [`src/app/ui/preview.ts`](src/app/ui/preview.ts), and [`src/app/ui/logo.ts`](src/app/ui/logo.ts) own DOM enhancement behavior.
- [`src/app/graphics/canvas.ts`](src/app/graphics/canvas.ts) owns logo canvas/WebGL rendering, diagnostics, and fallback safety. It must use the shared core loop, not a second RAF loop.

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
- Local font sources live under [`src/assets/fonts`](src/assets/fonts); CSS and layout imports produce fingerprinted asset URLs. Tiny link marks live flat under [`src/assets`](src/assets) and are imported inline by [`src/data/marks.ts`](src/data/marks.ts). Article media resolves through the configured media base URL, currently `https://storage.u29dc.com/assets/`.
- This repository is public. Keep private vault material, client-sensitive detail, secrets, and personal runtime data in private systems outside the repo.

## 7. Conventions

- Keep content portable. Prefer MDX frontmatter and content collections over framework-specific data machinery.
- Keep creative effects portable. Put browser runtime, canvas, WebGL, WebGPU, scroll, preview, and motion logic in `src/app` modules that can survive a future framework migration.
- Keep Astro pages mostly static. Client JavaScript belongs to visible interaction, media, graphics, and progressive enhancement paths.
- The browser experience is an Astro-rendered document plus raw TypeScript owners under `src/app`; route, scroll, motion, preview, media, and graphics behavior should fit that ownership model.
- Prefer plain `.astro`, `.mdx`, `.ts`, and CSS files until a heavier abstraction is clearly useful.
- Prefer one-word filenames for runtime owners and helpers where they stay clear: `app.ts`, `module.ts`, `input.ts`, `theme.ts`, `scroll.ts`, `motion.ts`, `lines.ts`, `media.ts`, `logo.ts`, `route.ts`, `canvas.ts`.
- Keep `src/app` import direction simple: `app -> core/systems/ui`, `core -> core/utils`, `systems -> core/utils` with acyclic peer-system dependencies, `ui -> core/systems/graphics/utils` with local UI helpers such as `measure`, `graphics -> core/utils`, and `utils -> no app owners`. Core never imports systems or UI.
- Keep `src/lib` free of browser runtime ownership. It is for portable content/export utilities, not app lifecycle, frame scheduling, or visual controllers.
- Prefer inline Tailwind utilities for component-local styling. Keep shared CSS for tokens, document defaults, layout primitives, MDX prose, animation selectors, and runtime state selectors.
- Use Lucide icons for standard interface icons. Reserve custom drawing for logos, graphics, and bespoke visual effects.

## 8. Constraints

- Treat [`src/styles/layout.css`](src/styles/layout.css), `layout-grid`, `layout-lane`, and `layout-lane-wide` as high blast-radius. They align the header, homepage, article pages, connect footer, and grid guide.
- Treat [`src/app/core/app.ts`](src/app/core/app.ts), [`src/app/core/module.ts`](src/app/core/module.ts), and [`src/app/core/timer.ts`](src/app/core/timer.ts) as high blast-radius. They define frame order, lifecycle semantics, request-frame behavior, and timer handoff for the whole client runtime.
- Treat [`src/app/systems/scroll.ts`](src/app/systems/scroll.ts) as performance-sensitive interaction code. Preserve native fallback, reduced-motion behavior, keyboard/bar/route scroll compatibility, and minimal wheel-handler work.
- Treat [`src/app/ui/preview.ts`](src/app/ui/preview.ts), [`src/lib/hover.ts`](src/lib/hover.ts), and [`src/app/ui/lines.ts`](src/app/ui/lines.ts) as performance-sensitive interaction code. Keep pointer work loop-batched and hot writes transform/opacity-oriented.
- Treat [`src/app/ui/logo.ts`](src/app/ui/logo.ts) and [`src/app/graphics/canvas.ts`](src/app/graphics/canvas.ts) as fragile visual code. Preserve reduced-motion, low-power fallback, canvas visibility, and nonblank rendering.
- Treat [`public/_headers`](public/_headers), [`wrangler.jsonc`](wrangler.jsonc), and [`astro.config.ts`](astro.config.ts) as deployment/security-sensitive. Run the full quality gate after config changes.
- Generated output such as `dist/`, `.astro/`, `.wrangler/`, `node_modules/`, and cache directories is regenerated from source.

## 9. Validation

- Required gate for code, config, content-export, and dependency changes: `bun run util:check`.
- Runtime regressions belong in [`tests`](tests), with build/output checks beside their build scripts. Preserve deterministic lifecycle, cancellation, failure isolation, and fallback coverage; browser checks still verify layout and actual interaction behavior.
- For dependency or config changes, run `bun install` first when the lockfile may need to change.
- For visual work, run `bun run dev` and verify desktop and mobile browser views before reporting completion.
- For hover previews, page transitions, smooth scroll, and WebGL work, verify client-side navigation as well as first load.
- For WebGL/WebGPU work, verify reduced-motion, low-power fallback, canvas visibility, and nonblank rendering.
- If validation is intentionally limited, state exactly what was not run and the residual risk.
