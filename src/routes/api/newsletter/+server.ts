import { json } from '@sveltejs/kit';
import { ValidationError } from '$lib/errors';
import { createRequestLogger } from '$lib/server/logger';
import { getNewsletterDatabase, insertNewsletterSubscriber, parseNewsletterSignup } from '$lib/server/newsletter';
import type { RequestHandler } from './$types';

type NewsletterResponse = {
	ok: boolean;
	code: 'SUBSCRIBED' | 'INVALID_EMAIL' | 'UNAVAILABLE' | 'SERVER_ERROR';
	message: string;
};

const NO_STORE_HEADERS = {
	'cache-control': 'no-store',
};

const createSuccessResponse = (): NewsletterResponse => ({
	ok: true,
	code: 'SUBSCRIBED',
	message: "You're on the list.",
});

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const logger = createRequestLogger(locals.requestId, {
		route: '/api/newsletter',
	});

	try {
		const formData = await request.formData();
		const signup = parseNewsletterSignup(formData);

		if (signup.honeypotFilled) {
			logger.warn('Newsletter signup blocked by honeypot', {
				source: signup.source,
			});

			return json(createSuccessResponse(), {
				headers: NO_STORE_HEADERS,
			});
		}

		const database = getNewsletterDatabase(platform);

		if (!database) {
			logger.error('Newsletter signup unavailable: missing D1 binding');

			return json(
				{
					ok: false,
					code: 'UNAVAILABLE',
					message: 'Newsletter signup is unavailable right now.',
				} satisfies NewsletterResponse,
				{
					status: 503,
					headers: NO_STORE_HEADERS,
				},
			);
		}

		const result = await insertNewsletterSubscriber(database, signup);

		logger.info('Newsletter signup stored', {
			result,
			source: signup.source,
		});

		return json(createSuccessResponse(), {
			headers: NO_STORE_HEADERS,
		});
	} catch (error) {
		if (error instanceof ValidationError) {
			logger.warn('Newsletter signup rejected', {
				reason: error.message,
			});

			return json(
				{
					ok: false,
					code: 'INVALID_EMAIL',
					message: 'Enter a valid email address.',
				} satisfies NewsletterResponse,
				{
					status: 400,
					headers: NO_STORE_HEADERS,
				},
			);
		}

		logger.error('Newsletter signup failed', error);

		return json(
			{
				ok: false,
				code: 'SERVER_ERROR',
				message: 'Signup failed. Try again in a minute.',
			} satisfies NewsletterResponse,
			{
				status: 500,
				headers: NO_STORE_HEADERS,
			},
		);
	}
};
