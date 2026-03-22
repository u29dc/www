> `www` is a SvelteKit 2 / Cloudflare site for U29DC that serves the Incomplete Infinity homepage, prerendered MDX artifact pages, LLM-oriented raw exports, newsletter signup, and generated OG image routes.

## 1. Documentation

- Primary references: [Svelte](https://svelte.dev/llms.txt), [SvelteKit](https://kit.svelte.dev/docs), [Tailwind CSS](https://tailwindcss.com/docs), [Vite](https://vite.dev/guide.md), [mdsvex](https://mdsvex.com/docs)
- Local source-of-truth files: [`src/hooks.server.ts`](src/hooks.server.ts), [`src/lib/server/content.ts`](src/lib/server/content.ts), [`src/lib/server/raw.ts`](src/lib/server/raw.ts), [`src/lib/server/og.ts`](src/lib/server/og.ts), [`src/lib/components/sections/Threshold.svelte`](src/lib/components/sections/Threshold.svelte), [`src/app.d.ts`](src/app.d.ts)
- Edit [`AGENTS.md`](AGENTS.md) only; [`README.md`](README.md) and [`CLAUDE.md`](CLAUDE.md) are symlinks to it

## 2. Repository Structure

```text
.
├── src/
│   ├── content/               MDX artifacts plus `llms.mdx`
│   ├── lib/components/        atomic, core, MDX, and section UI
│   ├── lib/server/            content parsing, raw export, metadata, OG, newsletter
│   └── routes/                home, slug pages, raw endpoints, OG, newsletter, robots/sitemap/manifest
├── static/                    self-hosted fonts, icons, blue-noise texture, `empty.js`
├── migrations/                Cloudflare D1 schema
├── scripts/                   validation helpers (`check-og.ts`)
├── _headers                   deployed cache rules for OG images
└── AGENTS.md                  canonical repo instructions
```

- Start in [`src/lib/server/content.ts`](src/lib/server/content.ts) and [`src/routes/`](src/routes/) for behavior changes; most data flow passes through them
- Treat [`src/content/`](src/content/) frontmatter as the metadata source of truth; homepage cards, raw exports, sitemap entries, and OG routes all derive from it
- Treat `.svelte-kit/`, `build/`, and `node_modules/.vite/` as generated output. Regenerate or clean; never edit generated files by hand

## 3. Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Runtime | Bun + SvelteKit 2 + Cloudflare adapter | prerendered HTML/OG plus Workers-compatible handlers |
| Content | MDsveX `.mdx` + `gray-matter` + `zod` | raw imports via `import.meta.glob`, validated by [`src/lib/content-types.ts`](src/lib/content-types.ts) |
| Styling | Tailwind CSS 4 + [`src/app.css`](src/app.css) | custom tokens, self-hosted fonts, light/dark theme bootstrap |
| Media / OG | CDN-backed media + `sharp` + `satori` + `@resvg/resvg-js` | home and per-artifact `og.png` routes |
| Motion | Lenis + custom RAF + WebGL overlays | progressive enhancement on top of readable static content |
| Validation | Biome + `tsgo` + `svelte-check-rs` + `zvelte-check` + OG smoke script | bundled in `bun run util:check` |
| Persistence | Cloudflare D1 | optional newsletter storage only |

## 4. Commands

- `bun install` - install dependencies and husky hooks
- `bun run dev` - sync SvelteKit and start the local dev server on port `3000`
- `bun run build` - sync, prerender pages and OG images, and build Cloudflare output
- `bun run preview` - preview the production build locally
- `bun run util:check` - full gate: runs `biome format --write` first, then lint, `tsgo`, `svelte-check-rs`, `zvelte-check`, and the OG generation smoke test
- `bun run util:og` - validate home and public artifact OG generation only
- `bun run util:clean` - remove `.svelte-kit`, `build`, `.wrangler`, `.vite`, and `*.tsbuildinfo`

## 5. Architecture

- [`src/content/`](src/content/) is the content source of truth. [`src/lib/server/content.ts`](src/lib/server/content.ts) imports raw MDX, validates frontmatter, strips scripts/imports for raw output, renders custom `Mdx*` tags into HTML placeholders, and extracts media for cards
- Artifact visibility is a shared contract: `isArtifactItem` opts content into the artifact system, `slug === 'llms'` is a special meta document, and `study.isConfidential` removes pages/raw access/sitemap/OG while still allowing a title-only placeholder on the homepage
- [`src/routes/[slug]/+page.server.ts`](src/routes/[slug]/+page.server.ts) and [`src/routes/[slug]/og.png/+server.ts`](src/routes/[slug]/og.png/+server.ts) are `prerender = true` with `entries()` from [`src/lib/server/artifacts.ts`](src/lib/server/artifacts.ts). Public visibility must survive `validateSlug()` and `isPublicArtifact()`
- [`src/routes/[slug].md/+server.ts`](src/routes/[slug].md/+server.ts), [`src/routes/[slug].txt/+server.ts`](src/routes/[slug].txt/+server.ts), and [`src/routes/api/raw/[format]/[slug]/+server.ts`](src/routes/api/raw/[format]/[slug]/+server.ts) all delegate to [`src/lib/server/raw.ts`](src/lib/server/raw.ts); `llms` injects live artifact summaries into `[ARTIFACTS]` and appends the sitemap link
- [`src/hooks.server.ts`](src/hooks.server.ts) owns request IDs, CSP nonce creation, inline-script nonce injection, security headers, alternate raw `Link` headers, agent redirect classification, and the non-file `404 -> /` redirect
- Theme setup is split between [`src/app.html`](src/app.html) for pre-hydration paint and [`src/lib/theme.svelte.ts`](src/lib/theme.svelte.ts) for runtime sync. Keep the storage key and theme colors aligned in both places
- [`src/lib/components/core/CoreGrainOverlay.svelte`](src/lib/components/core/CoreGrainOverlay.svelte) and [`src/lib/components/atomic/AtomicBrandLogo.svelte`](src/lib/components/atomic/AtomicBrandLogo.svelte) are the heaviest client paths. They depend on [`src/lib/webgl.ts`](src/lib/webgl.ts) policy, diagnostics, and fallback behavior

## 6. Runtime and State

- Cloudflare binding: [`src/app.d.ts`](src/app.d.ts) declares optional `platform.env.NEWSLETTER_DB`. Without it, `/api/newsletter` returns `503` with code `UNAVAILABLE`
- Runtime envs from [`src/hooks.server.ts`](src/hooks.server.ts): `AGENT_REDIRECT_MODE` (`off`, `shadow`, `enforce` and truthy aliases) and `AGENT_REDIRECT_DEBUG` (adds `x-agent-*` decision headers)
- Public browser envs from [`src/lib/webgl.ts`](src/lib/webgl.ts): `PUBLIC_WEBGL_OVERLAY_MODE`, `PUBLIC_WEBGL_OVERLAY_RISK_THRESHOLD`, `PUBLIC_WEBGL_OVERLAY_WARMUP_MS`, `PUBLIC_WEBGL_OVERLAY_LONG_FRAME_MS`, `PUBLIC_WEBGL_OVERLAY_WARMUP_MAX_LONG_FRAMES`, `PUBLIC_WEBGL_OVERLAY_FAIL_TTL_HOURS`
- Build identity: `PUBLIC_COMMIT_SHA` or `COMMIT_SHA` feeds [`src/lib/constants.ts`](src/lib/constants.ts); the short SHA namespaces WebGL cooldown and diagnostics in localStorage
- Client persistence: theme preference lives under `u29dc-theme-preference`; WebGL overlay cooldown and diagnostic records are also stored in localStorage and scoped by build SHA
- Generated output is disposable: `.svelte-kit/`, `build/`, prerendered `*.html`, and prerendered `*/og.png` artifacts are rebuilt, not edited. [`_headers`](_headers) controls deployed cache TTL for `/og.png` and `/*/og.png`

## 7. Conventions

- Add or rename MDX components only if you update both `renderContentHtml()` and `toMarkdownBody()` in [`src/lib/server/content.ts`](src/lib/server/content.ts); raw exports and HTML rendering intentionally share the same custom tag surface
- Keep route handlers thin. Validation, serialization, metadata, OG generation, and newsletter persistence live under [`src/lib/server/`](src/lib/server/)
- Use lowercase hyphenated slugs only. [`src/lib/server/validators.ts`](src/lib/server/validators.ts) rejects uppercase, path separators, `..`, and overlong slugs
- Keep the newsletter form contract stable: `email`, `source`, and honeypot `website`. UI, API, and migration assumptions all depend on those names
- Media references inside MDX sometimes use `filename@ratio` suffixes. [`src/lib/components/sections/Artifacts.svelte`](src/lib/components/sections/Artifacts.svelte) parses those suffixes for thumbnail sizing
- Homepage cards intentionally keep confidential studies visible as unlinked placeholders while public pages, raw exports, sitemap entries, and OG routes exclude them. Preserve that asymmetry unless you mean to change product behavior

## 8. Constraints

- Do not weaken CSP, HSTS, `permissions-policy`, alternate raw `Link` headers, or nonce injection in [`src/hooks.server.ts`](src/hooks.server.ts) and [`src/routes/+layout.svelte`](src/routes/+layout.svelte)
- Do not remove [`static/empty.js`](static/empty.js); it exists so the layout can load a nonce-bearing external script on first paint
- Do not hand-edit `.svelte-kit/`, `build/`, prerendered OG PNGs, or `node_modules/.vite`; rebuild or clean instead
- Treat [`src/lib/server/content.ts`](src/lib/server/content.ts), [`src/lib/server/raw.ts`](src/lib/server/raw.ts), [`src/lib/server/metadata.ts`](src/lib/server/metadata.ts), and [`src/lib/server/artifacts.ts`](src/lib/server/artifacts.ts) as a coupled system. Visibility or serialization changes ripple into pages, raw exports, sitemap, and OG routes
- Treat [`src/lib/server/og.ts`](src/lib/server/og.ts), [`scripts/check-og.ts`](scripts/check-og.ts), [`_headers`](_headers), and MDX `ogImage` / `ogTextTone` frontmatter as one deployment surface
- Adding new top-level non-file routes may require updating `shouldRedirectToHome()` in [`src/hooks.server.ts`](src/hooks.server.ts); unmatched `/foo` paths currently 302 to `/` after a 404
- Changes to [`src/lib/components/core/CoreGrainOverlay.svelte`](src/lib/components/core/CoreGrainOverlay.svelte), [`src/lib/components/atomic/AtomicBrandLogo.svelte`](src/lib/components/atomic/AtomicBrandLogo.svelte), or [`src/lib/webgl.ts`](src/lib/webgl.ts) need extra validation on reduced-motion, coarse-pointer, and low-tier devices

## 9. Validation

- Required gate: `bun run util:check` and expect it to rewrite formatting before the non-mutating checks
- If you touch OG generation, media handling, or MDX frontmatter fields used by OG routes, also run `bun run build` because [`src/routes/og.png/+server.ts`](src/routes/og.png/+server.ts) and [`src/routes/[slug]/og.png/+server.ts`](src/routes/[slug]/og.png/+server.ts) are prerendered outputs
- Manual smoke: run `bun run dev`, load `/`, one public slug like `/patterns` or `/transect`, `/llms.txt`, and `/patterns.md`; verify no console errors, correct raw output, and working copy/share controls on slug pages
- Agent redirect smoke: with `AGENT_REDIRECT_MODE=enforce`, `curl -I -A 'ClaudeBot' http://localhost:3000/patterns` should `302` to `/patterns.txt`; set `AGENT_REDIRECT_DEBUG=1` when you need `x-agent-*` headers
- Newsletter smoke: submit the footer form once with valid input and once with invalid input. With `NEWSLETTER_DB` configured, duplicate emails should be idempotent; without it, expect `503` / `UNAVAILABLE`
- Security smoke: confirm `content-security-policy`, `strict-transport-security`, `permissions-policy`, and alternate raw `Link` headers, plus a `csp-nonce` meta tag and nonce-bearing `/empty.js` load in the document head
