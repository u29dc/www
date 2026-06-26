import { BaseModule, type Context } from '../core/module';
import type { ThemeScheme, ThemeState } from '../core/state';

type ThemeSubscriber = (state: ThemeState) => void;

const THEME_COLORS: Record<ThemeScheme, string> = {
	light: '#f7f7f7',
	dark: '#18191b',
};

class ThemeOwner extends BaseModule {
	readonly name = 'theme';

	private query: MediaQueryList | undefined;
	private forcedMode: ThemeState['mode'] = 'system';
	private state: ThemeState = {
		scheme: 'light',
		mode: 'system',
		generation: 0,
	};
	private readonly subscribers = new Set<ThemeSubscriber>();

	override preinit(context: Context): void {
		super.preinit(context);
		this.forcedMode = readForcedMode();
		this.query = window.matchMedia('(prefers-color-scheme: dark)');
		this.query.addEventListener('change', this.handleSystemChange);
		this.addCleanup(() => this.query?.removeEventListener('change', this.handleSystemChange));
		this.applyTheme('init');
	}

	override refresh(): void {
		this.applyTheme('refresh');
	}

	override dispose(): void {
		this.subscribers.clear();
		super.dispose();
	}

	getState(): ThemeState {
		return { ...this.state };
	}

	subscribe(callback: ThemeSubscriber): () => void {
		this.subscribers.add(callback);
		callback(this.getState());
		return () => {
			this.subscribers.delete(callback);
		};
	}

	private readScheme(): ThemeScheme {
		if (this.forcedMode === 'light' || this.forcedMode === 'dark') return this.forcedMode;
		return this.query?.matches ? 'dark' : 'light';
	}

	private applyTheme(reason: string): void {
		const scheme = this.readScheme();
		const mode = this.forcedMode;
		const changed = scheme !== this.state.scheme || mode !== this.state.mode;
		this.state = {
			scheme,
			mode,
			generation: changed ? this.state.generation + 1 : this.state.generation,
		};

		const root = document.documentElement;
		root.dataset['theme'] = scheme;
		root.dataset['themeMode'] = mode;
		root.style.colorScheme = scheme;
		writeThemeColorMeta(scheme);

		if (changed) {
			for (const subscriber of this.subscribers) subscriber(this.getState());
			this.requestFrame(`theme:${reason}`);
		}
	}

	private readonly handleSystemChange = (): void => {
		this.applyTheme('system');
	};
}

const readForcedMode = (): ThemeState['mode'] => {
	const theme = document.documentElement.dataset['theme'];
	return theme === 'light' || theme === 'dark' ? theme : 'system';
};

const writeThemeColorMeta = (scheme: ThemeScheme): void => {
	const color = THEME_COLORS[scheme];
	let runtimeMeta = document.querySelector<HTMLMetaElement>("meta[name='theme-color'][data-runtime-theme-color]");
	if (!runtimeMeta) {
		runtimeMeta = document.createElement('meta');
		runtimeMeta.name = 'theme-color';
		runtimeMeta.dataset['runtimeThemeColor'] = 'true';
		document.head.append(runtimeMeta);
	}
	runtimeMeta.content = color;
};

export const theme = new ThemeOwner();
export const getThemeState = (): ThemeState => theme.getState();
export const subscribeTheme = (callback: ThemeSubscriber): (() => void) => theme.subscribe(callback);
