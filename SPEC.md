# SvelteKit Migration Specification (Next.js 16 -> Svelte 5)

## Executive Summary

This document specifies the migration of the current Next.js 16 App Router site to Svelte 5 with SvelteKit. The target preserves the existing content system (MDX with Zod validation), security model (CSP nonce, security headers, HSTS), raw content API (.md/.txt), metadata routes (sitemap, robots, manifest, icons, OG), and visual layout. Timeline-driven animations are explicitly skipped for v1 and replaced with static equivalents. All configuration must follow the Bun, TypeScript, Biome, and Tailwind requirements below and align with patterns in /Users/han/Git/acc/packages/web.

## Current State Research (Next.js 16)

Key findings from the existing codebase (files inspected):

- Root layout reads x-nonce from headers, injects meta csp-nonce, loads empty.js with nonce, and wraps content with CoreAppShell and CoreViewportFix in src/app/layout.tsx.
- Home page is a timeline-driven composition of ContentIndex sections in src/app/page.tsx.
- Content page uses slug validation, redirects llms -> /llms.txt, blocks confidential studies, and renders MDX via next-mdx-remote in src/app/[slug]/page.tsx.
- 404 behavior is a server redirect to / in src/app/not-found.tsx.
- Global security headers and CSP nonce generation live in src/proxy.ts. CSP includes strict directives with environment-dependent script-src and explicit upgrade-insecure-requests.
- MDX content system uses gray-matter, js-yaml, Zod schemas, and filesystem reads in src/lib/mdx-server.ts and src/lib/mdx-types.ts, with slug validation in src/lib/validators.ts and media parsing in src/lib/mdx-client.ts.
- Raw content API in src/app/api/raw/[format]/[slug]/route.ts supports md/txt, injects artifacts into llms, and sets cache and noindex headers.
- Metadata and image generation live in src/lib/metadata.tsx and are exposed by routes in src/app/sitemap.ts, src/app/robots.ts, src/app/manifest.ts, src/app/icon.tsx, src/app/apple-icon.tsx, src/app/opengraph-image.tsx.
- Layout and content components are in src/components/_, with animation and timeline systems in src/components/animation/_ and src/lib/timeline.tsx. These are skipped for v1.
- Styling uses Tailwind 4 with custom utilities and theme variables in src/styles/globals.css.
- Asset files are in public/ (empty.js, favicon.ico, favicon.svg, logo.png, safari-pinned-tab.svg).

## Target Stack and Mandatory Configuration

All configuration below is mandatory and must be applied in the SvelteKit repo.

### Package Manager and Scripts (Bun)

Use Bun for all commands, matching the required scripts.

```json
{
	"scripts": {
		"dev": "bunx --bun vite dev",
		"build": "bunx --bun vite build",
		"preview": "bunx --bun vite preview",
		"util:check": "bun run util:format && bun run util:lint && bun run util:types",
		"util:format": "bunx biome format --write .",
		"util:lint": "bunx biome check --max-diagnostics=500 .",
		"util:lint:fix": "bunx biome check --fix --max-diagnostics=500 .",
		"util:types": "bunx tsc --noEmit"
	}
}
```

### TypeScript (strict, maximal safety)

```json
{
	"compilerOptions": {
		"strict": true,
		"alwaysStrict": true,
		"noUncheckedIndexedAccess": true,
		"noImplicitAny": true,
		"noImplicitReturns": true,
		"noUnusedLocals": true,
		"noUnusedParameters": true,
		"noImplicitThis": true,
		"noFallthroughCasesInSwitch": true,
		"exactOptionalPropertyTypes": true,
		"noImplicitOverride": true,
		"noPropertyAccessFromIndexSignature": true,
		"verbatimModuleSyntax": true,
		"isolatedModules": true,
		"noEmit": true,
		"target": "ESNext",
		"module": "ESNext",
		"moduleResolution": "Bundler"
	}
}
```

### Biome (biome.json)

