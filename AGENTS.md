# Project Agent Guide

## Stack & Defaults

- SvelteKit 2 + Svelte 5 (runes), Vite, Tailwind CSS 4 via PostCSS, Bun + Biome, TypeScript strict, adapter-cloudflare.
- Use SvelteKit aliases `$lib` and `$app`, plus `@` for `src`; relative imports only for CSS and scripts; no emojis (pattern rule).
- No automated tests—manual QA required. Prefer Bun/Bunx for commands.
- Use SvelteKit docs (mcp svelte list-sections / get-documentation) for framework lookups.

## Commands

- Dev: `bun run dev`
- Build: `bun run build`
- Quality: `bun run util:check` (format + lint + types); `bun run util:lint:fix` / `bun run util:types` / `bun run util:clean`

## Working Ritual

- Skim relevant files before edits.
- Favor Svelte 5 runes (`$state`, `$derived`, `$effect`) and SvelteKit conventions; avoid unnecessary stores.
- Maintain Tailwind class sorting (Biome `useSortedClasses`) and align with existing style ordering.
- Run `bun run util:check` and the manual QA list below before handoff.

## Repo Map

- `src/hooks.server.ts`: CSP nonce + security headers + 404 redirect rules; adds nonce to `<script>`/`<style>`.
- `src/routes/+layout.svelte` + `src/routes/+layout.server.ts`: injects `csp-nonce` meta and global shell.
- `src/routes/api/raw/[format]/[slug]/+server.ts`: raw MD/TXT API with validation, caching, noindex.
- `src/lib/server/content.ts` / `raw.ts` / `validators.ts`: MDX aggregation, markdown conversion, slug validation.
- `src/lib/constants.ts`: site metadata, CDN host, animation timelines.
- `src/lib/logger.ts` / `src/lib/errors.ts`: logging + error helpers.
- `src/lib/components/*`: app shell, overlays, layout, content, MDX components.
- `src/styles/*` + `src/app.css`: global styles and Tailwind utilities.
- Config: `svelte.config.js`, `vite.config.ts`, `postcss.config.js`, `tsconfig.json`, `biome.json`, `commitlint.config.js`, `lint-staged.config.js`.

## Guardrails & Conventions

- Security: preserve CSP/nonce flow in `src/hooks.server.ts`; do not weaken permissions-policy/HSTS without justification.
- Styling: Tailwind 4 classes must stay sorted; globals live in `src/styles`; avoid inline styles unless nonce-bound stylesheets.
- Assets: media served from `CDN.mediaUrl`/`CDN.baseUrl`; static assets under `/static`.
- Commits: commitlint enforced types (feat/fix/refactor/perf/docs/style/test/build/ci/chore/revert) with scopes (core/ui/api/db/auth/config/deps/types/utils/docs/tests/ci/release); header ≤100 chars.

## Manual QA (no test suite)

- `bun run dev` → load home, ensure animations/scroll overlay/theme render with no console errors.
- Visit a content page (e.g., `/patterns`) and verify scroll CTA, overlays, metadata.
- Hit `/llms.txt` and one slug `.md`/`.txt` to confirm raw responses, headers, and artifact injection.
- Check head for `csp-nonce` meta and that scripts/styles receive the nonce; confirm permissions-policy/HSTS present.
- Finish with `bun run util:check`.
