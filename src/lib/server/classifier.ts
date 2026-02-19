const AGENT_UA_PATTERNS = [
	{ id: 'curl', pattern: /\bcurl\b/i },
	{ id: 'wget', pattern: /\bwget\b/i },
	{ id: 'httpie', pattern: /\bhttpie\b/i },
	{ id: 'chatgpt-user', pattern: /\bChatGPT-User\b/i },
	{ id: 'gptbot', pattern: /\bGPTBot\b/i },
	{ id: 'claudebot', pattern: /\bClaudeBot\b/i },
	{ id: 'claude-web', pattern: /\bClaude-Web\b/i },
	{ id: 'anthropic', pattern: /\bAnthropic\b/i },
	{ id: 'perplexitybot', pattern: /\bPerplexityBot\b/i },
	{ id: 'coherebot', pattern: /\bCohereBot\b/i },
	{ id: 'copilot', pattern: /\bCopilot\b/i },
	{ id: 'ai2-bot', pattern: /\bai2-bot\b/i },
	{ id: 'ccbot', pattern: /\bCCBot\b/i },
	{ id: 'google-extended', pattern: /\bGoogle-Extended\b/i },
	{ id: 'applebot-extended', pattern: /\bApplebot-Extended\b/i },
	{ id: 'bytespider', pattern: /\bBytespider\b/i },
	{ id: 'youbot', pattern: /\bYouBot\b/i },
] as const;

const HTML_ALLOWLIST_UA_PATTERNS = [
	{ id: 'googlebot', pattern: /Googlebot/i },
	{ id: 'bingbot', pattern: /Bingbot/i },
	{ id: 'duckduckbot', pattern: /DuckDuckBot/i },
	{ id: 'slurp', pattern: /Slurp/i },
	{ id: 'twitterbot', pattern: /Twitterbot/i },
	{ id: 'facebookexternalhit', pattern: /facebookexternalhit/i },
	{ id: 'linkedinbot', pattern: /LinkedInBot/i },
	{ id: 'discordbot', pattern: /Discordbot/i },
	{ id: 'slackbot', pattern: /Slackbot/i },
	{ id: 'whatsapp', pattern: /WhatsApp/i },
	{ id: 'telegrambot', pattern: /TelegramBot/i },
] as const;

const BROWSER_UA_PATTERN = /(Mozilla\/5\.0).*(Chrome|CriOS|Safari|Firefox|FxiOS|Edg|Edge|OPR|SamsungBrowser)/i;

export type AgentRedirectMode = 'off' | 'shadow' | 'enforce';

export type AgentRedirectConfidence = 'high' | 'medium' | 'low';

export type AgentRedirectReason =
	| 'method_not_eligible'
	| 'path_not_eligible'
	| 'allowlisted_user_agent'
	| 'agent_user_agent_match'
	| 'accept_prefers_plain_text'
	| 'accept_signal_ignored_without_ua_match'
	| 'browser_signal_override'
	| 'no_agent_signals';

export interface AgentRedirectClassification {
	eligible: boolean;
	mode: AgentRedirectMode;
	shouldRedirect: boolean;
	wouldRedirect: boolean;
	confidence: AgentRedirectConfidence;
	reasonCodes: AgentRedirectReason[];
	agentPatternId?: string;
	allowlistPatternId?: string;
	browserSignals: string[];
	acceptPrefersPlainText: boolean;
}

type ParsedAcceptType = {
	type: string;
	q: number;
};

const isEligiblePath = (path: string): boolean => {
	if (path.startsWith('/api')) return false;
	if (path.endsWith('.txt') || path.endsWith('.md')) return false;
	if (path.includes('.')) return false;
	return true;
};

const parseAcceptTypes = (acceptHeader: string): ParsedAcceptType[] => {
	if (!acceptHeader) return [];

	return acceptHeader.split(',').map((entry) => {
		const [type, ...params] = entry.trim().split(';');
		const qParam = params.find((param) => param.trim().startsWith('q='));
		const qValue = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
		const q = Number.isFinite(qValue) ? qValue : 1;

		return {
			type: type?.trim().toLowerCase() ?? '',
			q,
		};
	});
};

const getAcceptQuality = (types: ParsedAcceptType[], target: string): number => types.reduce((max, item) => (item.type === target ? Math.max(max, item.q) : max), 0);

const prefersPlainText = (types: ParsedAcceptType[]): boolean => {
	if (types.length === 0) return false;
	if (types.some((item) => item.type === '*/*')) return false;

	const htmlQuality = Math.max(getAcceptQuality(types, 'text/html'), getAcceptQuality(types, 'application/xhtml+xml'));

	const plainQuality = Math.max(getAcceptQuality(types, 'text/plain'), getAcceptQuality(types, 'text/markdown'));

	return plainQuality > 0 && htmlQuality === 0;
};

const matchPatternId = (input: string, patterns: readonly { id: string; pattern: RegExp }[]): string | undefined => {
	for (const pattern of patterns) {
		if (pattern.pattern.test(input)) return pattern.id;
	}
	return undefined;
};

