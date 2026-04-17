export const CONTENT_SIGNAL_POLICY = 'ai-train=yes, search=yes, ai-input=yes';

export const CONTENT_SIGNAL_DIRECTIVE = `Content-Signal: ${CONTENT_SIGNAL_POLICY}`;

export const estimateMarkdownTokens = (markdown: string): number => {
	return Math.max(1, Math.ceil(markdown.length / 4));
};

export const appendVaryHeader = (headers: Headers, value: string): void => {
	const current = headers.get('vary');
	if (!current) {
		headers.set('vary', value);
		return;
	}

	const existing = current
		.split(',')
		.map((entry) => entry.trim().toLowerCase())
		.filter(Boolean);

	if (existing.includes(value.toLowerCase())) {
		return;
	}

	headers.set('vary', `${current}, ${value}`);
};
