import type { Context, Frame, Module } from './module';
import type { DeviceProfile, InputState, RouteState, ScrollState, ThemeState } from './state';
import { cancelRuntimeTimers, setTimerScheduler } from './timer';
import { setDataset } from '../utils/dom';

export type AppConfig = {
	getProfile: () => DeviceProfile;
	getRoute: () => RouteState;
	getInput: () => InputState;
	getScroll: () => ScrollState;
	getTheme: () => ThemeState;
	beforeFrame?: (frame: Frame) => void;
	afterFrame?: (frame: Frame) => void;
};

type PendingCallback = {
	name: string;
	callback: () => void;
	cancelled: boolean;
};

type ErrorPhase = 'preinit' | 'init' | 'refresh' | 'resize' | 'update' | 'dispose' | 'callback' | 'beforeFrame' | 'afterFrame' | 'frame' | 'reported';

type RuntimeError = {
	owner: string;
	phase: ErrorPhase;
	type: 'Error' | 'TypeError' | 'RangeError' | 'ReferenceError' | 'SyntaxError' | 'AggregateError' | 'Unknown';
	count: number;
	firstFrame: number;
	lastFrame: number;
};

export type RuntimeDiagnostics = {
	version: 1;
	running: boolean;
	frame: number;
	pendingCallbacks: number;
	errors: RuntimeError[];
};

type DiagnosticsWindow = Window & {
	wwwRuntimeDiagnostics?: () => RuntimeDiagnostics;
};

const MAX_DELTA_MS = 64;
const MAX_ERROR_RECORDS = 20;
const isBrowser = (): boolean => typeof window !== 'undefined' && typeof document !== 'undefined';

const errorType = (error: unknown): RuntimeError['type'] => {
	if (error instanceof TypeError) return 'TypeError';
	if (error instanceof RangeError) return 'RangeError';
	if (error instanceof ReferenceError) return 'ReferenceError';
	if (error instanceof SyntaxError) return 'SyntaxError';
	if (error instanceof AggregateError) return 'AggregateError';
	return error instanceof Error ? 'Error' : 'Unknown';
};

export class App {
	private readonly modules: readonly Module[];
	private readonly config: AppConfig;
	private readonly traces = new Map<string, RuntimeError>();
	private readonly pendingCallbacks: PendingCallback[] = [];
	private context: Context | undefined;
	private rafId = 0;
	private started = false;
	private ticking = false;
	private requestedDuringTick = false;
	private frameIndex = 0;
	private lastTime = 0;
	private lastReason = 'start';
	private resetTimerScheduler: (() => void) | undefined;
	private previousDiagnostics: (() => RuntimeDiagnostics) | undefined;

	constructor(modules: readonly Module[], config: AppConfig) {
		this.modules = modules;
		this.config = config;
	}

	start(): void {
		if (!isBrowser() || this.started) return;
		setDataset(document.documentElement, 'runtime', 'booting');
		this.started = true;
		this.context = this.createContext();
		this.resetTimerScheduler = setTimerScheduler((name, callback) => this.nextFrame(name, callback));
		this.previousDiagnostics = (window as DiagnosticsWindow).wwwRuntimeDiagnostics;
		(window as DiagnosticsWindow).wwwRuntimeDiagnostics = this.readDiagnostics;

		for (const module of this.modules) this.runLifecycle(module, 'preinit');
		for (const module of this.modules) this.runLifecycle(module, 'init');
		for (const module of this.modules) this.runLifecycle(module, 'resize');

		window.addEventListener('resize', this.handleResize, { passive: true });
		document.addEventListener('visibilitychange', this.handleVisibilityChange);
		setDataset(document.documentElement, 'runtime', 'ready');
		setDataset(document.documentElement, 'runtimeVisible', String(document.visibilityState === 'visible'));
		this.requestFrame('app:start');
	}

