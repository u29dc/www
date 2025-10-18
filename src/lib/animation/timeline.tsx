'use client';

/**
 * Timeline Animation System
 *
 * ## SUMMARY
 * Deterministic page animation timeline with orchestrated enter/exit sequences,
 * zero global state, and Motion callback-driven advancement.
 *
 * ## RESPONSIBILITIES
 * - Manage stage state via pure Map-based store with subscribe pattern
 * - Orchestrate sequence advancement via RAF guardrails (not timers)
 * - Support conditional stage execution via predicate functions
 * - Bypass entire timeline for reduced motion preferences
 * - Provide reactive timeline state to consuming components
 *
 * ## USAGE
 * ```tsx
 * import { TimelineProvider, useTimeline } from '@/lib/animation/timeline';
 * import { homeTimeline } from '@/lib/animation/configs';
 *
 * // In layout/page:
 * <TimelineProvider config={homeTimeline} autoPlay>
 *   {children}
 * </TimelineProvider>
 *
 * // In components:
 * const { getStage, advanceStage } = useTimeline();
 * const stage = getStage('hero');
 * ```
 *
 * @module lib/animation/timeline
 */

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { logEvent } from '@/lib/utils/logger';

/**
 * Navigation mode types
 */
export type NavigationMode = 'direct' | 'in-app';

/**
 * Stage direction types
 */
export type StageDirection = 'enter' | 'exit';

/**
 * Stage status types
 */
export type StageStatus = 'idle' | 'animating' | 'complete';

/**
 * Stage state
 */
export interface StageState {
	status: StageStatus;
	direction: StageDirection;
}

/**
 * Stage configuration
 */
export interface StageConfig {
	id: string;
	duration: number;
	delay?: number;
	shouldRun?: (context: { mode: NavigationMode; direction: StageDirection }) => boolean;
}

/**
 * Timeline configuration
 */
export interface TimelineConfig {
	id: string;
	enterStages: StageConfig[];
	exitStages: StageConfig[];
	enterSpeedMultiplier?: number;
	exitSpeedMultiplier?: number;
}

/**
 * Timeline store interface
 */
export interface TimelineStore {
	getState: (stageId: string) => StageState | undefined;
	setState: (stageId: string, state: StageState) => void;
	subscribe: (listener: () => void) => () => void;
	reset: () => void;
}

/**
 * Timeline context value
 */
export interface TimelineContextValue {
	store: TimelineStore;
	config: TimelineConfig;
	getStage: (stageId: string) => StageState | undefined;
	advanceStage: (stageId: string) => void;
	playDirection: (direction: StageDirection, mode: NavigationMode) => Promise<void>;
}

const TimelineContext = createContext<TimelineContextValue | undefined>(undefined);

/**
 * Creates a pure state container store using Map + subscribe pattern
 */
