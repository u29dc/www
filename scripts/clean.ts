#!/usr/bin/env bun

/**
 * clean.ts - Clean build artifacts and dev ports
 */

import { rm, stat } from 'node:fs/promises';
import { createServer } from 'node:net';
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
const PORT_PROBE_HOST = '127.0.0.1';
const PORT_RELEASE_TIMEOUT_MS = 1000;
const PORT_RELEASE_INTERVAL_MS = 25;

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

function createPortProbe(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const server = createServer();
		const complete = (result: boolean) => {
			server.removeAllListeners();
			resolve(result);
		};

		server.once('error', (error: NodeJS.ErrnoException) => {
			if (error.code === 'EADDRINUSE') {
				complete(false);
				return;
			}
			complete(false);
		});

		server.listen({ port, host: PORT_PROBE_HOST, exclusive: true }, () =>
			server.close(() => complete(true)),
		);
	});
}

async function isPortAvailable(port: number): Promise<boolean> {
	try {
		return await createPortProbe(port);
	} catch {
		return false;
	}
}

async function detectBusyPorts(ports: readonly number[]): Promise<number[]> {
	const results = await Promise.all(
		ports.map(async (port) => ({ port, available: await isPortAvailable(port) })),
	);
	return results.filter((result) => !result.available).map((result) => result.port);
}

async function collectBusyPids(ports: number[]): Promise<Set<number>> {
	if (ports.length === 0) return new Set();
	const args = ['lsof', '-nP', '-t', ...ports.map((port) => `-i:${port}`)];
	const proc = spawn(args, { stdout: 'pipe', stderr: 'pipe' });
	const output = await proc.stdout?.text();
	await proc.exited;
	if (proc.exitCode !== 0 || !output) return new Set();
	const pids = new Set<number>();
	const trimmed = output.trim();
	if (!trimmed) return pids;
	for (const line of trimmed.split('\n')) {
		const pid = Number.parseInt(line.trim(), 10);
		if (!Number.isNaN(pid)) {
			pids.add(pid);
		}
	}
	return pids;
}

function signalProcesses(pids: Set<number>): void {
	for (const pid of pids) {
		try {
			process.kill(pid, 'SIGTERM');
		} catch {
			// Process already exited; ignore
		}
	}
}

async function waitForPortRelease(port: number): Promise<boolean> {
	const deadline = performance.now() + PORT_RELEASE_TIMEOUT_MS;
	while (performance.now() < deadline) {
		if (await isPortAvailable(port)) return true;
		await Bun.sleep(PORT_RELEASE_INTERVAL_MS);
	}
	return false;
}

async function waitForPorts(ports: number[]): Promise<void> {
	await Promise.all(ports.map((port) => waitForPortRelease(port)));
}

function queueRemoval(targetPath: string, label: string | undefined): Promise<RemovalResult> {
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
			removalTasks.push(queueRemoval(file, undefined));
		}
	}

	return removalTasks;
}

async function cleanPorts(): Promise<number> {
	const busyPorts = await detectBusyPorts(CLEAN_PORTS);
	if (busyPorts.length === 0) return 0;

	const pids = await collectBusyPids(busyPorts);
	if (pids.size === 0) return 0;

	signalProcesses(pids);
	await waitForPorts(busyPorts);
	const availability = await Promise.all(busyPorts.map((port) => isPortAvailable(port)));
	return availability.filter(Boolean).length;
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
