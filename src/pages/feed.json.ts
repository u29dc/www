import type { APIRoute } from 'astro';
import { getPublicArtifacts, type ArtifactEntry } from '../lib/artifacts';
import { SITE } from '../data/site';
import { artifactMarkdownUrl, artifactTextUrl, artifactUrl } from '../lib/markdown';
import { absoluteSiteUrl } from '../lib/seo';

type JsonFeedAuthor = {
	name: string;
	url: string;
};

type JsonFeedItem = {
	id: string;
	url: string;
	title: string;
	summary: string;
	content_text: string;
	date_published: string;
	tags: string[];
	_u29dc: {
		type: 'study' | 'fragment';
		markdown_url: string;
		text_url: string;
		client?: string;
		role?: string;
		mode?: string;
		venue?: string;
	};
};

type JsonFeed = {
	version: 'https://jsonfeed.org/version/1.1';
	title: string;
	home_page_url: string;
	feed_url: string;
	description: string;
	language: string;
	authors: JsonFeedAuthor[];
	items: JsonFeedItem[];
};

const getArtifactContentText = (entry: ArtifactEntry): string =>
	[entry.data.description, `Web: ${artifactUrl(entry)}`, `Markdown: ${artifactMarkdownUrl(entry)}`, `Text: ${artifactTextUrl(entry)}`].join('\n\n');

const getArtifactTags = (entry: ArtifactEntry): string[] => {
	const typeTag = entry.data.type === 'study' ? 'study' : 'writing';
	return [typeTag, ...entry.data.tags];
};

const buildItem = (entry: ArtifactEntry): JsonFeedItem => {
	const url = artifactUrl(entry);
	const extension: JsonFeedItem['_u29dc'] = {
		type: entry.data.type,
		markdown_url: artifactMarkdownUrl(entry),
		text_url: artifactTextUrl(entry),
	};

	if (entry.data.type === 'study') {
		extension.client = entry.data.client;
		extension.role = entry.data.role;
		extension.mode = entry.data.mode;
		if (entry.data.venue) extension.venue = entry.data.venue;
	}

	return {
		id: url,
		url,
		title: entry.data.title,
		summary: entry.data.description,
		content_text: getArtifactContentText(entry),
		date_published: entry.data.date.toISOString(),
		tags: getArtifactTags(entry),
		_u29dc: extension,
	};
};

const buildFeed = (artifacts: ArtifactEntry[]): JsonFeed => ({
	version: 'https://jsonfeed.org/version/1.1',
	title: SITE.name,
	home_page_url: SITE.url,
	feed_url: absoluteSiteUrl(SITE.feeds.json),
	description: SITE.description,
	language: SITE.lang,
	authors: [
		{
			name: SITE.creator,
			url: SITE.url,
		},
	],
	items: artifacts.map(buildItem),
});

export const GET: APIRoute = async () => {
	const artifacts = await getPublicArtifacts();

	return new Response(JSON.stringify(buildFeed(artifacts)), {
		headers: {
			'Cache-Control': 'public, max-age=0, must-revalidate',
			'Content-Type': 'application/feed+json; charset=utf-8',
			'X-Content-Type-Options': 'nosniff',
		},
	});
};