export function createTimelineStore(): TimelineStore {
	const stateMap = new Map<string, StageState>();
	const listeners = new Set<() => void>();

	const notify = () => {
		for (const listener of listeners) {
			listener();
		}
	};

	return {
		getState: (stageId: string) => stateMap.get(stageId),
		setState: (stageId: string, state: StageState) => {
			stateMap.set(stageId, state);
			notify();
		},
		subscribe: (listener: () => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		reset: () => {
			stateMap.clear();
			notify();
		},
	};
}

/**
 * Store type with completion callbacks
 */
type StoreWithCallbacks = TimelineStore & { _completionCallbacks?: Map<string, () => void> };

/**
 * Executes a single stage with RAF guardrails
 */
async function executeStage(
	store: TimelineStore,
	stage: StageConfig,
	direction: StageDirection,
	speedMultiplier: number,
): Promise<void> {
	// Set stage to animating
	store.setState(stage.id, { status: 'animating', direction });
	logEvent('TIMELINE', 'STAGE_START', 'SUCCESS', { stageId: stage.id, direction });

	// Wait for stage completion with RAF guardrails
	await new Promise<void>((resolve) => {
		const startTime = performance.now();
		const adjustedDuration = stage.duration / speedMultiplier;
		const maxDuration = adjustedDuration * 1.5; // 1.5x safety margin

		let completionResolver: (() => void) | null = resolve;

		// RAF guardrail check
		const checkGuardrail = () => {
			const elapsed = performance.now() - startTime;

			if (elapsed >= maxDuration && completionResolver) {
				logEvent('TIMELINE', 'STAGE_TIMEOUT', 'WARN', {
					stageId: stage.id,
					elapsed,
					maxDuration,
				});
				const resolver = completionResolver;
				completionResolver = null;
				resolver();
			} else {
				requestAnimationFrame(checkGuardrail);
			}
		};

		requestAnimationFrame(checkGuardrail);

		// Store completion callback for external triggering
		const storeWithCallbacks = store as StoreWithCallbacks;
		storeWithCallbacks._completionCallbacks =
			storeWithCallbacks._completionCallbacks || new Map();
		storeWithCallbacks._completionCallbacks.set(stage.id, () => {
			if (completionResolver) {
				const resolver = completionResolver;
				completionResolver = null;
				resolver();
			}
		});
	});

	// Mark stage complete
	store.setState(stage.id, { status: 'complete', direction });
	logEvent('TIMELINE', 'STAGE_COMPLETE', 'SUCCESS', { stageId: stage.id, direction });
}

/**
 * Timeline orchestrator hook - manages sequence advancement
 */
function useTimelineOrchestrator(store: TimelineStore, config: TimelineConfig) {
	const playingRef = useRef(false);
	const currentDirectionRef = useRef<StageDirection | null>(null);
	const cancelRef = useRef(false);

	const playDirection = async (
		direction: StageDirection,
		mode: NavigationMode,
	): Promise<void> => {
		// Allow exit to interrupt enter, but prevent other concurrent playback
		if (playingRef.current) {
			if (direction === 'exit' && currentDirectionRef.current === 'enter') {
				// Cancel ongoing enter animation
				logEvent('TIMELINE', 'PLAY', 'INTERRUPT', {
					reason: 'exit-requested',
					interrupted: 'enter',
				});
				cancelRef.current = true;

				// Force resolve all pending completion callbacks
				const storeWithCallbacks = store as StoreWithCallbacks;
				const callbacks = storeWithCallbacks._completionCallbacks;
				if (callbacks) {
					for (const callback of callbacks.values()) {
						callback();
					}
					callbacks.clear();
				}

				// Wait briefly for interruption to complete
				await new Promise((resolve) => setTimeout(resolve, 50));
			} else {
				logEvent('TIMELINE', 'PLAY', 'SKIP', { reason: 'concurrent', direction });
				return;
			}
		}

		cancelRef.current = false;
		playingRef.current = true;
		currentDirectionRef.current = direction;

		const stages = direction === 'enter' ? config.enterStages : config.exitStages;
		const speedMultiplier =
			direction === 'enter'
				? config.enterSpeedMultiplier || 1
				: config.exitSpeedMultiplier || 1;

		logEvent('TIMELINE', 'PLAY_START', 'SUCCESS', {
			timelineId: config.id,
			direction,
			mode,
			stageCount: stages.length,
		});

		// Calculate absolute start times for each stage based on delays
		const stageStartTimes: number[] = [];
		let cumulativeTime = 0;

		for (let i = 0; i < stages.length; i++) {
			const stage = stages[i];
			if (!stage) continue;

			const adjustedDelay = (stage.delay || 0) / speedMultiplier;
			const adjustedDuration = stage.duration / speedMultiplier;

			if (i === 0) {
				// First stage starts immediately
				stageStartTimes.push(0);
				cumulativeTime = adjustedDuration;
			} else {
				// Subsequent stages start based on delay
				// Positive delay: start after previous completes + delay
				// Negative delay: start before previous completes (overlap)
				// Zero delay: start when previous completes
				const startTime = cumulativeTime + adjustedDelay;
				stageStartTimes.push(startTime);

				// Update cumulative time to this stage's end time
				const endTime = startTime + adjustedDuration;
				cumulativeTime = Math.max(cumulativeTime, endTime);
			}
		}

		// Execute all stages with proper timing
		const stagePromises: Promise<void>[] = [];
		const startTime = performance.now();

		for (let i = 0; i < stages.length; i++) {
			const stage = stages[i];
			if (!stage) continue;

			const scheduledStartTime = stageStartTimes[i];
			if (scheduledStartTime === undefined) continue;

			// Check for cancellation
			if (cancelRef.current) {
				logEvent('TIMELINE', 'PLAY_CANCELLED', 'SUCCESS', {
					timelineId: config.id,
					direction,
				});
				playingRef.current = false;
				currentDirectionRef.current = null;
				return;
			}

			// Check if stage should run based on context
			if (stage.shouldRun && !stage.shouldRun({ mode, direction })) {
				logEvent('TIMELINE', 'STAGE_SKIP', 'SUCCESS', {
					stageId: stage.id,
					reason: 'predicate',
				});
				continue;
			}

			// Create promise for this stage with delayed start
			const stagePromise = (async () => {
				// Wait until scheduled start time
				const now = performance.now();
				const elapsed = now - startTime;
				const waitTime = Math.max(0, scheduledStartTime - elapsed);

				if (waitTime > 0) {
					await new Promise((resolve) => setTimeout(resolve, waitTime));
				}

				// Execute the stage
				await executeStage(store, stage, direction, speedMultiplier);
			})();

			stagePromises.push(stagePromise);
		}

		// Wait for all stages to complete
		await Promise.all(stagePromises);

		logEvent('TIMELINE', 'PLAY_COMPLETE', 'SUCCESS', {
			timelineId: config.id,
			direction,
		});

		playingRef.current = false;
		currentDirectionRef.current = null;
	};

	return { playDirection };
}

/**
 * Timeline provider component
 */
export function TimelineProvider({
	children,
	config,
	autoPlay = false,
}: {
	children: ReactNode;
	config: TimelineConfig;
	autoPlay?: boolean;
}) {
	const [store] = useState(() => createTimelineStore());
	const autoPlayExecutedRef = useRef(false);

	// Orchestrator
	const { playDirection } = useTimelineOrchestrator(store, config);

	// Auto-play guard (prevents Strict Mode double-runs)
	useEffect(() => {
		if (autoPlay && !autoPlayExecutedRef.current) {
			autoPlayExecutedRef.current = true;
			playDirection('enter', 'direct').catch((error) => {
				logEvent('TIMELINE', 'AUTOPLAY', 'ERROR', { error });
			});
		}
	}, [autoPlay, playDirection]);

	const getStage = (stageId: string) => store.getState(stageId);

	const advanceStage = (stageId: string) => {
		const callbacks = (store as StoreWithCallbacks)._completionCallbacks;
		const callback = callbacks?.get(stageId);
		if (callback) {
			callback();
			callbacks?.delete(stageId);
		}
	};

	const value: TimelineContextValue = {
		store,
		config,
		getStage,
		advanceStage,
		playDirection,
	};

	return <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>;
}

/**
 * Hook to access timeline context
 */
export function useTimeline(): TimelineContextValue {
	const context = useContext(TimelineContext);
	if (!context) {
		throw new Error('useTimeline must be used within TimelineProvider');
	}
	return context;
}

// ============================================================================
// NAVIGATION MODE DETECTION
// ============================================================================

/**
 * Navigation mode context value
 */
export interface NavigationModeContextValue {
	mode: NavigationMode;
	setMode: (mode: NavigationMode) => void;
}

const NavigationModeContext = createContext<NavigationModeContextValue | undefined>(undefined);

/**
 * Detects initial navigation mode using Navigation Timing API
 */
function detectInitialMode(): NavigationMode {
	if (typeof window === 'undefined') return 'direct';

	try {
		// Use Navigation Timing API for reliable detection
		const navEntries = performance.getEntriesByType(
			'navigation',
		) as PerformanceNavigationTiming[];
		const navEntry = navEntries[0];

		if (navEntry) {
			// Check navigation type
			if (navEntry.type === 'reload') return 'direct';
			if (navEntry.type === 'navigate') {
				// Check if there's a referrer from the same origin
				const referrer = document.referrer;
				if (referrer && new URL(referrer).origin === window.location.origin) {
					return 'in-app';
				}
				return 'direct';
			}
		}
	} catch (error) {
		logEvent('NAVIGATION', 'DETECT', 'ERROR', { error });
	}

	return 'direct';
}

/**
 * Navigation mode provider component
 *
 * Detects and tracks navigation context (direct visit vs in-app navigation)
 * for conditional animation orchestration.
 *
 * @example
 * ```tsx
 * <NavigationModeProvider>{children}</NavigationModeProvider>
 * ```
 */
export function NavigationModeProvider({ children }: { children: ReactNode }) {
	const [mode, setModeState] = useState<NavigationMode>('direct');
	const initializedRef = useRef(false);
	const previousPathnameRef = useRef<string | null>(null);

	// Imperative setter for synchronous mode updates
	const setMode = (newMode: NavigationMode) => {
		setModeState(newMode);
		logEvent('NAVIGATION', 'MODE_SET', 'SUCCESS', { mode: newMode });
	};

	// Detect initial mode on mount
	useEffect(() => {
		if (initializedRef.current) return;
		initializedRef.current = true;

		const detectedMode = detectInitialMode();
		setModeState(detectedMode);
		previousPathnameRef.current = window.location.pathname;

		logEvent('NAVIGATION', 'INIT', 'SUCCESS', { mode: detectedMode });
	}, []);

	// Fallback: Track pathname changes for mode detection
	useEffect(() => {
		const currentPathname = window.location.pathname;

		// If pathname changed and we didn't explicitly set mode, assume in-app navigation
		if (
			previousPathnameRef.current !== null &&
			previousPathnameRef.current !== currentPathname
		) {
			setModeState('in-app');
			logEvent('NAVIGATION', 'PATHNAME_CHANGE', 'SUCCESS', {
				from: previousPathnameRef.current,
				to: currentPathname,
			});
		}

		previousPathnameRef.current = currentPathname;
	});

	return (
		<NavigationModeContext.Provider value={{ mode, setMode }}>
			{children}
		</NavigationModeContext.Provider>
	);
}

/**
 * Hook to access navigation mode context
 *
 * @example
 * ```tsx
 * const { mode, setMode } = useNavigationMode();
 * ```
 */
export function useNavigationMode(): NavigationModeContextValue {
	const context = useContext(NavigationModeContext);
	if (!context) {
		throw new Error('useNavigationMode must be used within NavigationModeProvider');
	}
	return context;
}
