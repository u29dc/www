#!/usr/bin/env bun

/**
 * patterns.ts - Custom architectural pattern enforcement
 *
 * Enforces project-specific rules that linters cannot detect.
 *
 * Usage:
 *   bun scripts/patterns.ts     # Check all patterns
 *   bun run util:patterns       # Via package.json script
 */

import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { Glob } from 'bun';
import { colors, runScript, Timer } from './utils';

const EXCLUDED_DIRECTORIES = ['node_modules', '.next', 'dist', 'out', 'build'] as const;

// pattern-ignore: no-inline-types - Script-specific type that should remain colocated with implementation
interface Violation {
	file: string;
	line: number;
	rule: string;
	message: string;
}

type LineChecker = (line: string, lineNumber: number, filePath: string) => Violation | null;

/**
 * Unified file checker that runs multiple line checkers in a single pass
 */
async function checkFile(filePath: string, checkers: LineChecker[]): Promise<Violation[]> {
	const violations: Violation[] = [];
	const content = await readFile(filePath, 'utf-8');
	const lines = content.split('\n');

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;

		for (const checker of checkers) {
			const violation = checker(line, i + 1, filePath);
			if (violation) {
				violations.push(violation);
			}
		}
	}

	return violations;
}

/**
 * Checker for emoji characters
 */
const emojiChecker: LineChecker = (line, lineNumber, filePath) => {
	const emojiRegex =
		/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

	if (emojiRegex.test(line)) {
		return {
			file: filePath,
			line: lineNumber,
			rule: 'no-emoji',
			message: 'Emoji characters are not allowed in code',
		};
	}
	return null;
};

/**
 * Checker for relative imports
 */
const absoluteImportsChecker: LineChecker = (line, lineNumber, filePath) => {
	const trimmedLine = line.trim();
	const relativeImportRegex = /^import\s+.*\s+from\s+['"](\.\.|\.\/)/;

	if (relativeImportRegex.test(trimmedLine)) {
		// Skip CSS imports and scripts directory
		if (line.includes('.css') || filePath.includes('scripts/')) {
			return null;
		}

		return {
			file: filePath,
			line: lineNumber,
			rule: 'no-relative-imports',
			message: 'Use absolute imports with @/ alias instead of relative imports',
		};
	}
	return null;
};

/**
 * Main execution
 */
async function main(): Promise<void> {
	const timer = new Timer();

	// Find all TypeScript/TSX files
	const glob = new Glob('**/*.{ts,tsx}');
	const files = Array.from(glob.scanSync({ cwd: process.cwd(), absolute: false })).filter(
		(file) => !EXCLUDED_DIRECTORIES.some((dir) => file.includes(dir)),
	);

	// Run checks in parallel using unified checker
	const fileChecks = files.map(async (file) => {
		const filePath = join(process.cwd(), file);

		try {
			const violations = await checkFile(filePath, [emojiChecker, absoluteImportsChecker]);
			return { violations };
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			return { error: { file, reason } };
		}
	});

	const results = await Promise.all(fileChecks);

	const allViolations: Violation[] = [];
	const skippedFiles: Array<{ file: string; reason: string }> = [];

	for (const result of results) {
		if ('violations' in result) {
			allViolations.push(...result.violations);
		} else {
			skippedFiles.push(result.error);
		}
	}

	// Report skipped files after violations
	if (skippedFiles.length > 0) {
		console.log(
			`\n${colors.yellow}Warning: ${skippedFiles.length} files could not be checked:${colors.reset}`,
		);
		for (const { file, reason } of skippedFiles) {
			console.log(`  ${colors.dim}${file}: ${reason}${colors.reset}`);
		}
	}

	// Report violations
	if (allViolations.length === 0) {
		console.log(
			`${colors.blue}Checked ${files.length} files in ${timer.elapsedFormatted()}. No pattern violations found.${colors.reset}`,
		);
		return;
	}

	// Group by rule
	const violationsByRule = new Map<string, Violation[]>();
	for (const violation of allViolations) {
		const existing = violationsByRule.get(violation.rule) ?? [];
		existing.push(violation);
		violationsByRule.set(violation.rule, existing);
	}

	// Print violations grouped by rule
	for (const [rule, violations] of violationsByRule) {
		console.log(`${colors.red}${rule}${colors.reset} (${violations.length} violations)`);

		for (const violation of violations) {
			const relPath = relative(process.cwd(), violation.file);
			console.log(
				`  ${colors.cyan}${relPath}:${violation.line}${colors.reset} - ${violation.message}`,
			);
		}

		console.log('');
	}

	console.log(
		`Checked ${files.length} files in ${timer.elapsedFormatted()}. Found ${allViolations.length} violations.`,
	);
	process.exit(1);
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
	runScript(main, 'patterns');
}
