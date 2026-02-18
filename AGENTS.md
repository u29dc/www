## 1. Documentation

- **Framework**: [`svelte.dev/llms.txt`](https://svelte.dev/llms.txt), [`svelte.dev/docs`](https://svelte.dev/docs), [`kit.svelte.dev/docs`](https://kit.svelte.dev/docs), MCP via `mcp__svelte__*`
- **UI**: [`tailwindcss.com/docs`](https://tailwindcss.com/docs)
- **Bundler**: [`vite.dev/guide.md`](https://vite.dev/guide.md), [`vite.dev/config.md`](https://vite.dev/config.md), [`vite.dev/plugins.md`](https://vite.dev/plugins.md)
- **DevTools**: [`bun.sh/docs/llms.txt`](https://bun.sh/docs/llms.txt), [`biomejs.dev`](https://biomejs.dev), [`mdsvex.com/docs`](https://mdsvex.com/docs)

## 2. Repository Structure

```
.
├── src
│   ├── app.css
│   ├── app.html
│   ├── content/                  # MDX content files
│   ├── hooks.server.ts
│   ├── lib/
│   │   ├── components/
│   │   │   ├── atomic/           # AtomicBrandLogo, AtomicGradientBlur, AtomicHeaderButton
│   │   │   ├── core/             # CoreHeader, CoreLoader, CorePageTransition, CoreScrollLine, CoreScrollProgress, CoreSmoothScroll, CoreGrainOverlay, CoreViewportFix
│   │   │   ├── mdx/              # MdxMedia, MdxMediaItem, MdxMediaEnhancer, MdxParagraph, MdxQuote, MdxSpacer, mdx-context.ts
│   │   │   └── sections/         # Hero, Signal, Protocols, Artifacts, Origin, Threshold
│   │   ├── server/
│   │   │   ├── content.ts        # MDX parsing with unified pipeline
│   │   │   ├── errors.ts         # API/raw response error helpers
│   │   │   ├── logger.ts         # Server-side Pino logging
│   │   │   ├── metadata.ts       # Meta tag generation
│   │   │   ├── mdx-modules.ts    # MDX module exports
│   │   │   ├── raw.ts            # Raw response handlers
│   │   │   └── validators.ts     # Zod input validation
│   │   ├── constants.ts          # Site config, CDN URLs
│   │   ├── content-types.ts      # Zod schemas (study|fragment|signal|meta)
│   │   ├── errors.ts
│   │   ├── loader.svelte.ts      # Loader state store (Svelte 5 runes)
│   │   ├── logger.ts             # Client-side logger stub (dev console only)
│   │   ├── motion.ts             # Animation constants (parallax, thresholds, magnetic)
│   │   ├── observe.ts            # IntersectionObserver utilities
│   │   ├── raf.ts                # RAF task coordination
│   │   ├── scroll.ts             # Lenis scroll utilities
│   │   ├── scrollline.svelte.ts  # Shared scroll-line state store
│   │   ├── springs.ts            # Spring physics presets
│   │   ├── transition.ts         # Page transition timing
│   │   └── webgl.ts              # WebGL device tier detection
│   ├── routes/
│   │   ├── +error.svelte
│   │   ├── +page.svelte
│   │   ├── +page.server.ts
│   │   ├── +layout.svelte
│   │   ├── +layout.server.ts
│   │   ├── [slug]/
│   │   ├── [slug].md/
│   │   ├── [slug].txt/
│   │   ├── api/
│   │   ├── manifest.json/
│   │   ├── robots.txt/
│   │   └── sitemap.xml/
│   └── styles/
├── static/
│   ├── fonts/
│   └── textures/
├── biome.json
├── commitlint.config.js
├── lint-staged.config.js
├── package.json
├── svelte.config.js
├── tsconfig.json
├── tsconfig.svelte.json
└── vite.config.ts
```

## 3. Stack

| Layer      | Choice                 | Notes                                                              |
| ---------- | ---------------------- | ------------------------------------------------------------------ |
| Framework  | SvelteKit 2            | Svelte 5 runes, prefer runes over stores                           |
| Bundler    | Vite 7                 | Via @sveltejs/vite-plugin-svelte                                   |
| Styling    | Tailwind CSS 4         | Class order sorted per Biome useSortedClasses                      |
| Content    | MDsveX                 | MDX in `src/content/`, Zod schemas in `content-types.ts`           |
| Runtime    | Bun                    | Package manager and script runner                                  |
| Linting    | Biome                  | Format + lint, replaces ESLint/Prettier                            |
| Types      | tsgo + svelte-check-rs | Triple-layer type checking (tsgo, svelte-check-rs, zvelte-check)   |
| Animation  | Lenis                  | Smooth scroll, RAF coordination in `raf.ts`                        |
| Logging    | Pino + client stub     | Pino server logger, browser-safe dev logger in `src/lib/logger.ts` |
| Validation | Zod                    | Content schemas, input validation                                  |
| Deployment | Cloudflare             | Via @sveltejs/adapter-cloudflare                                   |

## 4. Commands

- `bun run dev` - Start dev server
- `bun run build` - Production build
- `bun run preview` - Preview build
- `bun run util:check` - Format, lint, types (5-stage: format, lint, tsgo, svelte-check-rs, zvelte-check)
- `bun run util:lint:fix` - Auto-fix lint
- `bun run util:types` - Typecheck (svelte-kit sync + tsgo)
- `bun run util:types:svelte` - Svelte-specific types (svelte-check-rs)
- `bun run util:types:zvelte` - Zvelte checker
- `bun run util:clean` - Remove build and cache outputs

## 5. Architecture

- Page shells in `src/routes`, slug pages in `src/routes/[slug]`, raw endpoints in `src/routes/[slug].md`, `src/routes/[slug].txt`, and `src/routes/api/raw/[format]/[slug]`
- Site and CDN configuration in `src/lib/constants.ts`, logging in `src/lib/logger.ts`, error helpers in `src/lib/errors.ts`
- Global styles in `src/app.css` and `src/styles/*`, fonts in `src/styles/fonts.css`, static files under `static/`, media URLs from `CDN` in `src/lib/constants.ts`
- **Content types**: 4 discriminated types in `content-types.ts` (study for client work, fragment for written pieces, signal for external links, meta for metadata pages) with Zod validation
- **Animation system**: Centralized RAF task coordination in `raf.ts`, Lenis smooth scroll in `scroll.ts`, page transitions (400ms in/out) in `transition.ts`
- **Agent detection**: `hooks.server.ts` detects agent/curl UAs plus text-preferring requests and redirects to plain text endpoints (with crawler allowlist)
- **Observation system**: Visibility detection, active section tracking, and staggered reveals via IntersectionObserver utilities in `observe.ts`
- **Device optimization**: WebGL tier detection in `webgl.ts` manages GPU load (grain overlay, DPR capping) based on device capabilities
- **Loader and line state**: Initial page loader uses runes store in `loader.svelte.ts`; scroll-line cross-component state lives in `scrollline.svelte.ts`
- **Motion constants**: Centralized parallax factors, scroll thresholds, and magnetic cursor parameters in `motion.ts`
- **Spring physics**: Configurable spring presets (SPRING_UI, SPRING_PARALLAX) in `springs.ts`

## 6. Conventions

- Use aliases `$lib`, `$app`, and `@` for app code; allow same-directory relative imports for generated route `$types` and local styles
- TypeScript strict mode, no `any`, no ad-hoc `console` outside intentional logger stubs
- No emojis in code, docs, or commits
- **Component naming**: Prefix matches directory (Atomic*, Core*, Mdx\*, section names unprefixed)
- **Animation**: 400ms page transitions, spring physics via presets in `springs.ts` (SPRING_PARALLAX: stiffness 25, damping 12), motion constants in `motion.ts`, respect `prefers-reduced-motion`, transform/opacity only, will-change managed dynamically
- **Security**: Preserve CSP nonce generation and `<script>` nonce injection in `src/hooks.server.ts`, keep `csp-nonce` meta and `/empty.js` nonce script in `src/routes/+layout.svelte` with `src/routes/+layout.server.ts` data
- **Headers**: Security headers (HSTS, permissions-policy, x-frame-options, referrer-policy) set in `src/hooks.server.ts`, do not weaken; 404 redirect rules for non-file paths live in `src/hooks.server.ts`
- **Raw responses**: Raw text and markdown responses must keep `X-Robots-Tag: noindex` and cache headers in `src/lib/server/raw.ts`

## 7. Quality

- No automated tests; manual QA required
- Run `bun run dev` and load the home page; verify animations, overlays, page transitions, and theme with no console errors
- Visit a content page like `/patterns`; verify scroll CTA, overlays, and metadata
- Request `/llms.txt` and one slug `.md` or `.txt`; confirm raw output, headers, and artifact injection
- Test agent detection: `curl -A "ClaudeBot" https://u29dc.com/` should redirect to plain text
- Check the head for `csp-nonce` and confirm `/empty.js` and inline scripts receive the nonce; verify permissions-policy and HSTS headers
- Finish with `bun run util:check` (must pass all 5 stages)
- Commits: Conventional Commits format `type(scope): description` with body required; types [feat|fix|refactor|docs|style|chore|test|build|ci|perf|revert], scopes [core|ui|api|config|deps|types|utils|docs|ci|release]
