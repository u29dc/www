import { enqueueRuntimeCallback, setTimerTraceProvider } from './loop';
import type { RuntimeTraceTimer } from './task';

export type TimerHandle = {
	id: number;
	name: string;
	cancel: () => void;
	active: () => boolean;
};

type TimerEntry = {
	id: number;
	name: string;
	dueAt: number;
	timeout: number;
	callback: () => void;
	cancelled: boolean;
};

const timers = new Map<number, TimerEntry>();
let nextTimerId = 0;

const getTimerTrace = (): RuntimeTraceTimer[] => {
	const now = performance.now();
	return Array.from(timers.values())
		.filter((timer) => !timer.cancelled)
		.map((timer) => ({
			id: timer.id,
			name: timer.name,
			dueAt: timer.dueAt,
			remainingMs: Math.max(0, timer.dueAt - now),
		}))
		.toSorted((a, b) => a.dueAt - b.dueAt || a.id - b.id);
};

setTimerTraceProvider(getTimerTrace);

export const setTimer = (name: string, delayMs: number, callback: () => void, options?: { signal?: AbortSignal }): TimerHandle => {
	nextTimerId += 1;
	const id = nextTimerId;
	const dueAt = performance.now() + Math.max(0, delayMs);

	const cancel = (): void => {
		const timer = timers.get(id);
		if (!timer || timer.cancelled) return;
		timer.cancelled = true;
		window.clearTimeout(timer.timeout);
		timers.delete(id);
		options?.signal?.removeEventListener('abort', cancel);
	};

	const timeout = window.setTimeout(
		() => {
			const timer = timers.get(id);
			if (!timer || timer.cancelled) return;
			timers.delete(id);
			options?.signal?.removeEventListener('abort', cancel);
			enqueueRuntimeCallback(`timer:${name}`, timer.callback);
		},
		Math.max(0, delayMs),
	);

	const entry: TimerEntry = {
		id,
		name,
		dueAt,
		timeout,
		callback,
		cancelled: false,
	};

	timers.set(id, entry);
	options?.signal?.addEventListener('abort', cancel, { once: true });

	return {
		id,
		name,
		cancel,
		active: () => timers.has(id) && !entry.cancelled,
	};
};

export const delayTimer = (name: string, delayMs: number, signal?: AbortSignal): Promise<void> => {
	if (delayMs <= 0 || signal?.aborted) return Promise.resolve();

	return new Promise((resolve) => {
		setTimer(name, delayMs, resolve, signal ? { signal } : undefined);
	});
};
