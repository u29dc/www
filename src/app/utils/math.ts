export const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export const saturate = (value: number): number => clamp(value, 0, 1);

export const lerp = (from: number, to: number, amount: number): number => (1 - amount) * from + amount * to;

export const unlerp = (min: number, max: number, value: number): number => {
	if (min === max) return 0;
	return (value - min) / (max - min);
};

export const map = (value: number, inMin: number, inMax: number, outMin: number, outMax: number): number => lerp(outMin, outMax, unlerp(inMin, inMax, value));

export const damp = (from: number, to: number, lambda: number, dt: number): number => {
	const weight = 1 - Math.exp(-lambda * dt);
	const value = lerp(from, to, weight);
	return Math.abs(value - to) < 0.001 ? to : value;
};

export const distance = (x: number, y: number): number => Math.hypot(x, y);
