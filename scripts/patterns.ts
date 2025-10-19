#!/usr/bin/env bun

/**
 * patterns.ts - Enforce architectural patterns
 */

import { cpus } from 'node:os';
import { basename, extname, join, relative } from 'node:path';
import ts from 'typescript';
import { colors, parseFlags, runScript, Timer } from './utils';

// ==================================================
// CONFIGURATION
// ==================================================

const TEXT_EXTENSIONS = new Set([
	'.ts',
	'.tsx',
	'.js',
	'.jsx',
	'.mjs',
	'.cjs',
	'.json',
	'.md',
	'.txt',
	'.yml',
	'.yaml',
	'.css',
	'.scss',
]);
const SCRIPT_KIND_BY_EXT: Record<string, ts.ScriptKind | undefined> = {
	'.ts': ts.ScriptKind.TS,
	'.tsx': ts.ScriptKind.TSX,
	'.js': ts.ScriptKind.JS,
	'.jsx': ts.ScriptKind.JSX,
	'.mjs': ts.ScriptKind.JS,
	'.cjs': ts.ScriptKind.JS,
};
const IGNORE_SEGMENTS = [
	'/node_modules/',
	'/.git/',
	'/.next/',
	'/dist/',
	'/build/',
	'/coverage/',
	'/.cache/',
];
const IGNORE_FILE_NAMES = new Set(['bun.lockb', 'patterns.ts']);

const EMOJI_REGEX =
	/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F7E0}-\u{1F7EB}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]|\u{1F3FB}[\u{1F3FB}-\u{1F3FF}]?|\u{200D}|\u{FE0F}/gu;
const TREE_CHARS = new Set([
	'├',
	'─',
	'└',
	'│',
	'┌',
	'┐',
	'┘',
	'┴',
	'┬',
	'┤',
	'┼',
	'╭',
	'╮',
	'╯',
	'╰',
	'╱',
	'╲',
	'╳',
]);
const CHECKMARK_EMOJIS = ['✅', '☑️', '✔️', '✔', '✓'];
const CROSS_EMOJIS = ['❌', '❎', '✖️', '✖', '✗', '❗', '‼️'];

// Parallelization constants
const CPU_COUNT = Math.max(1, cpus().length);
const BATCH_SIZE = Math.min(128, Math.max(24, CPU_COUNT * 12));

function checkRelativeImportDeclaration(
	declaration: ts.ImportDeclaration | ts.ExportDeclaration,
	file: FileContext,
	ast: ts.SourceFile,
): Violation | null {
	if (hasPatternIgnore(declaration, ast, 'no-relative-imports')) return null;

	const moduleSpecifier = ts.isImportDeclaration(declaration)
		? declaration.moduleSpecifier
		: (declaration as ts.ExportDeclaration).moduleSpecifier;

	if (!moduleSpecifier || !ts.isStringLiteralLike(moduleSpecifier)) return null;

	const importPath = moduleSpecifier.text;
	if (importPath.endsWith('.css') || importPath.endsWith('.scss')) return null;

	const location = positionToLocation(ast, moduleSpecifier.getStart(ast));
	const importType = ts.isImportDeclaration(declaration) ? 'Import' : 'Re-export';

	return {
		line: location.line,
		column: location.column,
		message: `${importType} uses relative path "${importPath}" - use absolute imports (@/...)`,
		context: file.lines[location.line - 1]?.trim() ?? '',
		ruleId: 'no-relative-imports',
	};
}

const RULES: PatternRule[] = [
	{
		id: 'no-emoji',
		name: 'No Emoji Characters',
		description: 'Prevents emoji characters in code for professional consistency',
		appliesTo: (file) => TEXT_EXTENSIONS.has(file.ext),
		check: (file) => {
			const violations: Violation[] = [];
			for (let i = 0; i < file.lines.length; i++) {
				const line = file.lines[i];
				if (!line) continue;
				EMOJI_REGEX.lastIndex = 0;
				for (
					let match = EMOJI_REGEX.exec(line);
					match !== null;
					match = EMOJI_REGEX.exec(line)
				) {
					if (TREE_CHARS.has(match[0])) continue;
					violations.push({
						line: i + 1,
						column: match.index + 1,
						message: `Emoji "${match[0]}" found`,
						context: line.trim(),
						ruleId: 'no-emoji',
					});
				}
				for (const emoji of [...CHECKMARK_EMOJIS, ...CROSS_EMOJIS]) {
					let idx = line.indexOf(emoji);
					while (idx !== -1) {
						violations.push({
							line: i + 1,
							column: idx + 1,
							message: `Emoji "${emoji}" found`,
							context: line.trim(),
							ruleId: 'no-emoji',
						});
						idx = line.indexOf(emoji, idx + emoji.length);
					}
				}
			}
			const seen = new Set<string>();
			return violations.filter((v) => {
				const key = `${v.line}:${v.column}:${v.message}`;
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			});
		},
	},
	{
		id: 'no-relative-imports',
		name: 'No Relative Imports',
		description: 'Use absolute imports (@/...) instead of relative imports',
		appliesTo: (file) =>
			!!file.ast &&
			(file.ext === '.ts' || file.ext === '.tsx') &&
			file.pathPosix.includes('/src/'),
		check: (file) => {
			if (!file.ast) return [];
			const violations: Violation[] = [];
			for (const declaration of findRelativeImports(file.ast)) {
				const violation = checkRelativeImportDeclaration(declaration, file, file.ast);
				if (violation) violations.push(violation);
			}
			return violations;
		},
	},
];

