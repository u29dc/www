#!/usr/bin/env bun

/**
 * clean.ts - Clean build artifacts and dev ports
 */

import { rm, stat } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
import { Glob, spawn } from 'bun';
import { colors, parseFlags, runScript, Timer } from './utils';

// ==================================================
// CONFIGURATION
// ==================================================

type RemovalResult = {
	path: string;
	removed: boolean;
	error?: string;
};

const CLEAN_PATHS = ['.next', 'out', 'dist', 'build'] as const;
const CLEAN_PATTERNS = ['*.tsbuildinfo'] as const;
const CLEAN_PORTS = [3000, 3001, 3002, 3003] as const;
// Delay to ensure SIGTERM is processed before continuing
const PROCESS_KILL_GRACE_PERIOD_MS = 100;

// ==================================================
// UTILITIES
// ==================================================

async function removePath(path: string): Promise<RemovalResult> {
	try {
		await stat(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return { path, removed: false };
		}
		throw error;
	}

	try {
		await rm(path, { recursive: true, force: true });
		return { path, removed: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { path, removed: false, error: message };
	}
}

async function killPortProcess(port: number): Promise<boolean> {
	try {
		const proc = spawn(['lsof', `-i:${port}`, '-t'], {
			stdout: 'pipe',
			stderr: 'pipe',
		});

		const output = await new Response(proc.stdout).text();
		await proc.exited;

		if (proc.exitCode !== 0 || !output.trim()) {
			return false;
		}

		const pid = Number.parseInt(output.trim(), 10);
		if (!Number.isNaN(pid)) {
			try {
				process.kill(pid, 'SIGTERM');
				await Bun.sleep(PROCESS_KILL_GRACE_PERIOD_MS);
				return true;
			} catch {
				return false;
			}
		}

		return false;
	} catch {
		return false;
	}
}

function queueRemoval(targetPath: string, label?: string): Promise<RemovalResult> {
	const absolutePath = isAbsolute(targetPath) ? targetPath : join(process.cwd(), targetPath);
	return removePath(absolutePath).then((result) => ({
		...result,
		path: label ?? relative(process.cwd(), absolutePath),
	}));
}

// ==================================================
// OPERATIONS
// ==================================================

function queueArtifactRemovals(): Promise<RemovalResult>[] {
	const removalTasks: Promise<RemovalResult>[] = [];

	// Clean directories
	for (const dir of CLEAN_PATHS) {
		const fullPath = join(process.cwd(), dir);
		removalTasks.push(queueRemoval(fullPath, dir));
	}

	// Find and clean files matching patterns
	for (const pattern of CLEAN_PATTERNS) {
		const glob = new Glob(pattern);
		const files = Array.from(glob.scanSync());
		for (const file of files) {
			removalTasks.push(queueRemoval(file));
		}
	}

	return removalTasks;
}

async function cleanPorts(): Promise<number> {
	const killResults = await Promise.all(
		CLEAN_PORTS.map(async (port) => {
			const killed = await killPortProcess(port);
			return { killed };
		}),
	);

	let portsKilled = 0;
	for (const { killed } of killResults) {
		if (killed) {
			portsKilled++;
		}
	}

	return portsKilled;
}

// ==================================================
// REPORTING
// ==================================================

function reportRemovalResults(removalResults: RemovalResult[]): {
	cleanedCount: number;
	failureCount: number;
} {
	let cleanedCount = 0;
	let failureCount = 0;

	for (const { removed, error } of removalResults) {
		if (removed) {
			cleanedCount++;
		} else if (error) {
			failureCount++;
		}
	}

	return { cleanedCount, failureCount };
}

function printCleanupSummary(
	cleanedCount: number,
	portsKilled: number,
	failureCount: number,
	skipPorts: boolean,
	timer: Timer,
): void {
	if (failureCount > 0) {
		const failureWord = failureCount === 1 ? 'failure' : 'failures';
		const artifactWord = cleanedCount === 1 ? 'artifact' : 'artifacts';
		console.log(
			`${colors.blue}Cleaned ${cleanedCount} ${artifactWord} with ${colors.red}${failureCount}${colors.reset} ${failureWord} in ${timer.elapsedFormatted()}.${colors.reset}`,
		);
		process.exitCode = 1;
	} else {
		const artifactWord = cleanedCount === 1 ? 'artifact' : 'artifacts';
		const portSummary =
			skipPorts || portsKilled === 0
				? ''
				: `, cleared ${portsKilled} ${portsKilled === 1 ? 'port' : 'ports'}`;
		console.log(
			`${colors.blue}Cleaned ${cleanedCount} ${artifactWord}${portSummary} in ${timer.elapsedFormatted()}.${colors.reset}`,
		);
	}
}

// ==================================================
// MAIN EXECUTION
// ==================================================

async function main(): Promise<void> {
	const timer = new Timer();
	const flags = parseFlags();
	const skipPorts = flags.has('skip-ports');

	if (flags.has('help') || flags.has('h')) {
		console.log('Usage: bun scripts/clean.ts [--skip-ports]');
		return;
	}

	// Queue and execute artifact removals
	const removalTasks = queueArtifactRemovals();
	const removalResults = await Promise.all(removalTasks);

	// Clean ports if not skipped
	const portsKilled = skipPorts ? 0 : await cleanPorts();

	// Report results and print summary
	const { cleanedCount, failureCount } = reportRemovalResults(removalResults);
	printCleanupSummary(cleanedCount, portsKilled, failureCount, skipPorts, timer);
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
	runScript(main, 'clean');
}
