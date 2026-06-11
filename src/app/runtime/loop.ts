import type { Context, Frame, Phase, RuntimeTrace, RuntimeTraceTimer, Task, TaskHandle } from './task';

type RuntimeConfig = {
	getProfile: () => Context['profile'];
	getRoute: () => Context['route'];
};

type TaskEntry = {
	id: number;
	task: Task;
	active: boolean;
	disposed: boolean;
	context: Context;
	lastWakeReason?: string;
	lastError?: string;
};

type PendingCallback = {
	name: string;
	callback: () => void;
};

type TimerTraceProvider = () => RuntimeTraceTimer[];

const PHASES: Phase[] = ['read', 'update', 'write', 'post'];
const MAX_DELTA_MS = 64;

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
const entries = new Map<number, TaskEntry>();
const pendingCallbacks: PendingCallback[] = [];
let nextId = 0;
let rafId = 0;
let running = false;
let started = false;
let frameIndex = 0;
let lastTime = 0;
let config: RuntimeConfig | undefined;
let timerTraceProvider: TimerTraceProvider = () => [];

const reportTaskError = (error: unknown): void => {
	queueMicrotask(() => {
		throw error;
	});
};

const readProfile = (): Context['profile'] => {
	if (!config) throw new Error('runtime-profile-provider-missing');
	return config.getProfile();
};

const readRoute = (): Context['route'] => {
	if (!config) throw new Error('runtime-route-provider-missing');
	return config.getRoute();
};

const hasActiveEntries = (): boolean => {
	for (const entry of entries.values()) {
		if (entry.active && !entry.disposed) return true;
	}
	return false;
};

const hasPendingWork = (): boolean => hasActiveEntries() || pendingCallbacks.length > 0;

const stopLoop = (): void => {
	if (!running) return;
	if (rafId) {
		cancelAnimationFrame(rafId);
		rafId = 0;
	}
	running = false;
	lastTime = 0;
};

const requestLoop = (): void => {
	if (!isBrowser || running) return;
	running = true;
	rafId = requestAnimationFrame(tick);
};

const wakeEntry = (entry: TaskEntry, reason = 'wake'): void => {
	if (entry.disposed) return;
	entry.active = true;
	entry.lastWakeReason = reason;
	requestLoop();
};

const sleepEntry = (entry: TaskEntry): void => {
	if (entry.disposed) return;
	entry.active = false;
	if (!hasPendingWork()) stopLoop();
};

const createContext = (entry: TaskEntry): Context => ({
	root: document,
	get profile() {
		return readProfile();
	},
	get route() {
		return readRoute();
	},
	wake: (reason?: string) => wakeEntry(entry, reason),
	sleep: () => sleepEntry(entry),
});

const sortedEntries = (): TaskEntry[] =>
	Array.from(entries.values())
		.filter((entry) => !entry.disposed)
		.toSorted((a, b) => (a.task.order ?? 0) - (b.task.order ?? 0) || a.id - b.id);

const runLifecycle = (entry: TaskEntry, method: 'preinit' | 'init' | 'resize'): void => {
	const callback = entry.task[method];
	if (!callback) return;

	try {
		const result = callback(entry.context);
		if (result instanceof Promise) {
			void result.catch((error: unknown) => {
				entry.lastError = error instanceof Error ? error.message : String(error);
				entry.active = false;
				reportTaskError(error);
			});
		}
	} catch (error) {
		entry.lastError = error instanceof Error ? error.message : String(error);
		entry.active = false;
		reportTaskError(error);
	}
};

const runPendingCallbacks = (): void => {
	const callbacks = pendingCallbacks.splice(0);
	for (const pending of callbacks) {
		try {
			pending.callback();
		} catch (error) {
			reportTaskError(error);
		}
	}
};

const runPhase = (phase: Phase, frame: Frame): void => {
	for (const entry of sortedEntries()) {
		if (!entry.active || entry.disposed) continue;
		const callback = entry.task[phase];
		if (!callback) continue;

		try {
			const result = callback(frame);
			if (result === false) entry.active = false;
		} catch (error) {
			entry.lastError = error instanceof Error ? error.message : String(error);
			entry.active = false;
			reportTaskError(error);
		}
	}
};

