## 1. Documentation

- **Framework**: [`svelte.dev/llms.txt`](https://svelte.dev/llms.txt), [`svelte.dev/docs`](https://svelte.dev/docs), [`kit.svelte.dev/docs`](https://kit.svelte.dev/docs), MCP via `mcp__svelte__*`
- **UI**: [`tailwindcss.com/docs`](https://tailwindcss.com/docs)
- **Bundler**: [`vite.dev/guide.md`](https://vite.dev/guide.md), [`vite.dev/config.md`](https://vite.dev/config.md), [`vite.dev/plugins.md`](https://vite.dev/plugins.md)
- **DevTools**: [`bun.com/docs/llms.txt`](https://bun.com/docs/llms.txt), [`biomejs.dev`](https://biomejs.dev), [`mdsvex.com/docs`](https://mdsvex.com/docs)

## 2. Repository Structure

```
.
├── src
│   ├── app.css
│   ├── app.html
│   ├── content/
│   ├── hooks.server.ts
│   ├── lib/
│   │   ├── components/
│   │   ├── server/
│   │   └── constants.ts
│   ├── routes/
│   │   ├── +layout.svelte
│   │   ├── +layout.server.ts
│   │   ├── [slug]/
│   │   ├── [slug].md/
│   │   ├── [slug].txt/
│   │   └── api/
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
└── vite.config.ts
```

## 3. Stack

| Layer      | Choice         | Notes                                                        |
| ---------- | -------------- | ------------------------------------------------------------ |
| Framework  | SvelteKit 2    | Svelte 5 runes, prefer runes over stores                     |
| Bundler    | Vite           | Via @sveltejs/vite-plugin-svelte                             |
| Styling    | Tailwind CSS 4 | Class order sorted per Biome useSortedClasses                |
| Content    | MDsveX         | MDX in `src/content/`, parsed in `src/lib/server/content.ts` |
| Runtime    | Bun            | Package manager and script runner                            |
| Linting    | Biome          | Format + lint, replaces ESLint/Prettier                      |
| Deployment | Cloudflare     | Via @sveltejs/adapter-cloudflare                             |

## 4. Commands

- `bun run dev` - Start dev server
- `bun run build` - Production build
- `bun run preview` - Preview build
- `bun run util:check` - Format, lint, types
- `bun run util:lint:fix` - Auto-fix lint
- `bun run util:types` - Typecheck
- `bun run util:clean` - Remove build and cache outputs

## 5. Architecture

- Page shells in `src/routes`, slug pages in `src/routes/[slug]`, raw endpoints in `src/routes/[slug].md`, `src/routes/[slug].txt`, and `src/routes/api/raw/[format]/[slug]`
- Site and CDN configuration in `src/lib/constants.ts`, logging and error helpers in `src/lib/logger.ts` and `src/lib/errors.ts`
- Global styles in `src/app.css` and `src/styles/*`, fonts in `src/styles/fonts.css`, static files under `static/`, media URLs from `CDN` in `src/lib/constants.ts`

## 6. Conventions

- Use aliases `$lib`, `$app`, and `@` for `src`; relative imports only for CSS and scripts
- TypeScript strict mode, no `any`, no `console`
- No emojis in code, docs, or commits
- **Security**: Preserve CSP nonce generation and `<script>` nonce injection in `src/hooks.server.ts`, keep `csp-nonce` meta and `/empty.js` nonce script in `src/routes/+layout.svelte` with `src/routes/+layout.server.ts` data
- **Headers**: Security headers (HSTS, permissions-policy, x-frame-options, referrer-policy) set in `src/hooks.server.ts`, do not weaken; 404 redirect rules for non-file paths live in `src/hooks.server.ts`
- **Raw responses**: Raw text and markdown responses must keep `X-Robots-Tag: noindex` and cache headers in `src/lib/server/raw.ts`

## 7. Quality

- No automated tests; manual QA required
- Run `bun run dev` and load the home page; verify animations, overlays, and theme with no console errors
- Visit a content page like `/patterns`; verify scroll CTA, overlays, and metadata
- Request `/llms.txt` and one slug `.md` or `.txt`; confirm raw output, headers, and artifact injection
- Check the head for `csp-nonce` and confirm scripts and styles receive the nonce; verify permissions-policy and HSTS headers
- Finish with `bun run util:check`
- Commits: Always use Conventional Commits format `type(scope): description` with body required, format as `type(scope): description` then newline then body with `- Item` bullets explaining the "why"; if commitlint.config.js exists read allowed types/scopes from there, otherwise use logical types (feat/fix/refactor/docs/chore/test) and derive scope from the area being modified
