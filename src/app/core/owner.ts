import type { DeviceProfile, RouteState } from './state';

export type Phase = 'read' | 'update' | 'write' | 'post';

export type Frame = {
	index: number;
	now: number;
	rawdt: number;
	dt: number;
	visible: boolean;
	profile: DeviceProfile;
};

export type Context = {
	root: Document;
	profile: DeviceProfile;
	route: RouteState;
	wake: (reason?: string) => void;
	sleep: () => void;
};

export type Owner = {
	readonly name: string;
	order?: number;
	preinit?: (context: Context) => void;
	init?: (context: Context) => void;
	resize?: (context: Context) => void;
	read?: (frame: Frame) => void | false;
	update?: (frame: Frame) => void | false;
	write?: (frame: Frame) => void | false;
	post?: (frame: Frame) => void | false;
	dispose?: () => void;
};

export abstract class AppOwner implements Owner {
	abstract readonly name: string;
	readonly order: number = 0;

	protected context?: Context;
	protected cleanups: Array<() => void> = [];

	preinit(context: Context): void {
		this.context = context;
	}

	dispose(): void {
		for (const cleanup of this.cleanups.splice(0)) cleanup();
	}

	protected addCleanup(cleanup: () => void): void {
		this.cleanups.push(cleanup);
	}
}

export type Task = Owner;

export type TaskHandle = {
	name: string;
	wake: (reason?: string) => void;
	sleep: () => void;
	dispose: () => void;
	active: () => boolean;
};

export type RuntimeTraceTask = {
	name: string;
	active: boolean;
	disposed: boolean;
	lastWakeReason?: string;
	lastError?: string;
};

export type RuntimeTraceTimer = {
	id: number;
	name: string;
	dueAt: number;
	remainingMs: number;
};

export type RuntimeTrace = {
	running: boolean;
	sleeping: boolean;
	frame: number;
	activeTasks: string[];
	tasks: RuntimeTraceTask[];
	pendingTimers: RuntimeTraceTimer[];
	route: RouteState;
};
