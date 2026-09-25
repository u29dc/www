import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { articleHeaders, assertCspUrl, headersForPath, prepareBuildOutput, validateBuildOutput } from './output';

const ORIGIN = 'https://example.com';
const DATE = '2026-09-25T00:00:00.000Z';
const ARTIFACTS = [
	{ slug: 'public', public: true, published: DATE, modified: DATE, updatedAt: DATE },
	{ slug: 'private', public: false, published: DATE, modified: DATE, updatedAt: DATE },
];
const BOOT = 'globalThis.ready = true;';
const INLINE = 'globalThis.inline = true;';
const SRI = `sha512-${createHash('sha512').update(BOOT).digest('base64')}`;
const CSP = `default-src 'self'; script-src 'self' 'sha256-${createHash('sha256').update(INLINE).digest('base64')}'; img-src 'self' data: https://storage.example.com; media-src 'self' https://storage.example.com`;
const HEADERS = `/*\n  Content-Security-Policy: ${CSP}\n`;
const HTML = `<html><head><link rel="canonical" href="${ORIGIN}/"><script src="/boot.js" integrity="${SRI}"></script><script>${INLINE}</script></head><body><a href="/public/">Public</a></body></html>`;

async function fixture(t: TestContext): Promise<string> {
	const directory = await mkdtemp(path.join(tmpdir(), 'www-output-test-'));
	t.after(() => rm(directory, { recursive: true, force: true }));
	await mkdir(path.join(directory, 'public'));
	const markdown = `# Public\n\nURL: ${ORIGIN}/public/\n`;
	const files: Record<string, string> = {
		_headers: articleHeaders(HEADERS, ['public']),
		'boot.js': BOOT,
		'index.html': HTML,
		'public/index.html': HTML,
		'public.md': markdown,
		'public.txt': markdown,
		'llms.txt': '# Site\n\n' + markdown,
		'robots.txt': 'User-agent: *\nAllow: /\n',
		'feed.json': JSON.stringify({ items: [{ url: `${ORIGIN}/public/`, date_published: DATE, date_modified: DATE }] }),
		'rss.xml': `<rss><channel><lastBuildDate>${new Date(DATE).toUTCString()}</lastBuildDate><item><guid isPermaLink="true">${ORIGIN}/public/</guid></item></channel></rss>`,
		'sitemap.xml': `<urlset>${['', 'llms.txt', 'rss.xml', 'feed.json', 'public/'].map((name) => `<url><loc>${ORIGIN}/${name}</loc><lastmod>${DATE}</lastmod></url>`).join('')}</urlset>`,
	};
	await Promise.all(Object.entries(files).map(([name, contents]) => writeFile(path.join(directory, name), contents)));
	return directory;
}

test('article export rules are repeatable and exclude discovery text', () => {
	const headers = articleHeaders(HEADERS, ['public']);
	assert.equal(articleHeaders(headers, ['public']), headers);
	assert.equal(headersForPath(headers, '/public.md').get('x-robots-tag'), 'noindex');
	assert.equal(headersForPath(headers, '/public.txt').get('x-robots-tag'), 'noindex');
	assert.equal(headersForPath(headers, '/llms.txt').has('x-robots-tag'), false);
	assert.equal(headersForPath(headers, '/robots.txt').has('x-robots-tag'), false);
});

test('media origin configuration fails closed against the deployed CSP', () => {
	assert.doesNotThrow(() => assertCspUrl(CSP, 'media-src', 'https://storage.example.com/assets/movie.webm', ORIGIN));
	assert.throws(() => assertCspUrl(CSP, 'media-src', 'https://other.example/assets/', ORIGIN), /media-src blocks/);
});

test('coherent public output passes validation', async (t) => {
	await validateBuildOutput(await fixture(t), ARTIFACTS);
});

