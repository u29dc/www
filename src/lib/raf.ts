export type RafTask = (timestamp: number, deltaSeconds: number) => boolean | void;

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

const shouldRun = (): boolean => tasks.size > 0;

const stopLoop = (): void => {
	if (!isLoopActive) return;
	if (rafId !== null) {
		cancelAnimationFrame(rafId);
		rafId = null;
	}
	lastTime = 0;
	isLoopActive = false;
};

const tick = (timestamp: number): void => {
	rafId = null;

	const deltaSeconds = lastTime === 0 ? 0 : (timestamp - lastTime) / 1000;
	lastTime = timestamp;

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

const startLoop = (): void => {
	if (isLoopActive) return;
	lastTime = 0;
	isLoopActive = true;
	rafId = requestAnimationFrame(tick);
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

	const dispose = (): void => {
		if (isDisposed) return;
		isDisposed = true;
		tasks.delete(id);
		if (!shouldRun()) {
			stopLoop();
		}
	};

	const wake = (): void => {
		if (isDisposed || entry.isActive) return;
		entry.isActive = true;
		startLoop();
	};

	const sleep = (): void => {
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
