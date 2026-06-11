export const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export const lerp = (from: number, to: number, amount: number): number => (1 - amount) * from + amount * to;

export const damp = (from: number, to: number, lambda: number, dt: number): number => lerp(from, to, 1 - Math.exp(-lambda * dt));