```json
{
	"$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
	"formatter": {
		"enabled": true,
		"indentStyle": "tab",
		"indentWidth": 4,
		"lineWidth": 200,
		"lineEnding": "lf"
	},
	"javascript": {
		"formatter": {
			"quoteStyle": "single",
			"jsxQuoteStyle": "double",
			"trailingCommas": "all",
			"semicolons": "always",
			"arrowParentheses": "always"
		}
	},
	"linter": {
		"enabled": true,
		"rules": {
			"recommended": true,
			"suspicious": {
				"noExplicitAny": "error",
				"noConsole": "error"
			},
			"correctness": {
				"noUnusedVariables": "error",
				"noUnusedImports": "error"
			},
			"style": {
				"noNonNullAssertion": "error",
				"useConst": "error"
			},
			"nursery": {
				"useSortedClasses": {
					"level": "warn",
					"options": {
						"attributes": ["class"],
						"functions": ["clsx", "cva", "tw", "cn"]
					}
				}
			}
		}
	}
}
```

### Commitlint

```javascript
export default {
	extends: ["@commitlint/config-conventional"],
	rules: {
		"type-enum": [
			2,
			"always",
			[
				"feat",
				"fix",
				"refactor",
				"docs",
				"style",
				"chore",
				"test",
				"build",
				"ci",
				"perf",
				"revert",
			],
		],
		"scope-enum": [
			2,
			"always",
			[
				"core",
				"ui",
				"api",
				"config",
				"deps",
				"types",
				"utils",
				"docs",
				"ci",
				"release",
			],
		],
		"scope-empty": [2, "never"],
		"header-max-length": [2, "always", 100],
		"body-max-line-length": [2, "always", 72],
		"subject-case": [2, "always", "lower-case"],
		"subject-full-stop": [2, "never", "."],
	},
};
```

### lint-staged

```javascript
export default {
	"*": () => ["bun run util:check"],
};
```

### SvelteKit Adapter (Bun)

```javascript
// svelte.config.js
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import adapter from "svelte-adapter-bun";

const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
	},
};
export default config;
```

### Vite Configuration

```typescript
// vite.config.ts
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],
	server: { port: 3000 },
});
```

### Tailwind CSS 4 (Vite plugin, no PostCSS)

Use @tailwindcss/vite with a single global CSS file (src/app.css). Start with the required baseline and then merge the existing globals.css utilities and theme variables.

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@theme {
	--color-bg: var(--bg);
	--color-panel: var(--panel);
	--color-border: var(--border);
	--color-text: var(--text);
	--color-muted: var(--muted);
	--font-mono: "Fira Code", monospace;
}

:root {
	--bg: #f8f9fa;
	--panel: #ffffff;
	--border: #e5e7eb;
	--text: #1f2937;
	--muted: #9ca3af;
}

