import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { minifyBuild, minifyScript } from './minify';

test('invalid JavaScript reports a source diagnostic instead of producing an empty script', () => {
	assert.throws(() => minifyScript('const = ;', 'boot.js'), /boot.js: source validation failed[\s\S]*Unexpected token/);
});

test('one malformed generated script prevents writes to all generated scripts', async (t) => {
	const directory = await mkdtemp(path.join(tmpdir(), 'www-minify-test-'));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const client = path.join(directory, 'client');
	await mkdir(client);
	const valid = 'globalThis.answer = 6 * 7;\n';
	const invalid = 'const = ;\n';
	await writeFile(path.join(client, 'valid.js'), valid);
	await writeFile(path.join(client, 'boot.js'), invalid);
	await assert.rejects(minifyBuild(directory), /source validation failed/);
	assert.equal(await readFile(path.join(client, 'valid.js'), 'utf8'), valid);
	assert.equal(await readFile(path.join(client, 'boot.js'), 'utf8'), invalid);
});

test('minification preserves expressions, comments, regular expressions and templates', () => {
	const source = 'const text = `value: ${6 * 7}`; /* keep token boundaries */ globalThis.result = [text, /a\\/b/.test("a/b"), 1 + +2];';
	const original: Record<string, unknown> = {};
	const compressed: Record<string, unknown> = {};
	runInNewContext(source, original);
	runInNewContext(minifyScript(source, 'valid.js'), compressed);
	assert.equal(JSON.stringify(compressed['result']), JSON.stringify(original['result']));
});