	refreshPage(reason = 'route:refresh'): void {
		if (!this.started) return;
		setDataset(document.documentElement, 'runtime', 'ready');
		setDataset(document.documentElement, 'runtimeVisible', String(document.visibilityState === 'visible'));
		for (const module of this.modules) this.runLifecycle(module, 'refresh');
		for (const module of this.modules) this.runLifecycle(module, 'resize');
		this.requestFrame(reason);
	}

	requestFrame(reason = 'request'): void {
		this.lastReason = reason;
		if (!isBrowser() || !this.started || document.visibilityState !== 'visible') return;
		if (this.ticking) {
			this.requestedDuringTick = true;
			return;
		}
		if (this.rafId !== 0) return;
		this.rafId = requestAnimationFrame(this.tick);
	}

	nextFrame(reason: string, callback: () => void): () => void {
		const pending = { name: reason, callback, cancelled: false };
		this.pendingCallbacks.push(pending);
		this.requestFrame(reason);
		return () => {
			pending.cancelled = true;
			const index = this.pendingCallbacks.indexOf(pending);
			if (index !== -1) this.pendingCallbacks.splice(index, 1);
		};
	}

	dispose(): void {
		if (!this.started) return;
		this.started = false;
		try {
			if (this.rafId !== 0) {
				cancelAnimationFrame(this.rafId);
				this.rafId = 0;
			}
			window.removeEventListener('resize', this.handleResize);
			document.removeEventListener('visibilitychange', this.handleVisibilityChange);
			for (const module of [...this.modules].toReversed()) this.runDispose(module);
			this.pendingCallbacks.length = 0;
			cancelRuntimeTimers();
		} catch (error) {
			this.recordError({ name: 'app' }, error, 'dispose');
		} finally {
			this.resetTimerScheduler?.();
			this.resetTimerScheduler = undefined;
			this.ticking = false;
			this.requestedDuringTick = false;
			this.lastTime = 0;
			const diagnosticsWindow = window as DiagnosticsWindow;
			if (diagnosticsWindow.wwwRuntimeDiagnostics === this.readDiagnostics) {
				if (this.previousDiagnostics) diagnosticsWindow.wwwRuntimeDiagnostics = this.previousDiagnostics;
				else delete diagnosticsWindow.wwwRuntimeDiagnostics;
			}
			this.previousDiagnostics = undefined;
		}
	}

	getTrace(): RuntimeError[] {
		return Array.from(this.traces.values(), (trace) => ({ ...trace }));
	}

	private readonly readDiagnostics = (): RuntimeDiagnostics => ({
		version: 1,
		running: this.started,
		frame: this.frameIndex,
		pendingCallbacks: this.pendingCallbacks.filter((pending) => !pending.cancelled).length,
		errors: this.getTrace(),
	});

	private createContext(): Context {
		return Object.defineProperties(
			{
				root: document,
				requestFrame: (reason?: string) => this.requestFrame(reason),
				nextFrame: (reason: string, callback: () => void) => this.nextFrame(reason, callback),
				reportError: (name: string, error: unknown) => this.recordError({ name }, error, 'reported'),
			},
			{
				profile: { get: () => this.config.getProfile() },
				route: { get: () => this.config.getRoute() },
				input: { get: () => this.config.getInput() },
				scroll: { get: () => this.config.getScroll() },
				theme: { get: () => this.config.getTheme() },
			},
		) as Context;
	}

	private createFrame(timestamp: number): Frame {
		const rawdt = this.lastTime === 0 ? 0 : timestamp - this.lastTime;
		const frameIndex = this.frameIndex + 1;
		const profile = this.config.getProfile();
		const route = this.config.getRoute();
		const input = this.config.getInput();
		const scroll = this.config.getScroll();
		const theme = this.config.getTheme();
		this.lastTime = timestamp;
		this.frameIndex = frameIndex;

		return {
			index: frameIndex,
			now: timestamp,
			rawdt,
			dt: Math.min(Math.max(rawdt, 0), MAX_DELTA_MS) / 1000,
			visible: document.visibilityState === 'visible',
			profile,
			route,
			input,
			scroll,
			theme,
		};
	}