.dark {
	--bg: #0d0f10;
	--panel: #1a1d1f;
	--border: #3a3f43;
	--text: #e6e6e8;
	--muted: #9ca3af;
}
```

### Required Dependencies

```json
{
	"devDependencies": {
		"@commitlint/cli": "^20.0.0",
		"@commitlint/config-conventional": "^20.0.0",
		"@biomejs/biome": "^2.0.0",
		"@sveltejs/kit": "^2.0.0",
		"@sveltejs/vite-plugin-svelte": "^6.0.0",
		"@tailwindcss/vite": "^4.0.0",
		"husky": "^9.0.0",
		"lint-staged": "^16.0.0",
		"svelte": "^5.0.0",
		"svelte-adapter-bun": "^0.5.0",
		"tailwindcss": "^4.0.0",
		"typescript": "^5.0.0",
		"vite": "^7.0.0"
	},
	"dependencies": {
		"gray-matter": "^4.0.0",
		"zod": "^3.0.0"
	}
}
```

### Reference Patterns from /Users/han/Git/acc

Match the SvelteKit patterns used in /Users/han/Git/acc/packages/web:

- bunx --bun vite dev/build/preview scripts
- svelte-adapter-bun adapter and vitePreprocess
- @tailwindcss/vite plugin, server port 3000
- tsconfig extends .svelte-kit/tsconfig.json with strict and bundler module resolution

## Architecture Mapping (Next.js -> SvelteKit)

| Next.js Concept                          | SvelteKit Equivalent                                                 | Notes                                                                                                     |
| ---------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| src/app/layout.tsx                       | src/routes/+layout.svelte + src/routes/+layout.server.ts             | Use +layout.server.ts to pass nonce and global data; +layout.svelte for HTML structure and <svelte:head>. |
| src/app/page.tsx                         | src/routes/+page.svelte + src/routes/+page.server.ts                 | Load content server-side and render sections.                                                             |
| src/app/[slug]/page.tsx                  | src/routes/[slug]/+page.svelte + src/routes/[slug]/+page.server.ts   | Validate slug, redirect llms, enforce confidentiality.                                                    |
| src/app/not-found.tsx                    | src/hooks.server.ts or src/routes/+error.svelte                      | Implement 404 redirect to / in handle or error page.                                                      |
| src/proxy.ts                             | src/hooks.server.ts                                                  | Centralized CSP nonce and security headers.                                                               |
| src/app/api/raw/[format]/[slug]/route.ts | src/routes/api/raw/[format]/[slug]/+server.ts                        | Same validation and response headers.                                                                     |
| next.config.ts rewrites                  | src/routes/[slug].md/+server.ts and src/routes/[slug].txt/+server.ts | Provide direct endpoints for /:slug.md and /:slug.txt.                                                    |
| src/app/sitemap.ts                       | src/routes/sitemap.xml/+server.ts                                    | Use metadata generator.                                                                                   |
| src/app/robots.ts                        | src/routes/robots.txt/+server.ts                                     | Use metadata generator.                                                                                   |
| src/app/manifest.ts                      | src/routes/manifest.json/+server.ts                                  | Use metadata generator.                                                                                   |
| src/app/icon.tsx                         | static/ (favicons and PWA icons)                                     | Use static PNG/ICO assets generated offline (ImageMagick or equivalent).                                  |
| src/app/apple-icon.tsx                   | static/apple-touch-icon.png                                          | Use static PNG asset generated offline (ImageMagick or equivalent).                                       |
| src/app/opengraph-image.tsx              | static/opengraph-image.png                                           | Use static PNG asset generated offline (ImageMagick or equivalent).                                       |
| next-themes ThemeProvider                | theme.svelte.ts or svelte-themes                                     | Class-based theme on html root.                                                                           |
| next-mdx-remote                          | mdsvex + import.meta.glob                                            | Render mdx as Svelte components.                                                                          |
| next/og ImageResponse                    | static PNG/ICO assets in static/                                     | Use offline generated placeholder full black assets (ImageMagick or equivalent).                          |

## Route Structure (Target)

```
src/routes/
  +layout.svelte
  +layout.server.ts
  +page.svelte
  +page.server.ts
  +error.svelte
  [slug]/
    +page.svelte
    +page.server.ts
  api/
    raw/[format]/[slug]/
      +server.ts
  [slug].md/
    +server.ts
  [slug].txt/
    +server.ts
  sitemap.xml/
    +server.ts
  robots.txt/
    +server.ts
  manifest.json/
    +server.ts
static/
  favicon.ico
  favicon.svg
  icon-16.png
  icon-32.png
  icon-96.png
  icon-192.png
  icon-512.png
  apple-touch-icon.png
  opengraph-image.png
