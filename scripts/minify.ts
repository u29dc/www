import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { minifySync, parseSync } from 'rolldown/utils';

interface FileResult {
	path: string;
	before: number;
	after: number;
	changed: boolean;
}

const distPath = path.resolve('dist');
const targetExtensions = new Set(['.js', '.mjs']);

function byteLength(value: string): number {
	return Buffer.byteLength(value, 'utf8');
}

async function collectTargets(directory: string, files: string[] = []): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });

	for (const entry of entries) {
		const entryPath = path.join(directory, entry.name);

		if (entry.isDirectory()) {
			await collectTargets(entryPath, files);
			continue;
		}

		if (entry.isFile() && targetExtensions.has(path.extname(entry.name))) {
			files.push(entryPath);
		}
	}

	return files;
}

async function minifyFile(filePath: string): Promise<FileResult> {
	const source = await readFile(filePath, 'utf8');
	const result = minifySync(filePath, source, {
		module: true,
		compress: false,
		mangle: false,
		codegen: {
			removeWhitespace: true,
		},
		sourcemap: false,
	});

	parseSync(filePath, result.code, {
		sourceType: 'module',
	});

	const before = byteLength(source);
	const after = byteLength(result.code);
	const changed = result.code !== source && after <= before;

	if (changed) {
		await writeFile(filePath, result.code);
	}

	return {
		path: path.relative(process.cwd(), filePath),
		before,
		after: changed ? after : before,
		changed,
	};
}

async function main(): Promise<void> {
	const exists = await stat(distPath)
		.then((details) => details.isDirectory())
		.catch(() => false);

	if (!exists) {
		throw new Error('dist directory does not exist. Run the Astro build first.');
	}

	const targets = await collectTargets(distPath);
	const results = await Promise.all(targets.map((filePath) => minifyFile(filePath)));
	const changed = results.filter((result) => result.changed);
	const before = results.reduce((total, result) => total + result.before, 0);
	const after = results.reduce((total, result) => total + result.after, 0);
	const saved = before - after;

	for (const result of changed) {
		const savedForFile = result.before - result.after;
		console.log(`${result.path}: ${result.before} -> ${result.after} bytes (-${savedForFile})`);
	}

	console.log(`Minified ${changed.length}/${results.length} JS files. ${before} -> ${after} bytes (-${saved}).`);
}

await main();
