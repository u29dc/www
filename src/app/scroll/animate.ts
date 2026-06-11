import { damp } from './math';

type AnimatorOptions = {
	lerp: number;
	settlePx: number;
};

export type ScrollAnimator = {
	value: number;
	target: number;
	velocity: number;
	running: boolean;
	sync: (value: number) => void;
	start: (from: number, to: number) => void;
	retarget: (to: number) => void;
	advance: (dt: number) => boolean;
	stop: () => void;
};

export const createAnimator = (options: AnimatorOptions): ScrollAnimator => {
	const state = {
		value: 0,
		target: 0,
		velocity: 0,
		running: false,
	};

	return {
		get value() {
			return state.value;
		},
		get target() {
			return state.target;
		},
		get velocity() {
			return state.velocity;
		},
		get running() {
			return state.running;
		},
		sync(value) {
			state.value = value;
			state.target = value;
			state.velocity = 0;
			state.running = false;
		},
		start(from, to) {
			state.value = from;
			state.target = to;
			state.velocity = 0;
			state.running = true;
		},
		retarget(to) {
			state.target = to;
			state.running = true;
		},
		advance(dt) {
			if (!state.running) return true;

			const previous = state.value;
			state.value = damp(state.value, state.target, options.lerp * 60, dt);
			state.velocity = dt > 0 ? (state.value - previous) / dt : 0;

			const settled = Math.abs(state.target - state.value) <= options.settlePx && Math.abs(state.velocity) <= options.settlePx * 120;
			if (settled) {
				state.value = state.target;
				state.velocity = 0;
				state.running = false;
				return true;
			}

			return false;
		},
		stop() {
			state.running = false;
			state.velocity = 0;
		},
	};
};