```

## Security Headers and CSP (proxy.ts -> hooks.server.ts)

Preserve all headers and logic from src/proxy.ts.

### CSP Requirements

CSP directives must match exactly (including upgrade-insecure-requests):

- base-uri 'self'
- default-src 'self'
- connect-src 'self'
- frame-ancestors 'none'
- object-src 'none'
- style-src 'self' 'unsafe-inline'
- media-src 'self' https://storage.u29dc.com
- img-src 'self' data: blob: https://storage.u29dc.com
- font-src 'self' data:
- script-src 'self' 'nonce-{nonce}' plus in dev: 'unsafe-eval' 'unsafe-inline'
- add "upgrade-insecure-requests" at the end

### Header Logic

- Generate nonce per request (crypto.randomUUID -> base64).
- Set event.locals.nonce for later use in +layout.server.ts and +layout.svelte.
- Always set Content-Security-Policy header.
- For non-API routes only (path not starting with /api):
    - x-frame-options: DENY
    - x-content-type-options: nosniff
    - referrer-policy: strict-origin-when-cross-origin
    - permissions-policy: camera=(), microphone=(), geolocation=(), autoplay=(), fullscreen=(self), picture-in-picture=()
    - link header for /:slug -> /:slug.txt and /:slug.md alternates
    - otherwise append link header for /llms.txt
- Always set strict-transport-security: max-age=31536000; includeSubDomains

### Nonce Usage

- In +layout.server.ts, pass nonce into page data.
- In +layout.svelte, set <svelte:head><meta property="csp-nonce" content={nonce}></svelte:head>.
- Include empty.js with nonce in +layout.svelte (or in app.html with %sveltekit.nonce%).

### SvelteKit CSP Config

If SvelteKit CSP configuration is used, ensure kit.csp.mode = 'nonce' or use custom handle logic only. If using custom handle, disable kit.csp to avoid header conflicts. The target requirement is exact parity with src/proxy.ts.

## Content System Migration (MDX -> mdsvex)

### Goals

- Preserve MDX files in src/content/\*.mdx.
- Maintain Zod validation, slug security, and raw markdown conversion.
- Support custom MDX components (MdxParagraph, MdxMedia).
- Keep llms artifact injection logic.

### Approach

1. Configure mdsvex to process .mdx (extensions: ['.mdx']).
2. Use import.meta.glob to load compiled MDX modules for rendering.
3. Continue reading raw MDX source with fs for markdown export.
4. Port mdx-server.ts to $lib/server/content.ts (server-only).
5. Port mdx-types.ts to $lib/content-types.ts (shared types).
6. Port validators.ts to $lib/server/validators.ts (server-only).
7. Port mdx-client.ts to $lib/mdx-client.ts (shared).
8. Move mdx-components.tsx logic into a Svelte-friendly pattern (see below).

### mdsvex Component Injection Options

Choose one of these (Option A recommended):

- Option A (explicit imports): Add imports for MdxParagraph and MdxMedia at the top of each src/content/\*.mdx file. There are only 9 files, so this is manageable and explicit.
- Option B (mdsvex layout): Create a layout component that imports MdxParagraph/MdxMedia and includes a slot. This still requires component names to be in scope; verify mdsvex behavior before relying on it.

### Rendering Strategy

- Use import.meta.glob to map slug -> module:
    - const modules = import.meta.glob('/src/content/\*.mdx', { eager: true });
    - Each module should expose metadata (frontmatter) and default (Svelte component).
- In +page.svelte for [slug], render with <svelte:component this={module.default} />.
- Use Zod validation on frontmatter for all modules (same schemas as mdx-types.ts).

### Raw Content API

- Keep toMarkdown and injectArtifactsIntoLlms logic from mdx-server.ts.
- Retain confidentiality checks (isStudy && isConfidential -> 403 for raw API; redirect for pages).
- Preserve headers (Cache-Control, X-Robots-Tag, Link canonical, Content-Disposition, Content-Length).

## Component Migration Patterns (Svelte 5 Runes)

### General React -> Svelte Mapping

- useState -> $state
- useMemo -> $derived
- useEffect -> $effect or onMount (for DOM-only)
- useRef -> bind:this (DOM refs) or module-level state
- Context -> setContext/getContext
- Children -> Snippet + {@render children()}

### Props and State

```svelte
<script lang="ts">
	type Props = { title: string; items: string[] };
	let { title, items }: Props = $props();
	let count = $state(0);
	let doubled = $derived(count * 2);
