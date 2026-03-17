import { z } from 'zod';

const OgTextToneSchema = z.enum(['auto', 'light', 'dark']);

export const StudySchema = z.object({
	type: z.literal('study'),
	date: z.iso.datetime(),
	title: z.string().min(1),
	description: z.string().min(1),
	slug: z.string().min(1),
	isArtifactItem: z.boolean(),

	client: z.string().min(1),
	mode: z.enum(['MAP', 'LAB', 'COM']),
	thumbnailMedia: z.string().optional(),
	ogImage: z.string().optional(),
	ogImageAlt: z.string().optional(),
	ogTextTone: OgTextToneSchema.optional(),
	isConfidential: z.boolean().optional().default(false),
});

export const FragmentSchema = z.object({
	type: z.literal('fragment'),
	date: z.iso.datetime(),
	title: z.string().min(1),
	description: z.string().min(1),
	slug: z.string().min(1),
	isArtifactItem: z.boolean(),

	excerpt: z.string().optional(),
	thumbnailMedia: z.string().optional(),
	ogImage: z.string().optional(),
	ogImageAlt: z.string().optional(),
	ogTextTone: OgTextToneSchema.optional(),
});

export const SignalSchema = z.object({
	type: z.literal('signal'),
	date: z.iso.datetime(),
	title: z.string().min(1),
	description: z.string().min(1),
	slug: z.string().min(1),
	isArtifactItem: z.boolean(),

	link: z.url().optional(),
	thumbnailMedia: z.string().optional(),
	ogImage: z.string().optional(),
	ogImageAlt: z.string().optional(),
	ogTextTone: OgTextToneSchema.optional(),
});

export const MetaSchema = z.object({
	type: z.literal('meta'),
	date: z.iso.datetime(),
	title: z.string().min(1),
	description: z.string().min(1),
	slug: z.string().min(1),
	isArtifactItem: z.boolean(),

	thumbnailMedia: z.string().optional(),
	ogImage: z.string().optional(),
	ogImageAlt: z.string().optional(),
	ogTextTone: OgTextToneSchema.optional(),
});

export const ContentSchema = z.discriminatedUnion('type', [StudySchema, FragmentSchema, SignalSchema, MetaSchema]);

export type StudyContent = z.infer<typeof StudySchema>;
export type FragmentContent = z.infer<typeof FragmentSchema>;
export type SignalContent = z.infer<typeof SignalSchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type ContentItem = z.infer<typeof ContentSchema>;

export interface ParsedContent {
	frontmatter: ContentItem;
	content: string;
}

export function isStudy(item: ContentItem): item is StudyContent {
	return item.type === 'study';
}

export function isFragment(item: ContentItem): item is FragmentContent {
	return item.type === 'fragment';
}

export function isSignal(item: ContentItem): item is SignalContent {
	return item.type === 'signal';
}

export function isMeta(item: ContentItem): item is Meta {
	return item.type === 'meta';
}
