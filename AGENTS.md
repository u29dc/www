## Documentation

- **Repo:** `README.md`
- **Svelte/SvelteKit:** [`svelte.dev/llms.txt`](https://svelte.dev/llms.txt), [`svelte.dev/docs`](https://svelte.dev/docs), [`kit.svelte.dev/docs`](https://kit.svelte.dev/docs), MCP via `mcp__svelte__*`
- **Vite:** [`vite.dev/guide.md`](https://vite.dev/guide.md), [`vite.dev/config.md`](https://vite.dev/config.md), [`vite.dev/plugins.md`](https://vite.dev/plugins.md)
- **Tailwind CSS:** [`tailwindcss.com/docs`](https://tailwindcss.com/docs)
- **Tooling:** [`bun.com/docs/llms.txt`](https://bun.com/docs/llms.txt), [`biomejs.dev`](https://biomejs.dev), [`mdsvex.com/docs`](https://mdsvex.com/docs)

## Repository Map

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

## Commands

- `bun run dev` - start dev server
- `bun run build` - production build
- `bun run preview` - preview build
- `bun run util:check` - format, lint, types
- `bun run util:lint:fix` - auto-fix lint
- `bun run util:types` - typecheck
- `bun run util:clean` - remove build and cache outputs

## Architecture

- SvelteKit 2 + Svelte 5 runes; prefer runes over stores
- MDX content in `src/content/`, parsed in `src/lib/server/content.ts`, enabled by mdsvex in `svelte.config.js`
- Page shells in `src/routes`, slug pages in `src/routes/[slug]`
- Raw endpoints in `src/routes/[slug].md`, `src/routes/[slug].txt`, and `src/routes/api/raw/[format]/[slug]`
- Site and CDN configuration in `src/lib/constants.ts`
- Logging and error helpers in `src/lib/logger.ts` and `src/lib/errors.ts`

## Conventions

- Use aliases `$lib`, `$app`, and `@` for `src`; relative imports only for CSS and scripts
- TypeScript strict; no `any`, no `console`
- Tailwind CSS 4; keep class order sorted per Biome `useSortedClasses`
- Global styles in `src/app.css` and `src/styles/*`; fonts in `src/styles/fonts.css`
- Assets: static files under `static/`; media URLs from `CDN` in `src/lib/constants.ts`
- Commit messages must pass commitlint: required type+scope, lowercase subject, <=100 chars (see `commitlint.config.js`)
- No emojis in code, docs, or commits

## Security

- Preserve CSP nonce generation and `<script>` nonce injection in `src/hooks.server.ts`
- Keep `csp-nonce` meta and `/empty.js` nonce script in `src/routes/+layout.svelte` with `src/routes/+layout.server.ts` data
- Security headers (HSTS, permissions-policy, x-frame-options, referrer-policy) are set in `src/hooks.server.ts`; do not weaken
- 404 redirect rules for non-file paths live in `src/hooks.server.ts`; keep behavior
- Raw text and markdown responses must keep `X-Robots-Tag: noindex` and cache headers in `src/lib/server/raw.ts`

## QA

- No automated tests; manual QA required
- Run `bun run dev` and load the home page; verify animations, overlays, and theme with no console errors
- Visit a content page like `/patterns`; verify scroll CTA, overlays, and metadata
- Request `/llms.txt` and one slug `.md` or `.txt`; confirm raw output, headers, and artifact injection
- Check the head for `csp-nonce` and confirm scripts and styles receive the nonce; verify permissions-policy and HSTS headers
- Finish with `bun run util:check`
