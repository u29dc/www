# Project Manifesto

## Context

Next.js 16.0.0-beta.0, React 19.2.0, Tailwind CSS 4.1.14, Bun runtime, Biome tooling, TypeScript strict mode.
Global CLAUDE.md rules inherited. Project-specific architecture and overrides only.

## Commands

1. **Development**: `bun run dev` (Next.js + Turbopack), `bun run build` (production build).
2. **Quality**: `bun run util:check` (format + lint + types + patterns sequentially), `bun run util:lint:fix` (auto-fix), `bun run util:types` (type-check only).
3. **Utilities**: `bun run util:clean` (remove .next, dist, out, \*.tsbuildinfo, kill open ports), `bun run util:patterns` (enforce custom patterns and preferences).

## Documentation Strategy

1. **Next.js 16 Beta**: Nextjs 16 Beta docs required. Fetch via `gitingest https://github.com/vercel/next.js/blob/next-16-beta/docs/01-app/ -o -` for App Router. Focus subfolders `/blob/next-16-beta/docs/01-app/[subfolder]`, filter patterns `-i "**/[pattern]*.mdx"`. Stream to terminal `-o -`, never create files.
2. **React 19**: New hooks (`use`, `useActionState`, `useFormStatus`, `useOptimistic`) over React 18 patterns. Avoid deprecated (string refs, legacy context). React Compiler auto-optimizes, minimize manual `useMemo`/`useCallback`/`memo`. Ref as prop instead of forwardRef. Action-oriented mutations.
3. **Tailwind CSS 4**: PostCSS architecture (`@tailwindcss/postcss`), breaking changes from v3. CSS-first configuration. Fetch v4 docs for new patterns.

## Architecture

1. **Edge Proxy System** (src/proxy.ts): Security boundary intercepting all requests. Generates CSP nonce per request (`Buffer.from(crypto.randomUUID()).toString('base64')`), sets `x-nonce` header for script tags. Nonce distribution prevents XSS with inline scripts. Development: unsafe-eval/unsafe-inline. Production: nonce-only. Tailwind requires `unsafe-inline` for styles.
2. **Theme System**: Client-side theme management via `next-themes` package. Initialized in root layout with `defaultTheme="system"` and `enableSystem`. Persists to localStorage, syncs with system preferences. Access via `useTheme()` hook. FOUC prevention via blocking script injection.
3. **Structured Logging** (src/lib/utils/logger.ts): Pino-based with domain tagging. Format: `[DOMAIN|ACTION|RESULT]`. Development: pretty-printed, server + browser. Production: structured JSON, server-only. Use `logEvent(domain, action, result, data)` for events, `createRequestLogger(requestId, context)` for request-scoped. Level selection: FAIL/ERROR → error, SLOW/TIMEOUT → warn, others → info.
4. **Error Handling** (src/lib/errors.ts): Typed classes extending `AppError` base with HTTP status codes. Environment-aware sanitization. Development: full stack traces. Production: sanitized messages, no internal exposure. Import from `@/lib/errors`.
5. **Script Tooling** (scripts/\*.ts): Custom Bun scripts. dev.ts orchestrates Next.js with timestamp logging, graceful shutdown, cleanup on exit. clean.ts removes artifacts, kills ports 3000-3003. patterns.ts enforces no-emoji, absolute-imports-only. utils.ts provides shared utilities (timers, colors, error formatting). All use `#!/usr/bin/env bun` shebang.
6. **Component Organization**: Core infrastructure `src/components/core/*` (app shell, viewport fixes, providers). UI primitives `src/components/ui/*`. Features `src/components/*`. Naming: `[domain]-[type]-[purpose].tsx`.
7. **Type Safety**: Strict mode with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`. Zero `any` types (Biome error). Explicit type-only imports `import type`.
8. **Security**: Two-layer architecture. Edge proxy (`src/proxy.ts`) provides CSP + security headers. Next.js config headers (`next.config.ts`) fallback for static routes and CDN-cached content. Never bypass without justification.
9. **Quality Gates**: Zero TypeScript errors, zero Biome warnings, formatted code, pattern compliance. Pre-commit hooks via Husky + lint-staged. Commitlint enforces conventional with required scopes (core, ui, api, db, auth, config, deps, types, utils, docs, tests, ci, release).
10. **Build Configuration**: React Compiler (`reactCompiler: true`). Turbopack for dev and build (`--turbopack`). PostCSS with Tailwind v4, autoprefixer, cssnano in production. Bun package manager, `bun.lock` committed.

## Notes

1. **No Test Framework**: TypeScript strict + Biome + manual QA. Document smoke test steps for critical paths.
2. **Absolute Imports**: `@/` alias only. Relative forbidden except CSS and scripts directory. Enforced via `util:patterns`.
3. **No Emojis**: Strictly forbidden. Enforced via `util:patterns`.
4. **Mobile Safari**: Viewport height fix (`src/components/core/viewport-height-fix.tsx`) critical for full-height layouts, scroll consistency.
5. **JSDoc Format**: Complex components use SUMMARY/RESPONSIBILITIES/USAGE/KEY FLOWS. See proxy.ts, utils/logger.ts, core-viewport-fix.tsx.
