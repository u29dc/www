export const linear = (t: number): number => t;

export const quadIn = (t: number): number => t * t;

export const quadOut = (t: number): number => 1 - (1 - t) * (1 - t);

export const quadInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export const cubicIn = (t: number): number => t * t * t;

export const cubicOut = (t: number): number => 1 - (1 - t) ** 3;

export const cubicInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export const expoOut = (t: number): number => (t === 1 ? 1 : 1 - 2 ** (-10 * t));
