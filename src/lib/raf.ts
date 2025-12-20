export type RafTask = (timestamp: number, deltaSeconds: number) => void;

export type RafTaskHandle = {
	dispose: () => void;
};

const isBrowser = typeof window !== 'undefined';
const tasks = new Map<number, RafTask>();
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

	tasks.forEach((task) => {
		task(timestamp, deltaSeconds);
	});

	if (shouldRun()) {
		rafId = requestAnimationFrame(tick);
	} else {
		isLoopActive = false;
	}
};

export const registerRafTask = (task: RafTask): RafTaskHandle => {
	if (!isBrowser) {
		return {
			dispose: () => {},
		};
	}

	taskId += 1;
	const id = taskId;
	tasks.set(id, task);
	startLoop();

	const dispose = () => {
		tasks.delete(id);
		if (!shouldRun()) {
			stopLoop();
		}
	};

	return { dispose };
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
