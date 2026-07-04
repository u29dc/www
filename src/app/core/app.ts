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

type ModuleTrace = {
	name: string;
	lastError?: string;
};

const MAX_DELTA_MS = 64;
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

export class App {
	private readonly modules: readonly Module[];
	private readonly config: AppConfig;
	private readonly traces = new Map<string, ModuleTrace>();
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

	constructor(modules: readonly Module[], config: AppConfig) {
		this.modules = modules;
		this.config = config;
	}

	start(): void {
		if (!isBrowser || this.started) return;
		setDataset(document.documentElement, 'runtime', 'booting');
		this.started = true;
		this.context = this.createContext();
		this.resetTimerScheduler = setTimerScheduler((name, callback) => {
			this.nextFrame(name, callback);
		});

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
		if (!isBrowser || !this.started || document.visibilityState !== 'visible') return;
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
			this.recordError({ name: 'dispose' }, error);
		} finally {
			this.resetTimerScheduler?.();
			this.resetTimerScheduler = undefined;
			this.ticking = false;
			this.requestedDuringTick = false;
			this.lastTime = 0;
		}
	}

	getTrace(): ModuleTrace[] {
		return this.modules.map((module) => this.traces.get(module.name) ?? { name: module.name });
	}

	private createContext(): Context {
		return Object.defineProperties(
			{
				root: document,
				requestFrame: (reason?: string) => this.requestFrame(reason),
				nextFrame: (reason: string, callback: () => void) => this.nextFrame(reason, callback),
				reportError: (name: string, error: unknown) => this.recordError({ name }, error),
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
			this.recordError(module, error);
		}
	}

	private runDispose(module: Module): void {
		try {
			module.dispose?.();
		} catch (error) {
			this.recordError(module, error);
		}
	}

	private runPendingCallbacks(): void {
		const callbacks = this.pendingCallbacks.splice(0);
		for (const pending of callbacks) {
			if (pending.cancelled) continue;
			try {
				pending.callback();
			} catch (error) {
				this.recordError({ name: pending.name }, error);
			}
		}
	}

	private recordError(module: Pick<Module, 'name'>, error: unknown): void {
		const message = error instanceof Error ? error.message : String(error);
		this.traces.set(module.name, { name: module.name, lastError: message });
		if (import.meta.env.DEV) {
			queueMicrotask(() => {
				throw error instanceof Error ? error : new Error(`[app:${module.name}] ${message}`);
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
				this.recordError({ name: 'beforeFrame' }, error);
			}

			this.runPendingCallbacks();
			for (const module of this.modules) {
				if (!module.update) continue;
				try {
					needsNextFrame = module.update.call(module, frame) === true || needsNextFrame;
				} catch (error) {
					this.recordError(module, error);
				}
			}

			try {
				this.config.afterFrame?.(frame);
			} catch (error) {
				this.recordError({ name: 'afterFrame' }, error);
			}
		} catch (error) {
			this.recordError({ name: 'frame' }, error);
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