const collectBrowserSignals = (request: Request, userAgent: string, acceptTypes: ParsedAcceptType[]): string[] => {
	const signals: string[] = [];

	if (BROWSER_UA_PATTERN.test(userAgent)) {
		signals.push('ua_browser_family');
	}

	const secFetchMode = request.headers.get('sec-fetch-mode');
	if (secFetchMode?.toLowerCase() === 'navigate') {
		signals.push('sec_fetch_navigate');
	}

	const secFetchDest = request.headers.get('sec-fetch-dest');
	if (secFetchDest?.toLowerCase() === 'document') {
		signals.push('sec_fetch_document');
	}

	if (request.headers.has('accept-language')) {
		signals.push('accept_language');
	}

	const htmlQuality = Math.max(getAcceptQuality(acceptTypes, 'text/html'), getAcceptQuality(acceptTypes, 'application/xhtml+xml'));
	if (htmlQuality > 0) {
		signals.push('accept_html');
	}

	return signals;
};

const createIneligibleClassification = (mode: AgentRedirectMode, reason: AgentRedirectReason): AgentRedirectClassification => ({
	eligible: false,
	mode,
	shouldRedirect: false,
	wouldRedirect: false,
	confidence: 'low',
	reasonCodes: [reason],
	browserSignals: [],
	acceptPrefersPlainText: false,
});

const createAllowlistedClassification = (mode: AgentRedirectMode, allowlistPatternId: string): AgentRedirectClassification => ({
	eligible: true,
	mode,
	shouldRedirect: false,
	wouldRedirect: false,
	confidence: 'low',
	reasonCodes: ['allowlisted_user_agent'],
	allowlistPatternId,
	browserSignals: [],
	acceptPrefersPlainText: false,
});

const collectReasonCodes = ({
	agentPatternId,
	acceptPrefersPlainText,
	browserSignalsOverride,
}: {
	agentPatternId?: string;
	acceptPrefersPlainText: boolean;
	browserSignalsOverride: boolean;
}): AgentRedirectReason[] => {
	const reasonCodes: AgentRedirectReason[] = [];

	if (agentPatternId) {
		reasonCodes.push('agent_user_agent_match');
	}
	if (acceptPrefersPlainText) {
		reasonCodes.push('accept_prefers_plain_text');
	}
	if (browserSignalsOverride) {
		reasonCodes.push('browser_signal_override');
	}
	if (acceptPrefersPlainText && !agentPatternId) {
		reasonCodes.push('accept_signal_ignored_without_ua_match');
	}
	if (!agentPatternId && !acceptPrefersPlainText) {
		reasonCodes.push('no_agent_signals');
	}

	return reasonCodes;
};

const getConfidence = ({ wouldRedirect, agentPatternId, acceptPrefersPlainText }: { wouldRedirect: boolean; agentPatternId?: string; acceptPrefersPlainText: boolean }): AgentRedirectConfidence => {
	if (wouldRedirect) return 'high';
	if (agentPatternId || acceptPrefersPlainText) return 'medium';
	return 'low';
};

export const parseAgentRedirectMode = (value: string | null | undefined): AgentRedirectMode => {
	switch (value?.trim().toLowerCase()) {
		case 'enforce':
		case 'on':
		case 'true':
		case '1':
			return 'enforce';
		case 'shadow':
			return 'shadow';
		case 'off':
		case 'disabled':
		case 'false':
		case '0':
			return 'off';
		default:
			return 'off';
	}
};

export const classifyAgentRedirectRequest = ({ request, path, mode }: { request: Request; path: string; mode: AgentRedirectMode }): AgentRedirectClassification => {
	const method = request.method.toUpperCase();
	if (method !== 'GET' && method !== 'HEAD') {
		return createIneligibleClassification(mode, 'method_not_eligible');
	}

	if (!isEligiblePath(path)) {
		return createIneligibleClassification(mode, 'path_not_eligible');
	}

	const userAgent = request.headers.get('user-agent') ?? '';
	const allowlistPatternId = matchPatternId(userAgent, HTML_ALLOWLIST_UA_PATTERNS);
	if (allowlistPatternId) {
		return createAllowlistedClassification(mode, allowlistPatternId);
	}

	const acceptTypes = parseAcceptTypes(request.headers.get('accept') ?? '');
	const acceptPrefersPlainText = prefersPlainText(acceptTypes);
	const browserSignals = collectBrowserSignals(request, userAgent, acceptTypes);
	const browserSignalsOverride = browserSignals.length >= 2;
	const agentPatternId = matchPatternId(userAgent, AGENT_UA_PATTERNS);
	const reasonCodes = collectReasonCodes({
		acceptPrefersPlainText,
		browserSignalsOverride,
		...(agentPatternId ? { agentPatternId } : {}),
	});

	const wouldRedirect = Boolean(agentPatternId) && !browserSignalsOverride;
	const confidence = getConfidence({
		wouldRedirect,
		acceptPrefersPlainText,
		...(agentPatternId ? { agentPatternId } : {}),
	});
	const shouldRedirect = mode === 'enforce' && wouldRedirect;

	return {
		eligible: true,
		mode,
		shouldRedirect,
		wouldRedirect,
		confidence,
		reasonCodes,
		browserSignals,
		acceptPrefersPlainText,
		...(agentPatternId ? { agentPatternId } : {}),
	};
};