test('date-only MDX permits a feed without date_modified and retains publication fallback dates', async (t) => {
	const directory = await fixture(t);
	await writeFile(path.join(directory, 'feed.json'), JSON.stringify({ items: [{ url: `${ORIGIN}/public/`, date_published: DATE }] }));
	const root = await mkdtemp(path.join(tmpdir(), 'www-date-only-test-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	await mkdir(path.join(root, 'src/content'), { recursive: true });
	await writeFile(
		path.join(root, 'src/content/public.mdx'),
		'---\ntitle: Public\ndescription: Public article\nslug: public\ntype: fragment\nexcerpt: Public article\ndate: 2026-09-25\n---\n\nPublic article.\n',
	);
	await cp(directory, path.join(root, 'dist/client'), { recursive: true });
	await prepareBuildOutput(root);
	await writeFile(path.join(root, 'dist/client/feed.json'), JSON.stringify({ items: [{ url: `${ORIGIN}/public/`, date_published: DATE, date_modified: DATE }] }));
	await assert.rejects(prepareBuildOutput(root), /invents a modification date absent from content/);
});

test('an explicit modification date must be present and match in the feed', async (t) => {
	const directory = await fixture(t);
	await writeFile(path.join(directory, 'feed.json'), JSON.stringify({ items: [{ url: `${ORIGIN}/public/`, date_published: DATE }] }));
	await assert.rejects(validateBuildOutput(directory, ARTIFACTS), /modification date differs from content/);
	await writeFile(path.join(directory, 'feed.json'), JSON.stringify({ items: [{ url: `${ORIGIN}/public/`, date_published: DATE, date_modified: '2026-09-26T00:00:00.000Z' }] }));
	await assert.rejects(validateBuildOutput(directory, ARTIFACTS), /modification date differs from content/);
});

test('a boot script change invalidates the HTML integrity assertion', async (t) => {
	const directory = await fixture(t);
	await writeFile(path.join(directory, 'boot.js'), BOOT + '\n');
	await assert.rejects(validateBuildOutput(directory, ARTIFACTS), /integrity does not match/);
});

test('an inline script edit requires a matching CSP hash', async (t) => {
	const directory = await fixture(t);
	await writeFile(path.join(directory, 'index.html'), HTML.replace(INLINE, INLINE + '\n'));
	await assert.rejects(validateBuildOutput(directory, ARTIFACTS), /missing its CSP hash/);
});

test('broken local assets fail before deployment', async (t) => {
	const directory = await fixture(t);
	await writeFile(path.join(directory, 'index.html'), HTML.replace('</head>', '<link rel="stylesheet" href="/missing.css"></head>'));
	await assert.rejects(validateBuildOutput(directory, ARTIFACTS), /missing local target \/missing.css/);
});

test('a hidden artifact cannot gain a Markdown export', async (t) => {
	const directory = await fixture(t);
	await writeFile(path.join(directory, 'private.md'), '# Private');
	await assert.rejects(validateBuildOutput(directory, ARTIFACTS), /Markdown exports: public artifact paths differ/);
});

test('article text and Markdown exports must remain identical', async (t) => {
	const directory = await fixture(t);
	await writeFile(path.join(directory, 'public.txt'), '# Different');
	await assert.rejects(validateBuildOutput(directory, ARTIFACTS), /Markdown and text exports differ/);
});

test('feeds cannot silently omit a public article', async (t) => {
	const directory = await fixture(t);
	await writeFile(path.join(directory, 'feed.json'), '{"items":[]}');
	await assert.rejects(validateBuildOutput(directory, ARTIFACTS), /JSON Feed: public artifact paths differ/);
});

test('llms context must contain the same public article content', async (t) => {
	const directory = await fixture(t);
	await writeFile(path.join(directory, 'llms.txt'), '# Site');
	await assert.rejects(validateBuildOutput(directory, ARTIFACTS), /llms.txt is missing/);
});

test('static export directives must survive the generated header file', async (t) => {
	const directory = await fixture(t);
	const headers = await readFile(path.join(directory, '_headers'), 'utf8');
	await writeFile(path.join(directory, '_headers'), headers.replaceAll('X-Robots-Tag: noindex', 'X-Test: noindex'));
	await assert.rejects(validateBuildOutput(directory, ARTIFACTS), /missing static noindex header/);
});

test('social cards must exist in the deployable output', async (t) => {
	const directory = await fixture(t);
	await writeFile(path.join(directory, 'index.html'), HTML.replace('</head>', `<meta property="og:image" content="${ORIGIN}/missing-card.jpg"></head>`));
	await assert.rejects(validateBuildOutput(directory, ARTIFACTS), /missing local target \/missing-card.jpg/);
});

test('publication dates cannot be silently replaced by modification dates', async (t) => {
	const directory = await fixture(t);
	await writeFile(path.join(directory, 'feed.json'), JSON.stringify({ items: [{ url: `${ORIGIN}/public/`, date_published: '2026-09-24T00:00:00.000Z', date_modified: DATE }] }));
	await assert.rejects(validateBuildOutput(directory, ARTIFACTS), /publication date differs from content/);
});
