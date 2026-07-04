import type { APIRoute } from 'astro';
import { absoluteSiteUrl } from '../lib/seo';

const CONTENT_SIGNAL_DIRECTIVE = 'Content-Signal: ai-train=yes, search=yes, ai-input=yes';

const robots = [
	'User-agent: *',
	'Allow: /',
	'Allow: /llms.txt',
	'Allow: /rss.xml',
	'Allow: /feed.json',
	'',
	'# Explicit AI bot policy: training and retrieval crawlers are allowed.',
	'User-agent: GPTBot',
	'Allow: /',
	'',
	'User-agent: ClaudeBot',
	'Allow: /',
	'',
	'User-agent: Google-Extended',
	'Allow: /',
	'',
	'User-agent: Applebot-Extended',
	'Allow: /',
	'',
	'User-agent: CCBot',
	'Allow: /',
	'',
	'User-agent: Bytespider',
	'Allow: /',
	'',
	'User-agent: ChatGPT-User',
	'Allow: /',
	'',
	'User-agent: OAI-SearchBot',
	'Allow: /',
	'',
	'User-agent: PerplexityBot',
	'Allow: /',
	'',
	CONTENT_SIGNAL_DIRECTIVE,
	`Sitemap: ${absoluteSiteUrl('/sitemap.xml')}`,
	'',
].join('\n');

export const GET: APIRoute = () =>
	new Response(robots, {
		headers: {
			'Cache-Control': 'public, max-age=0, must-revalidate',
			'Content-Type': 'text/plain; charset=utf-8',
			'X-Content-Type-Options': 'nosniff',
		},
	});
