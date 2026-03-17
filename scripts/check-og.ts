import { readdir, readFile } from 'node:fs/promises';
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

	for (const filename of filenames) {
		const filePath = join(CONTENT_DIR, filename);
		const source = await readFile(filePath, 'utf8');
		const { data } = matter(source);
		const frontmatter = ContentSchema.parse(normalizeFrontmatter(data));
		if (!isPublicArtifact(frontmatter)) continue;

		targets.push({
			id: frontmatter.slug,
			title: frontmatter.title,
			...(frontmatter.ogImage ? { source: frontmatter.ogImage } : {}),
			...(frontmatter.ogTextTone ? { textTone: frontmatter.ogTextTone } : {}),
		});
	}

	return targets;
};

const formatResult = (target: OgCheckTarget): string => (target.source ? `${target.id} (${target.source})` : `${target.id} (no explicit source)`);

async function main(): Promise<void> {
	const targets = await getContentTargets();

	for (const target of targets) {
		const png = await renderOgCard(target);
		if (png.byteLength === 0) {
			throw new Error(`Generated empty OG card for ${formatResult(target)}`);
		}

		process.stdout.write(`OG OK ${formatResult(target)}\n`);
	}
}

await main();
