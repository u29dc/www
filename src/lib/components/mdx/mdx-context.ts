export type MediaLayoutContextValue = {
	registerItem: (id: string, aspectRatio: number) => void;
	getFlexBasis: (id: string) => string;
};

export const MEDIA_LAYOUT_CONTEXT = Symbol('mdx-media');
