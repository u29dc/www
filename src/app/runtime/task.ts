import type { DeviceProfile } from '../device/device';
import type { RouteState } from '../route/route';

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

export type Task<TState = unknown> = {
	name: string;
	order?: number;
	state?: TState;
	preinit?: (context: Context) => void | Promise<void>;
	init?: (context: Context) => void;
	resize?: (context: Context) => void;
	read?: (frame: Frame) => void | false;
	update?: (frame: Frame) => void | false;
	write?: (frame: Frame) => void | false;
	post?: (frame: Frame) => void | false;
	dispose?: () => void;
};

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

export const createTask = <TTask extends Task>(task: TTask): TTask => task;