function tick(timestamp: number): void {
	rafId = 0;
	const rawdt = lastTime === 0 ? 0 : timestamp - lastTime;
	const dt = Math.min(Math.max(rawdt, 0), MAX_DELTA_MS) / 1000;
	lastTime = timestamp;
	frameIndex += 1;

	const frame: Frame = {
		index: frameIndex,
		now: timestamp,
		rawdt,
		dt,
		visible: document.visibilityState === 'visible',
		profile: readProfile(),
	};

	runPendingCallbacks();
	for (const phase of PHASES) {
		runPhase(phase, frame);
	}

	if (hasPendingWork()) {
		rafId = requestAnimationFrame(tick);
		return;
	}

	running = false;
	lastTime = 0;
}

export const registerTask = (task: Task, options?: { active?: boolean }): TaskHandle => {
	if (!isBrowser) {
		return {
			name: task.name,
			wake: () => {},
			sleep: () => {},
			dispose: () => {},
			active: () => false,
		};
	}

	nextId += 1;
	const entry = {
		id: nextId,
		task,
		active: options?.active ?? false,
		disposed: false,
		context: undefined as unknown as Context,
	};
	entry.context = createContext(entry);
	entries.set(entry.id, entry);

	if (entry.active) requestLoop();

	return {
		name: task.name,
		wake: (reason?: string) => wakeEntry(entry, reason),
		sleep: () => sleepEntry(entry),
		dispose: () => {
			if (entry.disposed) return;
			entry.disposed = true;
			entry.active = false;
			try {
				entry.task.dispose?.();
			} finally {
				entries.delete(entry.id);
				if (!hasPendingWork()) stopLoop();
			}
		},
		active: () => entry.active && !entry.disposed,
	};
};

export const startRuntime = (tasks: readonly Task[], runtimeConfig: RuntimeConfig): void => {
	if (!isBrowser || started) return;
	started = true;
	config = runtimeConfig;

	for (const task of tasks) {
		registerTask(task);
	}

	for (const entry of sortedEntries()) runLifecycle(entry, 'preinit');
	for (const entry of sortedEntries()) runLifecycle(entry, 'init');

	window.addEventListener(
		'resize',
		() => {
			for (const entry of sortedEntries()) runLifecycle(entry, 'resize');
		},
		{ passive: true },
	);
	document.addEventListener('visibilitychange', () => {
		lastTime = 0;
		if (document.visibilityState === 'visible' && hasActiveEntries()) requestLoop();
	});
};

export const wakeTask = (name: string, reason?: string): void => {
	for (const entry of entries.values()) {
		if (entry.task.name === name) wakeEntry(entry, reason);
	}
};

export const sleepTask = (name: string): void => {
	for (const entry of entries.values()) {
		if (entry.task.name === name) sleepEntry(entry);
	}
};

export const enqueueRuntimeCallback = (name: string, callback: () => void): void => {
	pendingCallbacks.push({ name, callback });
	requestLoop();
};

export const onNextFrame = (name: string, callback: () => void): (() => void) => {
	let cancelled = false;
	enqueueRuntimeCallback(name, () => {
		if (!cancelled) callback();
	});
	return () => {
		cancelled = true;
	};
};

export const setTimerTraceProvider = (provider: TimerTraceProvider): void => {
	timerTraceProvider = provider;
};

export const getRuntimeTrace = (): RuntimeTrace => {
	const tasks = sortedEntries().map((entry) => ({
		name: entry.task.name,
		active: entry.active,
		disposed: entry.disposed,
		...(entry.lastWakeReason ? { lastWakeReason: entry.lastWakeReason } : {}),
		...(entry.lastError ? { lastError: entry.lastError } : {}),
	}));

	return {
		running,
		sleeping: !running && !hasPendingWork(),
		frame: frameIndex,
		activeTasks: tasks.filter((task) => task.active).map((task) => task.name),
		tasks,
		pendingTimers: timerTraceProvider(),
		route: readRoute(),
	};
};
