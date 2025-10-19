/**
 * MDX Type Definitions (Shared Client/Server)
 *
 * ## SUMMARY
 * Shared type definitions, schemas, and type guards accessible from both client and server.
 *
 * ## RESPONSIBILITIES
 * - Define Zod schemas for content validation
 * - Export TypeScript types for type safety
 * - Provide type guard functions for runtime type checking
 *
 * @module lib/mdx-types
 */

import { z } from 'zod';

// ==================================================
// SCHEMAS
// ==================================================

export const StudySchema = z.object({
	type: z.literal('study'),
	date: z.iso.datetime(),
	title: z.string().min(1),
	description: z.string().min(1),
	slug: z.string().min(1),
	isFeedItem: z.boolean(),

	client: z.string().min(1),
	role: z.string().min(1),
	year: z.number().int().min(2000).max(2100),
	mode: z.enum(['LAB', 'COM']),
	thumbnailMedia: z.string().optional(),
});

export const FragmentSchema = z.object({
	type: z.literal('fragment'),
	date: z.iso.datetime(),
	title: z.string().min(1),
	description: z.string().min(1),
	slug: z.string().min(1),
	isFeedItem: z.boolean(),

	excerpt: z.string().optional(),
	thumbnailMedia: z.string().optional(),
});

export const SignalSchema = z.object({
	type: z.literal('signal'),
	date: z.iso.datetime(),
	title: z.string().min(1),
	description: z.string().min(1),
	slug: z.string().min(1),
	isFeedItem: z.boolean(),

	link: z.url().optional(),
	thumbnailMedia: z.string().optional(),
});

export const MetaSchema = z.object({
	type: z.literal('meta'),
	date: z.iso.datetime(),
	title: z.string().min(1),
	description: z.string().min(1),
	slug: z.string().min(1),
	isFeedItem: z.boolean(),

	thumbnailMedia: z.string().optional(),
});

export const ContentSchema = z.discriminatedUnion('type', [
	StudySchema,
	FragmentSchema,
	SignalSchema,
	MetaSchema,
]);

// ==================================================
// TYPES
// ==================================================

export type StudyContent = z.infer<typeof StudySchema>;
export type FragmentContent = z.infer<typeof FragmentSchema>;
export type SignalContent = z.infer<typeof SignalSchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type ContentItem = z.infer<typeof ContentSchema>;

export interface ParsedContent {
	frontmatter: ContentItem;
	content: string;
}

// ==================================================
// TYPE GUARDS
// ==================================================

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
