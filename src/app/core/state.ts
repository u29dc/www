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

export type RouteState = {
	current: SiteRoute;
	page: 'idle' | 'exiting' | 'swapping' | 'loaded';
	to?: SiteRoute;
};
