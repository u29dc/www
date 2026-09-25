import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify as minifyHtml } from '@minify-html/node';
import { parse, serialize, type DefaultTreeAdapterMap } from 'parse5';
import { minifySync, parseSync } from 'rolldown/utils';

interface FileResult {
	path: string;
	before: number;
	after: number;
	changed: boolean;
}

const bootScriptPath = '/boot.js';
const targetExtensions = new Set(['.js', '.mjs']);
const htmlExtension = '.html';
const htmlMinifyOptions = {
	keep_closing_tags: true,
	keep_html_and_head_opening_tags: true,
} as const;

type HtmlDocument = DefaultTreeAdapterMap['document'];
type HtmlChildNode = DefaultTreeAdapterMap['childNode'];
type HtmlElement = DefaultTreeAdapterMap['element'];

function byteLength(value: string): number {
	return Buffer.byteLength(value, 'utf8');
}

async function collectScriptTargets(directory: string, files: string[] = []): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });

	for (const entry of entries) {
		const entryPath = path.join(directory, entry.name);

		if (entry.isDirectory()) {
			await collectScriptTargets(entryPath, files);
			continue;
		}

		if (entry.isFile() && targetExtensions.has(path.extname(entry.name))) {
			files.push(entryPath);
		}
	}

	return files;
}

async function collectHtmlTargets(directory: string, files: string[] = []): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });

	for (const entry of entries) {
		const entryPath = path.join(directory, entry.name);

		if (entry.isDirectory()) {
			await collectHtmlTargets(entryPath, files);
			continue;
		}

		if (entry.isFile() && path.extname(entry.name) === htmlExtension) {
			files.push(entryPath);
		}
	}

	return files;
}

function isElement(node: HtmlDocument | HtmlChildNode): node is HtmlElement {
	return 'tagName' in node && 'attrs' in node;
}

function setAttribute(element: HtmlElement, name: string, value: string): boolean {
	const attribute = element.attrs.find((item) => item.name === name);
	if (attribute) {
		if (attribute.value === value) return false;
		attribute.value = value;
		return true;
	}

	element.attrs.push({ name, value });
	return true;
}

function patchBootScriptIntegrityNode(node: HtmlDocument | HtmlChildNode, integrity: string): number {
	let patched = 0;

	if (isElement(node) && node.tagName === 'script') {
		const source = node.attrs.find((attribute) => attribute.name === 'src')?.value;
		if (source === bootScriptPath) {
			const didPatchIntegrity = setAttribute(node, 'integrity', integrity);
			const didPatchCrossorigin = setAttribute(node, 'crossorigin', 'anonymous');
			if (didPatchIntegrity || didPatchCrossorigin) patched += 1;
		}
	}

	if ('childNodes' in node) {
		for (const child of node.childNodes) {
			patched += patchBootScriptIntegrityNode(child, integrity);
		}
	}

	return patched;
}

async function computeBootScriptIntegrity(clientDistPath: string): Promise<string> {
	const filePath = path.join(clientDistPath, bootScriptPath);
	const source = await readFile(filePath);
	const hash = createHash('sha512').update(source).digest('base64');
	return `sha512-${hash}`;
}

async function patchBootScriptIntegrity(clientDistPath: string, integrity: string): Promise<number> {
	const htmlTargets = await collectHtmlTargets(clientDistPath);
	let patchedFiles = 0;

	for (const filePath of htmlTargets) {
		const source = await readFile(filePath, 'utf8');
		const document = parse(source);
		const patchedScripts = patchBootScriptIntegrityNode(document, integrity);
		if (patchedScripts === 0) continue;

		await writeFile(filePath, serialize(document));
		patchedFiles += 1;
	}

	return patchedFiles;
}

function assertNoDiagnostics(filePath: string, stage: string, errors: readonly { message: string }[]): void {
	if (errors.length > 0) {
		throw new Error(`${filePath}: ${stage} failed\n${errors.map((error) => error.message).join('\n')}`);
	}
}

export function minifyScript(source: string, filePath: string): string {
	assertNoDiagnostics(filePath, 'source validation', parseSync(filePath, source, { sourceType: 'module' }).errors);
	const result = minifySync(filePath, source, {
		module: true,
		compress: false,
		mangle: false,
		codegen: {
			removeWhitespace: true,
		},
		sourcemap: false,
	});
	assertNoDiagnostics(filePath, 'minification', result.errors);
	assertNoDiagnostics(filePath, 'output validation', parseSync(filePath, result.code, { sourceType: 'module' }).errors);
	return result.code;
}

async function prepareScriptFile(filePath: string): Promise<{ result: FileResult; code: string; filePath: string }> {
	const source = await readFile(filePath, 'utf8');
	const code = minifyScript(source, filePath);

	const before = byteLength(source);
	const after = byteLength(code);
	const changed = code !== source && after <= before;

	return {
		filePath,
		code,
		result: {
			path: path.relative(process.cwd(), filePath),
			before,
			after: changed ? after : before,
			changed,
		},
	};
}

async function minifyHtmlFile(filePath: string): Promise<FileResult> {
	const source = await readFile(filePath);
	const result = minifyHtml(source, htmlMinifyOptions);

	const before = source.byteLength;
	const after = result.byteLength;
	const changed = !source.equals(result) && after <= before;

	if (changed) {
		await writeFile(filePath, result);
	}

	return {
		path: path.relative(process.cwd(), filePath),
		before,
		after: changed ? after : before,
		changed,
	};
}

function reportResults(label: string, results: FileResult[]): void {
	const changed = results.filter((result) => result.changed);
	const before = results.reduce((total, result) => total + result.before, 0);
	const after = results.reduce((total, result) => total + result.after, 0);
	const saved = before - after;

	for (const result of changed) {
		const savedForFile = result.before - result.after;
		console.log(`${result.path}: ${result.before} -> ${result.after} bytes (-${savedForFile})`);
	}

	console.log(`Minified ${changed.length}/${results.length} ${label} files. ${before} -> ${after} bytes (-${saved}).`);
}

export async function minifyBuild(directory = 'dist'): Promise<void> {
	const distPath = path.resolve(directory);
	const clientDistPath = path.join(distPath, 'client');
	const exists = await stat(distPath)
		.then((details) => details.isDirectory())
		.catch(() => false);

	if (!exists) {
		throw new Error('dist directory does not exist. Run the Astro build first.');
	}

	const scriptTargets = await collectScriptTargets(distPath);
	const scripts = await Promise.all(scriptTargets.map((filePath) => prepareScriptFile(filePath)));
	// Validate every source and result before replacing any generated JavaScript.
	await Promise.all(scripts.filter(({ result }) => result.changed).map(({ filePath, code }) => writeFile(filePath, code)));
	reportResults(
		'JS',
		scripts.map(({ result }) => result),
	);

	const integrity = await computeBootScriptIntegrity(clientDistPath);
	const patchedFiles = await patchBootScriptIntegrity(clientDistPath, integrity);
	const htmlTargets = await collectHtmlTargets(clientDistPath);
	const htmlResults = await Promise.all(htmlTargets.map((filePath) => minifyHtmlFile(filePath)));
	reportResults('HTML', htmlResults);

	console.log(`Added ${integrity.slice(0, 19)}... SRI for ${bootScriptPath} in ${patchedFiles} HTML files.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
	await minifyBuild();
}
