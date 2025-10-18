'use client';

/**
 * Timeline Animation System
 *
 * ## SUMMARY
 * Deterministic page animation timeline with orchestrated enter/exit sequences.
 *
 * ## RESPONSIBILITIES
 * - Manage stage state via Map-based store with subscribe pattern
 * - Orchestrate sequence advancement via RAF guardrails
 *
 * @module lib/timeline
 */

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { logEvent } from '@/lib/logger';

export type NavigationMode = 'direct' | 'in-app';

export type StageDirection = 'enter' | 'exit';

export type StageStatus = 'idle' | 'animating' | 'complete';

export interface StageState {
	status: StageStatus;
	direction: StageDirection;
}

export interface StageConfig {
	id: string;
	duration: number;
	delay?: number;
	shouldRun?: (context: { mode: NavigationMode; direction: StageDirection }) => boolean;
}

export interface TimelineConfig {
	id: string;
	enterStages: StageConfig[];
	exitStages: StageConfig[];
	enterSpeedMultiplier?: number;
	exitSpeedMultiplier?: number;
}

export interface TimelineStore {
	getState: (stageId: string) => StageState | undefined;
	setState: (stageId: string, state: StageState) => void;
	subscribe: (listener: () => void) => () => void;
	reset: () => void;
}

export interface TimelineContextValue {
	store: TimelineStore;
	config: TimelineConfig;
	getStage: (stageId: string) => StageState | undefined;
	advanceStage: (stageId: string) => void;
	playDirection: (direction: StageDirection, mode: NavigationMode) => Promise<void>;
}

const TimelineContext = createContext<TimelineContextValue | undefined>(undefined);

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

type StoreWithCallbacks = TimelineStore & { _completionCallbacks?: Map<string, () => void> };

async function executeStage(
	store: TimelineStore,
	stage: StageConfig,
	direction: StageDirection,
	speedMultiplier: number,
): Promise<void> {
	store.setState(stage.id, { status: 'animating', direction });
	logEvent('TIMELINE', 'STAGE_START', 'SUCCESS', { stageId: stage.id, direction });

	await new Promise<void>((resolve) => {
		const startTime = performance.now();
		const adjustedDuration = stage.duration / speedMultiplier;
		const maxDuration = adjustedDuration * 1.5;

		let completionResolver: (() => void) | null = resolve;

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

	store.setState(stage.id, { status: 'complete', direction });
	logEvent('TIMELINE', 'STAGE_COMPLETE', 'SUCCESS', { stageId: stage.id, direction });
}

function useTimelineOrchestrator(store: TimelineStore, config: TimelineConfig) {
	const playingRef = useRef(false);
	const currentDirectionRef = useRef<StageDirection | null>(null);
	const cancelRef = useRef(false);

	const playDirection = async (
		direction: StageDirection,
		mode: NavigationMode,
	): Promise<void> => {
		if (playingRef.current) {
			if (direction === 'exit' && currentDirectionRef.current === 'enter') {
				logEvent('TIMELINE', 'PLAY', 'INTERRUPT', {
					reason: 'exit-requested',
					interrupted: 'enter',
				});
				cancelRef.current = true;

				const storeWithCallbacks = store as StoreWithCallbacks;
				const callbacks = storeWithCallbacks._completionCallbacks;
				if (callbacks) {
					for (const callback of callbacks.values()) {
						callback();
					}
					callbacks.clear();
				}

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

		const stageStartTimes: number[] = [];
		let cumulativeTime = 0;

		for (let i = 0; i < stages.length; i++) {
			const stage = stages[i];
			if (!stage) continue;

			const adjustedDelay = (stage.delay || 0) / speedMultiplier;
			const adjustedDuration = stage.duration / speedMultiplier;

			if (i === 0) {
				stageStartTimes.push(0);
				cumulativeTime = adjustedDuration;
			} else {
				const startTime = cumulativeTime + adjustedDelay;
				stageStartTimes.push(startTime);

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

			if (cancelRef.current) {
				logEvent('TIMELINE', 'PLAY_CANCELLED', 'SUCCESS', {
					timelineId: config.id,
					direction,
				});
				playingRef.current = false;
				currentDirectionRef.current = null;
				return;
			}

			if (stage.shouldRun && !stage.shouldRun({ mode, direction })) {
				logEvent('TIMELINE', 'STAGE_SKIP', 'SUCCESS', {
					stageId: stage.id,
					reason: 'predicate',
				});
				continue;
			}

			const stagePromise = (async () => {
				const now = performance.now();
				const elapsed = now - startTime;
				const waitTime = Math.max(0, scheduledStartTime - elapsed);

				if (waitTime > 0) {
					await new Promise((resolve) => setTimeout(resolve, waitTime));
				}

				await executeStage(store, stage, direction, speedMultiplier);
			})();

			stagePromises.push(stagePromise);
		}

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

	const { playDirection } = useTimelineOrchestrator(store, config);

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

export interface NavigationModeContextValue {
	mode: NavigationMode;
	setMode: (mode: NavigationMode) => void;
}

const NavigationModeContext = createContext<NavigationModeContextValue | undefined>(undefined);

function detectInitialMode(): NavigationMode {
	if (typeof window === 'undefined') return 'direct';

	try {
		const navEntries = performance.getEntriesByType(
			'navigation',
		) as PerformanceNavigationTiming[];
		const navEntry = navEntries[0];

		if (navEntry) {
			if (navEntry.type === 'reload') return 'direct';
			if (navEntry.type === 'navigate') {
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

export function NavigationModeProvider({ children }: { children: ReactNode }) {
	const [mode, setModeState] = useState<NavigationMode>('direct');
	const initializedRef = useRef(false);
	const previousPathnameRef = useRef<string | null>(null);

	const setMode = (newMode: NavigationMode) => {
		setModeState(newMode);
		logEvent('NAVIGATION', 'MODE_SET', 'SUCCESS', { mode: newMode });
	};

	useEffect(() => {
		if (initializedRef.current) return;
		initializedRef.current = true;

		const detectedMode = detectInitialMode();
		setModeState(detectedMode);
		previousPathnameRef.current = window.location.pathname;

		logEvent('NAVIGATION', 'INIT', 'SUCCESS', { mode: detectedMode });
	}, []);

	useEffect(() => {
		const currentPathname = window.location.pathname;

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

export function useNavigationMode(): NavigationModeContextValue {
	const context = useContext(NavigationModeContext);
	if (!context) {
		throw new Error('useNavigationMode must be used within NavigationModeProvider');
	}
	return context;
}
