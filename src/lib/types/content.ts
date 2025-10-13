/**
 * Content Type Definitions
 *
 * ## SUMMARY
 * TypeScript types and Zod schemas for MDX content with discriminated union pattern.
 * Provides runtime validation and type safety for all content items.
 *
 * ## RESPONSIBILITIES
 * - Define Zod schemas for Study, Fragment, and Signal content types
 * - Export TypeScript types inferred from Zod schemas
 * - Provide type guard functions for discriminated union narrowing
 * - Enable runtime validation of MDX frontmatter
 *
 * ## USAGE
 * ```tsx
 * import { ContentSchema, isStudy } from '@/lib/types/content';
 * import type { ContentItem, StudyContent } from '@/lib/types/content';
 *
 * // Runtime validation
 * const validated = ContentSchema.parse(unknownData);
 *
 * // Type narrowing
 * if (isStudy(item)) {
 *   console.log(item.client); // TypeScript knows this exists
 * }
 * ```
 */

import { z } from 'zod';

/**
 * Study Schema - Case Studies / Project Work
 *
 * Represents completed client work or portfolio projects.
 * Includes client information, role, and project metadata.
 */
export const StudySchema = z.object({
	type: z.literal('study'),
	date: z.iso.datetime(),
	title: z.string().min(1),
	description: z.string().min(1),
	slug: z.string().min(1),
	client: z.string().min(1),
	role: z.string().min(1),
	year: z.number().int().min(2000).max(2100),
	mode: z.enum(['LAB', 'COM']),
	image: z.string().optional(),
	featured: z.boolean().optional(),
	isFeedItem: z.boolean(),
});

/**
 * Fragment Schema - Thoughts / Articles / Reflections
 *
 * Represents written content, essays, or thought pieces.
 * Includes excerpt for preview display.
 */
export const FragmentSchema = z.object({
	type: z.literal('fragment'),
	date: z.iso.datetime(),
	title: z.string().min(1),
	description: z.string().min(1),
	slug: z.string().min(1),
	excerpt: z.string().optional(),
	image: z.string().optional(),
	isFeedItem: z.boolean(),
});

/**
 * Signal Schema - News / Updates / Announcements
 *
 * Represents studio updates, news, or external links.
 * Includes optional source attribution and external link.
 */
export const SignalSchema = z.object({
	type: z.literal('signal'),
	date: z.iso.datetime(),
	title: z.string().min(1),
	description: z.string().min(1),
	slug: z.string().min(1),
	source: z.string().optional(),
	link: z.url().optional(),
	image: z.string().optional(),
	isFeedItem: z.boolean(),
});

/**
 * Meta Schema - Metadata / About Pages
 *
 * Represents metadata content, informational pages, or about sections.
 * General-purpose content type for non-categorized pages.
 */
export const MetaSchema = z.object({
	type: z.literal('meta'),
	date: z.iso.datetime(),
	title: z.string().min(1),
	description: z.string().min(1),
	slug: z.string().min(1),
	isFeedItem: z.boolean(),
	image: z.string().optional(),
});

/**
 * Content Schema - Discriminated Union
 *
 * Combines all content types into a single discriminated union.
 * The 'type' field discriminates between Study, Fragment, Signal, and Meta.
 */
export const ContentSchema = z.discriminatedUnion('type', [
	StudySchema,
	FragmentSchema,
	SignalSchema,
	MetaSchema,
]);

/**
 * TypeScript Types (inferred from Zod schemas)
 */
export type StudyContent = z.infer<typeof StudySchema>;
export type FragmentContent = z.infer<typeof FragmentSchema>;
export type SignalContent = z.infer<typeof SignalSchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type ContentItem = z.infer<typeof ContentSchema>;

/**
 * Full Parsed Content
 *
 * Represents a complete MDX document with validated frontmatter and body content.
 */
export interface ParsedContent {
	frontmatter: ContentItem;
	content: string;
}

/**
 * Type Guard: Check if content is a Study
 *
 * @param item - Content item to check
 * @returns True if item is StudyContent
 */
export function isStudy(item: ContentItem): item is StudyContent {
	return item.type === 'study';
}

/**
 * Type Guard: Check if content is a Fragment
 *
 * @param item - Content item to check
 * @returns True if item is FragmentContent
 */
export function isFragment(item: ContentItem): item is FragmentContent {
	return item.type === 'fragment';
}

/**
 * Type Guard: Check if content is a Signal
 *
 * @param item - Content item to check
 * @returns True if item is SignalContent
 */
export function isSignal(item: ContentItem): item is SignalContent {
	return item.type === 'signal';
}

/**
 * Type Guard: Check if content is a Meta
 *
 * @param item - Content item to check
 * @returns True if item is Meta
 */
export function isMeta(item: ContentItem): item is Meta {
	return item.type === 'meta';
}
