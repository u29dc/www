export type RafTask = (timestamp: number, deltaSeconds: number) => void;

export type RafTaskOptions = {
	autoStart?: boolean;
};

export type RafTaskHandle = {
	dispose: () => void;
	wake: () => void;
	sleep: () => void;
	isActive: () => boolean;
};

type TaskEntry = {
	task: RafTask;
	isActive: boolean;
};

const isBrowser = typeof window !== 'undefined';
const tasks = new Map<number, TaskEntry>();
let taskId = 0;
let rafId: number | null = null;
let lastTime = 0;
let isLoopActive = false;

const frameCallbacks = new Map<number, (timestamp: number) => void>();
let frameCallbackId = 0;

const shouldRun = () => tasks.size > 0 || frameCallbacks.size > 0;

const startLoop = () => {
	if (isLoopActive) return;
	lastTime = 0;
	isLoopActive = true;
	rafId = requestAnimationFrame(tick);
};

const stopLoop = () => {
	if (!isLoopActive) return;
	if (rafId !== null) {
		cancelAnimationFrame(rafId);
		rafId = null;
	}
	lastTime = 0;
	isLoopActive = false;
};

const drainFrameCallbacks = (timestamp: number) => {
	if (frameCallbacks.size === 0) return;
	const callbacks = Array.from(frameCallbacks.values());
	frameCallbacks.clear();
	for (const callback of callbacks) {
		callback(timestamp);
	}
};

const tick = (timestamp: number) => {
	rafId = null;

	const deltaSeconds = lastTime === 0 ? 0 : (timestamp - lastTime) / 1000;
	lastTime = timestamp;

	drainFrameCallbacks(timestamp);

	tasks.forEach((entry) => {
		if (entry.isActive) {
			entry.task(timestamp, deltaSeconds);
		}
	});

	if (shouldRun()) {
		rafId = requestAnimationFrame(tick);
	} else {
		isLoopActive = false;
	}
};

export const registerRafTask = (task: RafTask, options?: RafTaskOptions): RafTaskHandle => {
	if (!isBrowser) {
		return {
			dispose: () => {},
			wake: () => {},
			sleep: () => {},
			isActive: () => false,
		};
	}

	const autoStart = options?.autoStart ?? true;

	taskId += 1;
	const id = taskId;
	let isDisposed = false;

	const entry: TaskEntry = { task, isActive: autoStart };
	tasks.set(id, entry);
	startLoop();

	const dispose = () => {
		if (isDisposed) return;
		isDisposed = true;
		tasks.delete(id);
		if (!shouldRun()) {
			stopLoop();
		}
	};

	const wake = () => {
		if (isDisposed || entry.isActive) return;
		entry.isActive = true;
	};

	const sleep = () => {
		if (isDisposed || !entry.isActive) return;
		entry.isActive = false;
	};

	return {
		dispose,
		wake,
		sleep,
		isActive: () => entry.isActive && !isDisposed,
	};
};

export const requestFrame = (callback: (timestamp: number) => void): (() => void) => {
	if (!isBrowser) {
		return () => {};
	}

	frameCallbackId += 1;
	const id = frameCallbackId;
	frameCallbacks.set(id, callback);
	startLoop();

	return () => {
		frameCallbacks.delete(id);
		if (!shouldRun()) {
			stopLoop();
		}
	};
};