	private runLifecycle(module: Module, method: 'preinit' | 'init' | 'refresh' | 'resize'): void {
		const callback = module[method];
		if (!callback || !this.context) return;
		try {
			callback.call(module, this.context);
		} catch (error) {
			this.recordError(module, error, method);
		}
	}

	private runDispose(module: Module): void {
		try {
			module.dispose?.();
		} catch (error) {
			this.recordError(module, error, 'dispose');
		}
	}

	private runPendingCallbacks(): void {
		const callbacks = this.pendingCallbacks.splice(0);
		for (const pending of callbacks) {
			if (pending.cancelled) continue;
			try {
				pending.callback();
			} catch (error) {
				this.recordError({ name: pending.name }, error, 'callback');
			}
		}
	}

	private recordError(module: Pick<Module, 'name'>, error: unknown, phase: ErrorPhase): void {
		const name = module.name.replace(/^timer:/, '');
		const owner = this.modules.find((candidate) => name === candidate.name || name.startsWith(`${candidate.name}.`) || name.startsWith(`${candidate.name}:`))?.name ?? 'app';
		const type = errorType(error);
		const key = `${owner}:${phase}:${type}`;
		const previous = this.traces.get(key);
		this.traces.delete(key);
		this.traces.set(key, {
			owner,
			phase,
			type,
			count: Math.min((previous?.count ?? 0) + 1, Number.MAX_SAFE_INTEGER),
			firstFrame: previous?.firstFrame ?? this.frameIndex,
			lastFrame: this.frameIndex,
		});
		if (this.traces.size > MAX_ERROR_RECORDS) {
			const oldest = this.traces.keys().next().value;
			if (oldest !== undefined) this.traces.delete(oldest);
		}
		if (import.meta.env.DEV) {
			queueMicrotask(() => {
				throw error instanceof Error ? error : new Error(`[app:${module.name}] ${String(error)}`);
			});
		}
	}

	private readonly tick = (timestamp: number): void => {
		this.rafId = 0;
		if (!this.started || document.visibilityState !== 'visible') return;
		this.ticking = true;
		this.requestedDuringTick = false;

		let needsNextFrame = false;
		let shouldContinue = false;

		try {
			const frame = this.createFrame(timestamp);

			try {
				this.config.beforeFrame?.(frame);
			} catch (error) {
				this.recordError({ name: 'app' }, error, 'beforeFrame');
			}

			this.runPendingCallbacks();
			for (const module of this.modules) {
				if (!module.update) continue;
				try {
					needsNextFrame = module.update.call(module, frame) === true || needsNextFrame;
				} catch (error) {
					this.recordError(module, error, 'update');
				}
			}

			try {
				this.config.afterFrame?.(frame);
			} catch (error) {
				this.recordError({ name: 'app' }, error, 'afterFrame');
			}
		} catch (error) {
			this.recordError({ name: 'app' }, error, 'frame');
		} finally {
			shouldContinue = needsNextFrame || this.requestedDuringTick || this.pendingCallbacks.some((callback) => !callback.cancelled);
			this.ticking = false;
			if (!shouldContinue) this.lastTime = 0;
		}
		if (shouldContinue) this.requestFrame(this.lastReason);
	};

	private readonly handleResize = (): void => {
		for (const module of this.modules) this.runLifecycle(module, 'resize');
		this.requestFrame('window:resize');
	};

	private readonly handleVisibilityChange = (): void => {
		this.lastTime = 0;
		setDataset(document.documentElement, 'runtimeVisible', String(document.visibilityState === 'visible'));
		if (document.visibilityState === 'visible') this.requestFrame('document:visibility');
	};
}