// ==================================================
// ENGINE
// ==================================================

interface Violation {
	line: number;
	column: number;
	message: string;
	context: string;
	ruleId: string;
}

interface FileContext {
	path: string;
	pathPosix: string;
	ext: string;
	content: string;
	lines: string[];
	ast?: ts.SourceFile;
}

interface PatternRule {
	id: string;
	name: string;
	description: string;
	appliesTo(file: FileContext): boolean;
	check(file: FileContext): Violation[];
}

function toPosixPath(path: string): string {
	return path.replace(/\\/g, '/');
}

function parseAst(context: FileContext): ts.SourceFile | undefined {
	const scriptKind = SCRIPT_KIND_BY_EXT[context.ext] ?? ts.ScriptKind.TS;
	return ts.createSourceFile(
		context.path,
		context.content,
		ts.ScriptTarget.Latest,
		true,
		scriptKind,
	);
}

function positionToLocation(ast: ts.SourceFile, pos: number): { line: number; column: number } {
	const { line, character } = ast.getLineAndCharacterOfPosition(pos);
	return { line: line + 1, column: character + 1 };
}

function checkCommentRangesForIgnore(
	ranges: readonly ts.CommentRange[],
	text: string,
	ignorePattern: RegExp,
): boolean {
	for (const range of ranges) {
		const comment = text.slice(range.pos, range.end);
		const match = ignorePattern.exec(comment);
		if (match?.[1]?.trim()) return true;
	}
	return false;
}

function getVariableDeclarationRelatedNodes(node: ts.VariableDeclaration): ts.Node[] {
	const relatedNodes: ts.Node[] = [];
	if (node.parent) {
		relatedNodes.push(node.parent);
		if (node.parent.parent) relatedNodes.push(node.parent.parent);
	}
	return relatedNodes;
}

function hasPatternIgnore(node: ts.Node, ast: ts.SourceFile, ruleId: string): boolean {
	const text = ast.getFullText();
	const leading = ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [];
	const trailing = ts.getTrailingCommentRanges(text, node.getEnd()) ?? [];
	const ignorePattern = new RegExp(`pattern-ignore:\\s*${ruleId}\\s*[-–—]\\s*(.+)`);

	if (checkCommentRangesForIgnore([...leading, ...trailing], text, ignorePattern)) {
		return true;
	}

	if (ts.isVariableDeclaration(node)) {
		const relatedNodes = getVariableDeclarationRelatedNodes(node);
		for (const related of relatedNodes) {
			const relLeading = ts.getLeadingCommentRanges(text, related.getFullStart()) ?? [];
			const relTrailing = ts.getTrailingCommentRanges(text, related.getEnd()) ?? [];
			if (checkCommentRangesForIgnore([...relLeading, ...relTrailing], text, ignorePattern)) {
				return true;
			}
		}
	}

	return false;
}

function findRelativeImports(
	ast: ts.SourceFile,
): Array<ts.ImportDeclaration | ts.ExportDeclaration> {
	const relativeImports: Array<ts.ImportDeclaration | ts.ExportDeclaration> = [];
	function visit(node: ts.Node): void {
		if (
			ts.isImportDeclaration(node) &&
			node.moduleSpecifier &&
			ts.isStringLiteralLike(node.moduleSpecifier)
		) {
			const path = node.moduleSpecifier.text;
			if (path === '.' || path.startsWith('./') || path.startsWith('../'))
				relativeImports.push(node);
		}
		if (
			ts.isExportDeclaration(node) &&
			node.moduleSpecifier &&
			ts.isStringLiteralLike(node.moduleSpecifier)
		) {
			const path = node.moduleSpecifier.text;
			if (path === '.' || path.startsWith('./') || path.startsWith('../'))
				relativeImports.push(node);
		}
		ts.forEachChild(node, visit);
	}
	visit(ast);
	return relativeImports;
}

