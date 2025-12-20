export const SITE = {
	title: 'Incomplete Infinity',
	name: 'Incomplete Infinity',
	description: 'We turn complex futures into decision-grade narratives',
	url: 'https://u29dc.com',
	locale: 'en-GB',
	themeColor: '#000000',
	backgroundColor: '#FFFFFF',
	keywords: ['design', 'creative', 'media'],
	creator: 'u29dc',
} as const;

export const CDN = {
	baseUrl: 'https://storage.u29dc.com',
	hostname: 'storage.u29dc.com',
	mediaPath: '/media/',
	get mediaUrl(): string {
		return `${this.baseUrl}${this.mediaPath}`;
	},
} as const;

const env = typeof process !== 'undefined' ? (process.env as { PUBLIC_COMMIT_SHA?: string; COMMIT_SHA?: string }) : undefined;
const commitSha = env ? (env.PUBLIC_COMMIT_SHA ?? env.COMMIT_SHA) : undefined;

export const BUILD = {
	commitSha: commitSha ? commitSha.slice(0, 7) : 'f5eb94f',
} as const;
