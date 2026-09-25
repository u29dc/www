import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';

const execFileAsync = promisify(execFile);
const repository = fileURLToPath(new URL('../', import.meta.url));
const astroCli = fileURLToPath(new URL('./bin/astro.mjs', import.meta.resolve('astro/package.json')));

test('MDX collection styles and scripts survive bundling without directive warnings', { timeout: 30_000 }, async (t) => {
	const directory = await mkdtemp(path.join(tmpdir(), 'www-astro-assets-'));
	t.after(() => rm(directory, { recursive: true, force: true }));
	await symlink(path.join(repository, 'node_modules'), path.join(directory, 'node_modules'), 'dir');
	const files: Record<string, string> = {
		'package.json': JSON.stringify({ type: 'module' }),
		'astro.config.mjs': `
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
export default defineConfig({
	integrations: [mdx()],
	build: { inlineStylesheets: 'never' },
});
`,
		'src/content.config.ts': `
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
export const collections = {
	articles: defineCollection({ loader: glob({ base: './src/content', pattern: '*.mdx' }) }),
};
`,
		'src/content/example.mdx': `
import Artwork from '../components/Artwork.astro';

# Asset propagation

<Artwork />
`,
		'src/components/Artwork.astro': `
<div class="artwork">Rendered artwork</div>
<style>.artwork { --propagation-proof: 1; color: red; }</style>
<script>document.documentElement.dataset.propagationProof = 'loaded';</script>
`,
		'src/pages/index.astro': `
---
import { getEntry, render } from 'astro:content';
const entry = await getEntry('articles', 'example');
const { Content } = await render(entry!);
---
<html lang="en"><head><title>Asset propagation</title></head><body><Content /></body></html>
`,
	};
	for (const [relativePath, contents] of Object.entries(files)) {
		const file = path.join(directory, relativePath);
		await mkdir(path.dirname(file), { recursive: true });
		await writeFile(file, contents);
	}

	const { stdout, stderr } = await execFileAsync('node', [astroCli, 'build'], {
		cwd: directory,
		timeout: 25_000,
		env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', NO_COLOR: '1' },
	});
	const html = await readFile(path.join(directory, 'dist/index.html'), 'utf8');
	assert.match(html, /Rendered artwork/);
	const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? '';
	const stylesheet = head.match(/<link\b[^>]*href="([^"]+\.css)"/)?.[1];
	assert.ok(stylesheet, 'MDX-only component stylesheet must be linked in the page head');
	const css = await readFile(path.join(directory, 'dist', stylesheet), 'utf8');
	assert.match(css, /--propagation-proof:\s*1/);
	assert.match(css, /\.artwork\[data-astro-cid-/);
	assert.match(html, /class="artwork" data-astro-cid-/);
	const script = html.match(/<script\b[^>]*src="([^"]+\.js)"/)?.[1];
	const scriptSource = script ? await readFile(path.join(directory, 'dist', script), 'utf8') : html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/)?.[1];
	assert.match(scriptSource ?? '', /propagationProof/, 'MDX-only component script must reach the rendered page');
	assert.doesNotMatch(stdout + stderr, /\[WARN\]|MODULE_LEVEL_DIRECTIVE|use astro:head-inject/);
});
