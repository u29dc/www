export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'u29dc-theme-preference';
const DARK_THEME_COLOR = '#0c0d0e';
const LIGHT_THEME_COLOR = '#f8f9fa';

const inBrowser = (): boolean => typeof window !== 'undefined' && typeof document !== 'undefined';

const isThemePreference = (value: string | null): value is ThemePreference => value === 'light' || value === 'dark' || value === 'system';

const getSystemTheme = (): ResolvedTheme => {
	if (!inBrowser()) return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const resolveTheme = (preference: ThemePreference): ResolvedTheme => (preference === 'system' ? getSystemTheme() : preference);

const getStoredPreference = (): ThemePreference => {
	if (!inBrowser()) return 'system';
	try {
		const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
		return isThemePreference(raw) ? raw : 'system';
	} catch {
		return 'system';
	}
};

const persistPreference = (preference: ThemePreference): void => {
	if (!inBrowser()) return;
	try {
		window.localStorage.setItem(THEME_STORAGE_KEY, preference);
	} catch {
		// Ignore write failures (private mode / storage denied)
	}
};

const getThemeColor = (theme: ResolvedTheme): string => (theme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);

const updateThemeColorMeta = (theme: ResolvedTheme): void => {
	if (!inBrowser()) return;
	const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
	if (meta) {
		meta.setAttribute('content', getThemeColor(theme));
	}
};

const applyThemeToDocument = (resolvedTheme: ResolvedTheme, preference: ThemePreference): void => {
	if (!inBrowser()) return;
	const root = document.documentElement;
	root.classList.remove('light', 'dark');
	root.classList.add(resolvedTheme);
	root.setAttribute('data-theme', resolvedTheme);
	root.setAttribute('data-theme-preference', preference);
	root.style.colorScheme = resolvedTheme;
	updateThemeColorMeta(resolvedTheme);
};

function createThemeStore() {
	let preference = $state<ThemePreference>('system');
	let resolved = $state<ResolvedTheme>('light');
	let cleanupSystemListener: (() => void) | null = null;

	const sync = () => {
		resolved = resolveTheme(preference);
		applyThemeToDocument(resolved, preference);
	};

	const bindSystemThemeListener = () => {
		if (!inBrowser()) return () => {};
		const query = window.matchMedia('(prefers-color-scheme: dark)');
		const handleChange = () => {
			if (preference !== 'system') return;
			sync();
		};
		query.addEventListener('change', handleChange);
		return () => {
			query.removeEventListener('change', handleChange);
		};
	};

	return {
		get preference() {
			return preference;
		},
		get resolved() {
			return resolved;
		},
		get themeColor() {
			return getThemeColor(resolved);
		},
		start() {
			if (!inBrowser()) return () => {};
			preference = getStoredPreference();
			sync();

			cleanupSystemListener?.();
			cleanupSystemListener = bindSystemThemeListener();

			return () => {
				cleanupSystemListener?.();
				cleanupSystemListener = null;
			};
		},
		setPreference(nextPreference: ThemePreference) {
			if (preference === nextPreference) return;
			preference = nextPreference;
			persistPreference(nextPreference);
			sync();
		},
	};
}

export const theme = createThemeStore();
