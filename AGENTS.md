# Project Manifesto

## Context

Next.js 16, React 19, Tailwind CSS 4, Bun runtime, Biome tooling, TypeScript strict mode.
Global CLAUDE.md rules inherited. Project-specific architecture and overrides only.

## Commands

1. **Development**: `bun run dev` (Next.js + Turbopack), `bun run build` (production build).
2. **Quality**: `bun run util:check` (format + lint + types + patterns sequentially), `bun run util:lint:fix` (auto-fix), `bun run util:types` (type-check only).
3. **Utilities**: `bun run util:clean` (remove .next, dist, out, \*.tsbuildinfo, kill open ports), `bun run util:patterns` (enforce custom patterns and preferences).

## Documentation Strategy

1. **Session Initialization:** Execute `mcp__next-devtools__init` at project start before any operations. Mandatory. Establishes documentation-first requirements, fetches latest Next.js docs, configures runtime introspection. Automatic invocation required—do not wait for user prompt.
2. **Lookup Priority:** Consult in order when investigating Next.js 16+ behavior:
    - **Primary:** MCP Server (`mcp__next-devtools__nextjs_docs`) for current documentation and runtime introspection
    - **LLM-Optimized:** https://nextjs.org/docs/llms.txt for comprehensive structured reference
    - **GitHub Direct:** `gitingest https://github.com/vercel/next.js/tree/canary/docs -o -` for latest unreleased features
    - **Fallback:** Branch-specific docs only if MCP unavailable
    - ALWAYS verify assumptions against official sources—framework knowledge cutoff may be outdated for breaking changes.
3. **Gitingest Usage:** Stream output to terminal (`-o -`), never create files. Focus subfolders with `-i "**/[pattern]*.mdx"`. Explore root with `--max-size 1024` to identify directories, then target specific folders.
4. **Framework-Specific Verification:**
    - **Next.js 16:** Verify breaking changes (middleware→proxy rename, async request APIs, deprecated patterns)
    - **React 19:** Prefer new hooks (`use`, `useActionState`, `useFormStatus`, `useOptimistic`) over React 18 patterns. Avoid deprecated (string refs, legacy context). React Compiler auto-optimizes—minimize manual `useMemo`/`useCallback`/`memo`. Ref as prop instead of forwardRef.
    - **Tailwind CSS 4:** PostCSS architecture (`@tailwindcss/postcss`), breaking changes from v3. CSS-first configuration. Fetch v4 docs for new patterns.

## Architecture

1. **Edge Proxy System** (src/proxy.ts): **Next.js 16 renamed `middleware` to `proxy`** - current implementation is correct per v16 convention. Security boundary intercepting all requests. Generates CSP nonce per request (`Buffer.from(crypto.randomUUID()).toString('base64')`), sets `x-nonce` header for script tags. Nonce distribution prevents XSS with inline scripts. Development: unsafe-eval/unsafe-inline. Production: nonce-only. Tailwind requires `unsafe-inline` for styles. Official docs: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
2. **Theme System**: Client-side theme management via `next-themes` package. Initialized in root layout with `defaultTheme="light"`, `enableSystem={false}`, and `disableTransitionOnChange={true}`. Persists to localStorage. Access via `useTheme()` hook. FOUC prevention via `suppressHydrationWarning` attribute on html element.
3. **Structured Logging** (src/lib/logger.ts): Pino-based with domain tagging. Format: `[DOMAIN|ACTION|RESULT]`. Development: pretty-printed, server + browser. Production: structured JSON, server-only. Use `logEvent(domain, action, result, data)` for events, `createRequestLogger(requestId, context)` for request-scoped. Level selection: FAIL/ERROR → error, SLOW/TIMEOUT → warn, others → info.
4. **Error Handling** (src/lib/errors.ts): Typed classes extending `AppError` base with HTTP status codes. Environment-aware sanitization. Development: full stack traces. Production: sanitized messages, no internal exposure. Import from `@/lib/errors`.
5. **Script Tooling** (scripts/\*.ts): Custom Bun scripts. dev.ts orchestrates Next.js with timestamp logging, graceful shutdown, cleanup on exit. clean.ts removes artifacts, kills ports 3000-3003. patterns.ts enforces no-emoji, absolute-imports-only. utils.ts provides shared utilities (timers, colors, error formatting). All use `#!/usr/bin/env bun` shebang.
6. **Component Organization**: Core infrastructure `src/components/core/*` (app shell, viewport fixes, providers). Feature components organized by domain: `animation/*`, `atomic/*`, `content/*`, `layout/*`, `mdx/*`. Naming: `[domain]-[type]-[purpose].tsx`.
7. **Type Safety**: Strict mode with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`. Zero `any` types (Biome error). Explicit type-only imports `import type`.
8. **Security**: Two-layer architecture. Edge proxy (`src/proxy.ts`) provides CSP + security headers. Next.js config headers (`next.config.ts`) fallback for static routes and CDN-cached content. Never bypass without justification.
9. **Quality Gates**: Zero TypeScript errors, zero Biome warnings, formatted code, pattern compliance. Pre-commit hooks via Husky run two-step validation: (1) lint-staged for Biome auto-fix, (2) util:check for comprehensive format + lint + patterns + types verification. Commitlint enforces conventional commits with required types (feat, fix, refactor, perf, docs, style, test, build, ci, chore, revert) and scopes (core, ui, api, db, auth, config, deps, types, utils, docs, tests, ci, release).
10. **Build Configuration**: React Compiler (`reactCompiler: true`). Turbopack for dev and build (`--turbopack`). PostCSS with Tailwind v4, autoprefixer, cssnano in production. Bun package manager, `bun.lock` committed.

## Notes

1. **No Test Framework**: TypeScript strict + Biome + manual QA. Document smoke test steps for critical paths.
2. **Absolute Imports**: `@/` alias only. Relative forbidden except CSS and scripts directory. Enforced via `util:patterns`.
3. **No Emojis**: Strictly forbidden. Enforced via `util:patterns`.
4. **Mobile Safari**: Viewport height fix (`src/components/core/core-viewport-fix.tsx`) critical for full-height layouts, scroll consistency.
5. **JSDoc Format**: Complex components use SUMMARY/RESPONSIBILITIES/USAGE/KEY FLOWS. See proxy.ts, lib/logger.ts, core-viewport-fix.tsx.
6. **Tailwind Class Sorting**: Biome's `useSortedClasses` rule (experimental/nursery) enforces consistent class ordering across all components. Sorting pattern: negative values first (e.g., `-right-1`), then layout/positioning, display, sizing, spacing, typography, with responsive modifiers grouped by breakpoint. Custom classes may appear in non-standard positions but are consistently sorted. Suppress when needed: `// biome-ignore lint/nursery/useSortedClasses: <reason>`. Claude AI should match Biome's sorting order when writing/editing components, prioritizing consistency over conventional Tailwind ordering.