</script>
```

### Animations and Timeline

All animation logic (timeline system, motion/react) is skipped for v1. Replace:

- AnimatedBlock, AnimatedStaggerBlur, AnimatedStaggerRedacted -> static wrappers
- AnimatedLink -> plain <a> with SvelteKit navigation
- TimelineProvider and useTimelineStage -> remove or stub to return static state

### Core Components

- CoreAppShell: replace ThemeProvider with theme.svelte.ts and optionally Lenis in onMount. For v1, use static layout and overlays only.
- CoreViewportFix: port to onMount with window/visualViewport listeners.
- CoreGrainOverlay and AtomicBrandLogo: defer to v2 (WebGL heavy). For v1, use static logo (logo.png) and omit grain overlay.
- CoreScrollOverlay: static or simplified version for v1.

### Layout Components

- LayoutSharedWrapper/Header/Footer/ContentBlock -> Svelte components with same Tailwind classes. Replace lucide-react with lucide-svelte ArrowUpRight.

### Content Components

- ContentIndexArtifacts: load content in +page.server.ts and pass as prop; do not use server components.
- ContentIndexArtifactsList/Item/Thumbnails: replace motion/react with CSS transitions and Svelte events. Keep deterministic hash and hover logic.
- ContentIndexStatement/Axioms/Protocols: direct port, remove animation wrappers.

### MDX Components

- MdxParagraph -> simple wrapper with grid classes.
- MdxMedia/MdxMediaItem -> use ResizeObserver and IntersectionObserver via onMount or actions. Remove motion/react whileInView for v1.

### Atomic Components

- AtomicMedia -> Svelte component with <img> and <video>, keep defaults.
- AtomicGradientBlur -> port with onMount IntersectionObserver.

## File-by-File Mapping

### Entry Points and Routes

| Source                  | Target                                                            | Key Transformations                                                            | Dependencies                                                |
| ----------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| src/app/layout.tsx      | src/routes/+layout.svelte, src/routes/+layout.server.ts           | Replace next/headers with locals.nonce; move Script to <script> tag with nonce | hooks.server.ts, theme store, CoreAppShell, CoreViewportFix |
| src/app/page.tsx        | src/routes/+page.svelte, src/routes/+page.server.ts               | Load artifacts server-side; remove TimelineProvider                            | ContentIndex\* components, content loader                   |
| src/app/[slug]/page.tsx | src/routes/[slug]/+page.svelte, src/routes/[slug]/+page.server.ts | Validate slug, redirect llms, enforce confidentiality, render mdsvex component | validators, content loader, mdsvex                          |
| src/app/not-found.tsx   | src/routes/+error.svelte or hooks.server.ts                       | Redirect 404 to /                                                              | hooks.server.ts                                             |

### Security and Hooks

| Source       | Target              | Key Transformations                                                            | Dependencies           |
| ------------ | ------------------- | ------------------------------------------------------------------------------ | ---------------------- |
| src/proxy.ts | src/hooks.server.ts | Implement handle: generate nonce, set CSP + security headers, add link headers | $lib/constants, crypto |

### Content System

| Source                | Target                                                | Key Transformations                                        | Dependencies              |
| --------------------- | ----------------------------------------------------- | ---------------------------------------------------------- | ------------------------- |
| src/lib/mdx-server.ts | src/lib/server/content.ts                             | Server-only: read MDX, Zod validation, markdown conversion | gray-matter, js-yaml, zod |
| src/lib/mdx-types.ts  | src/lib/content-types.ts                              | Shared schemas and type guards                             | zod                       |
| src/lib/validators.ts | src/lib/server/validators.ts                          | Keep slug validation, path traversal protection            | path                      |
| src/lib/mdx-client.ts | src/lib/mdx-client.ts                                 | Keep media extraction logic                                | logger                    |
| mdx-components.tsx    | src/lib/mdx/components.ts (or mdsvex import strategy) | Replace MDX component mapping with mdsvex imports          | MdxParagraph, MdxMedia    |
| src/content/\*.mdx    | src/content/\*.mdx                                    | Preserve content and frontmatter                           | mdsvex                    |

### API and Special Routes

| Source                                   | Target                                                            | Key Transformations                                        | Dependencies                       |
| ---------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------- |
| src/app/api/raw/[format]/[slug]/route.ts | src/routes/api/raw/[format]/[slug]/+server.ts                     | Use @sveltejs/kit error/redirect/json; same headers        | content loader, validators, errors |
| next.config.ts rewrites                  | src/routes/[slug].md/+server.ts, src/routes/[slug].txt/+server.ts | Call shared raw handler                                    | same as raw API                    |
| src/app/sitemap.ts                       | src/routes/sitemap.xml/+server.ts                                 | Return XML Response                                        | metadata generator                 |
| src/app/robots.ts                        | src/routes/robots.txt/+server.ts                                  | Return text Response                                       | metadata generator                 |
| src/app/manifest.ts                      | src/routes/manifest.json/+server.ts                               | Return JSON Response                                       | metadata generator                 |
| src/app/icon.tsx                         | static/ icons and favicons                                        | Use static PNG/ICO assets generated offline                | ImageMagick or equivalent          |
| src/app/apple-icon.tsx                   | static/apple-touch-icon.png                                       | Use static PNG asset generated offline                     | ImageMagick or equivalent          |
| src/app/opengraph-image.tsx              | static/opengraph-image.png                                        | Use static PNG asset generated offline                     | ImageMagick or equivalent          |
| src/lib/metadata.tsx                     | src/lib/server/metadata.ts                                        | Rewrite to return strings/buffers instead of ImageResponse | fs, path                           |

### Components (Core, Layout, Content, Atomic, MDX)

| Source                                          | Target                                               | Key Transformations                               | Dependencies                        |
| ----------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------- | ----------------------------------- |
| src/components/core/core-app-shell.tsx          | src/lib/components/core/CoreAppShell.svelte          | Remove next-themes, Lenis optional; keep overlays | theme.svelte.ts                     |
| src/components/core/core-viewport-fix.tsx       | src/lib/components/core/CoreViewportFix.svelte       | onMount for CSS --vh updates                      | browser API                         |
| src/components/core/core-grain-overlay.tsx      | src/lib/components/core/CoreGrainOverlay.svelte      | Defer to v2, optionally static placeholder        | webgl utils                         |
| src/components/core/core-scroll-overlay.tsx     | src/lib/components/core/CoreScrollOverlay.svelte     | Defer motion to v2, static for v1                 | -                                   |
| src/components/layout/layout-shared-wrapper.tsx | src/lib/components/layout/LayoutSharedWrapper.svelte | Replace React children with snippet               | CoreScrollOverlay                   |
| src/components/layout/layout-shared-header.tsx  | src/lib/components/layout/LayoutSharedHeader.svelte  | Remove AnimatedStaggerBlur for v1                 | AtomicBrandLogo, AtomicGradientBlur |
| src/components/layout/layout-shared-footer.tsx  | src/lib/components/layout/LayoutSharedFooter.svelte  | Replace lucide-react with lucide-svelte           | lucide-svelte                       |
| src/components/layout/layout-content-block.tsx  | src/lib/components/layout/LayoutContentBlock.svelte  | Remove AnimatedBlock wrapper                      | -                                   |
| src/components/content/\*                       | src/lib/components/content/\*                        | Remove motion wrappers, keep content              | mdx-client, content loader          |
| src/components/atomic/atomic-brand-logo.tsx     | src/lib/components/atomic/AtomicBrandLogo.svelte     | Defer to v2 (WebGL), use static logo for v1       | webgl utils                         |
| src/components/atomic/atomic-gradient-blur.tsx  | src/lib/components/atomic/AtomicGradientBlur.svelte  | Port IntersectionObserver logic                   | browser API                         |
| src/components/atomic/atomic-media.tsx          | src/lib/components/atomic/AtomicMedia.svelte         | Svelte <img>/<video>                              | -                                   |
| src/components/mdx/mdx-paragraph.tsx            | src/lib/components/mdx/MdxParagraph.svelte           | Direct port                                       | -                                   |
| src/components/mdx/mdx-media.tsx                | src/lib/components/mdx/MdxMedia.svelte               | ResizeObserver for layout                         | -                                   |
| src/components/mdx/mdx-media-item.tsx           | src/lib/components/mdx/MdxMediaItem.svelte           | Remove motion, use IntersectionObserver           | -                                   |

### Animation (Skipped for v1)

| Source                      | Target                          | Key Transformations                   | Dependencies |
| --------------------------- | ------------------------------- | ------------------------------------- | ------------ |
| src/components/animation/\* | src/lib/components/animation/\* | Replace with static wrappers or defer | -            |
| src/lib/timeline.tsx        | src/lib/timeline.ts             | Defer to v2 or stub for v1            | -            |

### Supporting Libraries

| Source                 | Target                 | Key Transformations                                                            | Dependencies          |
| ---------------------- | ---------------------- | ------------------------------------------------------------------------------ | --------------------- |
| src/lib/constants.ts   | src/lib/constants.ts   | Remove Next metadata types, keep SITE/CDN/BUILD and timeline config (optional) | -                     |
| src/lib/fonts.ts       | src/styles/fonts.css   | Replace next/font/local with @font-face and CSS variables                      | static fonts          |
| src/lib/errors.ts      | src/lib/errors.ts      | Use in +server.ts for consistent error responses                               | @sveltejs/kit helpers |
| src/lib/logger.ts      | src/lib/logger.ts      | Keep pino; guard browser usage with $app/environment                           | pino                  |
| src/lib/class.ts       | src/lib/class.ts       | Keep cn helper                                                                 | -                     |
| src/lib/dom.ts         | src/lib/dom.ts         | Keep text helpers (v2 animations)                                              | -                     |
| src/lib/webgl.ts       | src/lib/webgl.ts       | Keep for v2                                                                    | -                     |
| src/lib/performance.ts | src/lib/performance.ts | Replace useSyncExternalStore with Svelte store                                 | -                     |

### Config and Assets

| Source                 | Target                            | Key Transformations                               | Dependencies    |
| ---------------------- | --------------------------------- | ------------------------------------------------- | --------------- |
| next.config.ts         | svelte.config.js + vite.config.ts | Replace rewrites with routes; add kit.alias for @ | sveltekit, vite |
| postcss.config.js      | remove                            | Tailwind handled by @tailwindcss/vite             | -               |
| biome.json             | biome.json                        | Apply required config                             | biome           |
| tsconfig.json          | tsconfig.json                     | Use strict config, set alias                      | typescript      |
| src/styles/globals.css | src/app.css                       | Merge existing utilities and theme                | tailwindcss     |
| public/\*              | static/\*                         | Move assets to SvelteKit static                   | -               |

## Library Recommendations

- next-themes -> custom theme.svelte.ts or svelte-themes. Custom store is preferred to mirror current class-based behavior and avoid extra deps.
- @studio-freight/react-lenis -> lenis with a Svelte wrapper (custom onMount). Optionally use a maintained Svelte Lenis wrapper if available.
- next-mdx-remote -> mdsvex with import.meta.glob for compiled MDX.
- gray-matter -> keep (server-only raw markdown conversion).
- zod -> keep (schemas and type guards).
- pino -> keep for server logs; optionally no-op in browser to avoid bundle cost.
- motion/react -> svelte-motion or @motionone/svelte (v2). v1 uses static components.
- lucide-react -> lucide-svelte.
- next/og -> static PNG/ICO assets only. Use ImageMagick (or equivalent) to create placeholder full black assets for all required PWA icons, favicons, Apple touch icon, and OG image.

## Migration Phases

### Phase 1: Foundation

- Create svelte branch.
- Initialize SvelteKit project with Bun and required scripts.
- Add Tailwind 4 via Vite plugin and port globals.css -> app.css.
- Configure strict tsconfig, Biome, commitlint, lint-staged.
- Add svelte-adapter-bun and vite config.
- Set kit.alias for @ -> src and update tsconfig paths.
- Create hooks.server.ts with CSP and security headers.
- Create +layout.svelte and +layout.server.ts, include nonce meta and empty.js.

### Phase 2: Content System

- Port mdx-types.ts -> content-types.ts.
- Port validators.ts -> server/validators.ts.
- Port mdx-server.ts -> server/content.ts.
- Configure mdsvex for .mdx.
- Update content files with explicit component imports if needed.
- Implement content loading via import.meta.glob and Zod validation.

### Phase 3: Layout Components

- Port LayoutSharedWrapper, LayoutSharedHeader, LayoutSharedFooter, LayoutContentBlock to Svelte.
- Replace Animated\* wrappers with static markup for v1.
- Replace lucide-react with lucide-svelte.

### Phase 4: Atomic and Core Components

- Port AtomicMedia and AtomicGradientBlur.
- Port CoreViewportFix.
- Replace CoreAppShell with Svelte version (theme + overlays). Skip Lenis and WebGL overlays for v1.

### Phase 5: Content Components

- Port ContentIndex\* components, remove motion and timeline usage.
- Port ContentIndexArtifactsItemThumbnails hover logic with bind:this.

### Phase 6: API and Special Routes

- Implement api/raw/[format]/[slug]/+server.ts with same headers and logic.
- Implement [slug].md/+server.ts and [slug].txt/+server.ts to mirror rewrites.
- Port metadata generators for sitemap.xml, robots.txt, manifest.json.
- Use ImageMagick (or equivalent) to create placeholder full black assets for all required PWA icons, favicons, Apple touch icon, and OG image, then serve them from static/.

### Phase 7: Theme and Polish

- Implement theme.svelte.ts store or svelte-themes integration.
- Re-enable Lenis and motion in v2 if required.
- Verify Tailwind class parity and spacing.

## Testing Checklist (Manual QA)

- Homepage renders with no console errors.
- Content pages load with correct title/description and canonical links.
- /llms.txt renders and includes injected artifacts.
- /:slug.md and /:slug.txt return correct headers and content.
- CSP nonce is present, CSP headers match proxy.ts, HSTS and permissions-policy present.
- Theme switching toggles html.dark class and selection colors.
- Responsive layout matches current design (grid, typography, spacing).

## Risks and Mitigations

- CSP nonce mismatch or missing headers: implement CSP entirely in hooks.server.ts and verify with curl for every route.
- mdsvex component scope for MdxParagraph/MdxMedia: use explicit imports in each content file to avoid hidden compile errors.
- Dynamic image generation complexity: avoid runtime generation. Use ImageMagick (or equivalent) to create placeholder full black assets for all required PWA icons, favicons, Apple touch icon, and OG image.
- Dropping timeline animations affects layout perception: ensure structural HTML and CSS parity first, reintroduce animation in v2.
- Pino in client bundle increases size: guard logging via $app/environment or split into server-only logger.
- prerendering conflicts with nonce usage: keep SSR enabled (no prerender) for pages requiring nonce.

## Notes

- All animation logic (timeline system and motion wrappers) is skipped for v1.
- Tailwind class names must remain as close as possible to current markup for visual parity.
- CDN host remains https://storage.u29dc.com.
- No emoji anywhere in code, docs, or output.
