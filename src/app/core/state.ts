export type PerformanceTier = 'low' | 'medium' | 'high';
export type MotionQuality = 'reduced' | 'no-blur' | 'full';
export type InputProfile = 'coarse' | 'fine' | 'mixed' | 'unknown';
export type NetworkProfile = 'save-data' | 'slow' | 'normal' | 'unknown';
export type DisplayProfile = 'small' | 'standard' | 'large';
export type DeviceProfileSource = 'ssr' | 'boot' | 'static-signals' | 'calibrated' | 'fallback';
export type DeviceProfileConfidence = 'low' | 'medium' | 'high';
export type LineDeviceProfile = 'lite' | 'full';

export type DeviceProfile = {
	version: 1;
	source: DeviceProfileSource;
	confidence: DeviceProfileConfidence;
	generation: number;
	updatedAt: number;
	tier: PerformanceTier;
	motionQuality: MotionQuality;
	inputProfile: InputProfile;
	networkProfile: NetworkProfile;
	displayProfile: DisplayProfile;
	dprCap: number;
	lineProfile: LineDeviceProfile;
	allowWebglMotion: boolean;
	allowWebglHighDpr: boolean;
	allowHoverVideo: boolean;
	allowPixelReveal: boolean;
	allowContentVisibility: boolean;
	reasons: string[];
	signals: {
		clientReady: boolean;
		reducedMotion: boolean;
		coarsePointer: boolean;
		finePointer: boolean;
		hover: boolean;
		hardwareConcurrency?: number;
		deviceMemory?: number;
		devicePixelRatio: number;
		saveData?: boolean;
		effectiveType?: string;
		viewportWidth: number;
		viewportHeight: number;
		rafFps?: number;
		longTaskCount?: number;
	};
};

export type SiteRoute = 'home' | 'detail';
export type RoutePageState = 'idle' | 'exiting' | 'swapping' | 'entering' | 'loaded';

export type RouteState = {
	current: SiteRoute;
	pathname: string;
	hash: string;
	page: RoutePageState;
	pageState: RoutePageState;
	generation: number;
	from?: SiteRoute;
	to?: SiteRoute;
};

export type PointerState = {
	x: number;
	y: number;
	nx: number;
	ny: number;
	dx: number;
	dy: number;
	vx: number;
	vy: number;
	isDown: boolean;
	wasPressed: boolean;
	wasReleased: boolean;
	activePointerType: string;
	target: EventTarget | null;
	relatedTarget: EventTarget | null;
	path: EventTarget[];
	exited: boolean;
};

export type WheelState = {
	dx: number;
	dy: number;
	source: 'none' | 'wheel';
};

export type KeyboardState = {
	lastKey: string;
	hadKeyboardInput: boolean;
	activeKeys: string[];
};

export type InputState = {
	generation: number;
	pointer: PointerState;
	wheel: WheelState;
	keyboard: KeyboardState;
};

export type ScrollSource = 'wheel' | 'anchor' | 'route' | 'native';
export type ScrollDirection = -1 | 0 | 1;

export type ScrollState = {
	actual: number;
	animated: number;
	target: number;
	velocity: number;
	direction: ScrollDirection;
	limit: number;
	active: boolean;
	source: ScrollSource;
	enabled: boolean;
};

export type ThemeScheme = 'light' | 'dark';

export type ThemeState = {
	scheme: ThemeScheme;
	mode: ThemeScheme | 'system';
	generation: number;
};