async function listGitTrackedFiles(): Promise<string[]> {
	try {
		const proc = Bun.spawn(['git', 'ls-files'], { stdout: 'pipe', stderr: 'pipe' });
		const output = await new Response(proc.stdout).text();
		await proc.exited;
		if (proc.exitCode !== 0) return [];
		const cwd = process.cwd();
		return output
			.split('\n')
			.filter(Boolean)
			.map((path) => join(cwd, path));
	} catch {
		return [];
	}
}

function shouldIncludePath(absolutePath: string): boolean {
	const posixPath = toPosixPath(absolutePath);
	if (IGNORE_SEGMENTS.some((segment) => posixPath.includes(segment))) return false;
	if (IGNORE_FILE_NAMES.has(basename(posixPath))) return false;
	return TEXT_EXTENSIONS.has(extname(posixPath).toLowerCase());
}

async function discoverFiles(): Promise<string[]> {
	const gitFiles = await listGitTrackedFiles();
	const selected = new Set<string>();

	if (gitFiles.length > 0) {
		gitFiles.forEach((path) => {
			if (shouldIncludePath(path)) selected.add(path);
		});
		return Array.from(selected).sort();
	}

	const glob = new Bun.Glob('**/*');
	for await (const path of glob.scan({ cwd: process.cwd(), absolute: true })) {
		if (shouldIncludePath(path)) selected.add(path);
	}
	return Array.from(selected).sort();
}

async function readFile(path: string): Promise<FileContext> {
	const file = Bun.file(path);
	const content = await file.text();
	const ext = extname(path).toLowerCase();
	const context: FileContext = {
		path,
		pathPosix: toPosixPath(path),
		ext,
		content,
		lines: content.split('\n'),
	};
	if (SCRIPT_KIND_BY_EXT[ext] !== undefined) {
		context.ast = parseAst(context);
	}
	return context;
}

async function runChecker(): Promise<boolean> {
	const timer = new Timer();
	const filePaths = await discoverFiles();

	const summaries = RULES.map((rule) => ({
		rule,
		files: [] as Array<{ path: string; violations: Violation[] }>,
		totalViolations: 0,
	}));

	for (let index = 0; index < filePaths.length; index += BATCH_SIZE) {
		const batchPaths = filePaths.slice(index, index + BATCH_SIZE);
		const contexts = await Promise.all(batchPaths.map(readFile));
		for (const file of contexts) {
			for (const summary of summaries) {
				if (!summary.rule.appliesTo(file)) continue;
				const violations = summary.rule.check(file);
				if (violations.length === 0) continue;
				summary.files.push({ path: file.path, violations });
				summary.totalViolations += violations.length;
			}
		}
	}

	return printResults(summaries, filePaths.length, timer);
}

function printResults(
	summaries: Array<{
		rule: PatternRule;
		files: Array<{ path: string; violations: Violation[] }>;
		totalViolations: number;
	}>,
	fileCount: number,
	timer: Timer,
): boolean {
	const totalViolations = summaries.reduce((sum, s) => sum + s.totalViolations, 0);
	const problemRules = summaries.filter((s) => s.totalViolations > 0);

	if (totalViolations === 0) {
		console.log(
			`${colors.blue}Scanned ${fileCount} files in ${timer.elapsedFormatted()}. No patterns violated.${colors.reset}`,
		);
		return true;
	}

	for (const summary of problemRules) {
		console.log(`\n${summary.rule.name}`);
		console.log(`  ${colors.dim}${summary.rule.description}${colors.reset}`);
		for (const file of summary.files) {
			const relativePath = relative(process.cwd(), file.path);
			console.log(`\n  ${colors.cyan}${relativePath}${colors.reset}`);
			for (const violation of file.violations) {
				console.log(
					`    ${colors.dim}${violation.line}:${violation.column}${colors.reset}  ${colors.red}error${colors.reset}  ${violation.message}  ${colors.dim}${violation.ruleId}${colors.reset}`,
				);
				if (violation.context)
					console.log(`      ${colors.dim}>${colors.reset} ${violation.context}`);
			}
		}
	}

	const problemFileCount = problemRules.reduce((sum, s) => sum + s.files.length, 0);
	const issueWord = totalViolations === 1 ? 'problem' : 'problems';
	const fileWord = problemFileCount === 1 ? 'file' : 'files';
	console.log(
		`\n${colors.blue}Scanned ${fileCount} files in ${timer.elapsedFormatted()}. Found ${colors.red}${totalViolations}${colors.reset} ${issueWord} in ${colors.cyan}${problemFileCount}${colors.reset} ${fileWord}.${colors.reset}`,
	);
	return false;
}

async function main(): Promise<void> {
	const flags = parseFlags();
	if (flags.has('help') || flags.has('h')) {
		console.log('Usage: bun scripts/patterns.ts');
		console.log('Edit RULES in CONFIGURATION to add/remove patterns.');
		return;
	}

	const passed = await runChecker();
	if (!passed) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	runScript(main, 'patterns');
}
