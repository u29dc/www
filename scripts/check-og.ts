import { readdir, readFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import { SITE } from '../src/lib/constants';
import { ContentSchema, isStudy } from '../src/lib/content-types';
import { getHomeOgSource, type OgTextTone, renderOgCard } from '../src/lib/server/og';

type OgCheckTarget = {
	id: string;
	title: string;
	source?: string;
	textTone?: OgTextTone;
};

const CONTENT_DIR = join(process.cwd(), 'src', 'content');

const parsePositiveInteger = (value: string | undefined): number | null => {
	if (!value) return null;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed < 1) {
		return null;
	}
	return parsed;
};

const DEFAULT_CONCURRENCY = Math.max(2, Math.min(parsePositiveInteger(process.env.CHECK_OG_CONCURRENCY) ?? availableParallelism(), 8));

async function mapConcurrent<TInput, TOutput>(items: readonly TInput[], concurrency: number, mapper: (item: TInput, index: number) => Promise<TOutput>): Promise<TOutput[]> {
	if (items.length === 0) return [];

	const limit = Math.max(1, Math.min(concurrency, items.length));
	const results = new Array<TOutput>(items.length);
	let nextIndex = 0;

	const worker = async (): Promise<void> => {
		while (nextIndex < items.length) {
			const currentIndex = nextIndex;
			nextIndex += 1;
			results[currentIndex] = await mapper(items[currentIndex], currentIndex);
		}
	};

	await Promise.all(Array.from({ length: limit }, () => worker()));
	return results;
}

const normalizeFrontmatter = (data: Record<string, unknown>): Record<string, unknown> => ({
	...data,
	...(data.date instanceof Date ? { date: data.date.toISOString() } : {}),
});

const isPublicArtifact = (frontmatter: (typeof ContentSchema)['_output']): boolean => {
	if (frontmatter.slug === 'llms') return false;
	if (frontmatter.isArtifactItem === false) return false;
	if (isStudy(frontmatter) && (frontmatter.isConfidential ?? false)) {
		return false;
	}
	return true;
};

const getContentTargets = async (): Promise<OgCheckTarget[]> => {
	const filenames = (await readdir(CONTENT_DIR)).filter((filename) => filename.endsWith('.mdx')).sort((left, right) => left.localeCompare(right));

	const targets: OgCheckTarget[] = [
		{
			id: 'home',
			title: SITE.title,
			source: getHomeOgSource(),
			textTone: 'auto',
		},
	];

	const contentTargets = await mapConcurrent(filenames, DEFAULT_CONCURRENCY, async (filename) => {
		const filePath = join(CONTENT_DIR, filename);
		const source = await readFile(filePath, 'utf8');
		const { data } = matter(source);
		const frontmatter = ContentSchema.parse(normalizeFrontmatter(data));
		if (!isPublicArtifact(frontmatter)) {
			return null;
		}

		return {
			id: frontmatter.slug,
			title: frontmatter.title,
			...(frontmatter.ogImage ? { source: frontmatter.ogImage } : {}),
			...(frontmatter.ogTextTone ? { textTone: frontmatter.ogTextTone } : {}),
		} satisfies OgCheckTarget;
	});

	for (const target of contentTargets) {
		if (!target) continue;
		targets.push(target);
	}

	return targets;
};

const formatResult = (target: OgCheckTarget): string => (target.source ? `${target.id} (${target.source})` : `${target.id} (no explicit source)`);

async function main(): Promise<void> {
	const targets = await getContentTargets();
	const start = performance.now();

	const results = await mapConcurrent(targets, DEFAULT_CONCURRENCY, async (target) => {
		const png = await renderOgCard(target);
		if (png.byteLength === 0) {
			throw new Error(`Generated empty OG card for ${formatResult(target)}`);
		}

		return `OG OK ${formatResult(target)}\n`;
	});

	for (const result of results) {
		process.stdout.write(result);
	}

	const durationMs = Math.round(performance.now() - start);
	process.stdout.write(`OG check completed for ${targets.length} cards in ${durationMs}ms with concurrency ${Math.min(DEFAULT_CONCURRENCY, targets.length)}\n`);
}

await main();
