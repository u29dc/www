import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const baseSchema = z.object({
	title: z.string(),
	description: z.string(),
	date: z.coerce.date(),
	slug: z.string(),
	isArtifactItem: z.boolean().default(true),
	thumbnailMedia: z.string().optional(),
	hoverMedia: z.union([z.string(), z.array(z.string())]).optional(),
	hoverPosterMedia: z.string().optional(),
	hoverPreviewAlt: z.string().optional(),
	hoverPreviewFit: z.enum(['cover', 'contain']).optional(),
	ogImage: z.string().optional(),
	ogTextTone: z.enum(['auto', 'dark', 'light']).optional(),
	tags: z.array(z.string()).default([]),
});

const artifacts = defineCollection({
	loader: glob({ base: './src/content', pattern: '*.mdx' }),
	schema: z.discriminatedUnion('type', [
		baseSchema.extend({
			type: z.literal('study'),
			client: z.string(),
			role: z.string(),
			mode: z.enum(['COM', 'LAB', 'MAP']),
			venue: z.string().optional(),
			featured: z.boolean().optional(),
			isConfidential: z.boolean().optional(),
		}),
		baseSchema.extend({
			type: z.literal('fragment'),
			excerpt: z.string(),
		}),
	]),
});

export const collections = { artifacts };
