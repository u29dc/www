# Project Agent Guide

## Stack & Defaults

- Next.js 16 (app router, proxy), React 19 with React Compiler on, Tailwind CSS 4 via PostCSS, Bun + Biome, TypeScript strict; MCP server flag enabled.
- Absolute imports via `@/`; relative imports only for CSS and scripts; no emojis (pattern rule).
- No automated tests—manual QA required. Prefer Bun/Bunx for commands.
- Run `mcp__next-devtools__init` at session start when available; use MCP nextjs_docs or https://nextjs.org/docs/llms.txt for framework lookups.

## Commands

- Dev: `bun run dev` (Turbopack, https, cleans artifacts on exit)
- Build: `bun run build`
- Quality: `bun run util:check` (format + lint + patterns + types); `bun run util:lint:fix` & `bun run util:types` & `bun run util:patterns` & `bun run util:clean`

## Working Ritual

- Skim relevant files before edits.
- Favor React 19 hooks (`use`, `useActionState`, `useFormStatus`, `useOptimistic`); avoid unnecessary memoization; pass refs as props.
- Maintain Tailwind class sorting (Biome `useSortedClasses`) and align with existing style ordering.
- Run `bun run util:check` and the manual QA list below before handoff.

## Repo Map

- `src/proxy.ts`: edge proxy (replaces middleware) with nonce-based CSP, permissions-policy, HSTS; adds .md/.txt link headers for slug paths.
- `src/app/layout.tsx`: reads `x-nonce`, applies fonts/theme, CoreViewportFix, CoreAppShell (Lenis + theme + overlays).
- `src/app/api/raw/[format]/[slug]/route.ts` + `next.config.ts` rewrites: validate slug/format, serve MDX as `.md`/`.txt`, inject study artifacts for `llms`, set caching/noindex headers.
- `src/lib/constants.ts`: site metadata, CDN host, commit SHA fallback, animation timelines.
- `src/lib/logger.ts` / `src/lib/errors.ts`: `logEvent`/`createRequestLogger` with Pino; `AppError` classes and `createErrorResponse` with prod sanitization.
- `src/lib/mdx-server.ts` / `mdx-types.ts` / `validators.ts`: Zod-validated frontmatter, content aggregation, markdown conversion, artifact injection, slug validation; content lives in `src/content/*.mdx`.
- `src/components/core/*`: app shell, viewport fix, overlays, navigation/timeline context; domain components under `animation/`, `atomic/`, `content/`, `layout/`, `mdx/`.
- Scripts: `scripts/dev.ts` (Turbopack https + cleanup), `clean.ts`, `patterns.ts` (no emoji, no relative imports), `utils.ts` helpers.
- Config: `postcss.config.js` (Tailwind 4 + autoprefixer/cssnano), `tsconfig.json` (paths/types), `commitlint.config.js`, `lint-staged.config.js`.

## Guardrails & Conventions

- Security: preserve proxy CSP/nonce flow; Next headers in `next.config.ts` are fallback—do not weaken permissions-policy/HSTS without justification.
- Styling: Tailwind 4 classes must stay sorted; globals live in `src/styles`; avoid adding ad-hoc inline styles without nonce.
- Assets: Next image remote patterns locked to `storage.u29dc.com`; local patterns under `/public/**`.
- Commits: commitlint enforced types (feat/fix/refactor/perf/docs/style/test/build/ci/chore/revert) with scopes (core/ui/api/db/auth/config/deps/types/utils/docs/tests/ci/release); header ≤100 chars.

## Manual QA (no test suite)

- `bun run dev` → load home, ensure animations/Lenis/theme render with no console errors.
- Visit a content page (e.g., `/paterns`) and verify scroll CTA, overlays, metadata.
- Hit `/llms.txt` and one slug `.md`/`.txt` to confirm rewrites, headers, and artifact injection.
- Check head for `csp-nonce` meta and that scripts receive the nonce; confirm permissions-policy/HSTS present.
- Finish with `bun run util:check`.
