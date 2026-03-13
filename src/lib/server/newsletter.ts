import { z } from 'zod';
import { ValidationError } from '$lib/errors';

const NEWSLETTER_EMAIL_MAX_LENGTH = 320;
const NEWSLETTER_SOURCE_MAX_LENGTH = 200;

const NewsletterSignupSchema = z.object({
	email: z.string().trim().min(1, 'Email is required').max(NEWSLETTER_EMAIL_MAX_LENGTH, 'Email is too long').email('Enter a valid email address'),
});

export type NewsletterSignupInput = {
	email: string;
	normalizedEmail: string;
	source: string;
	honeypotFilled: boolean;
};

export type NewsletterInsertResult = 'created' | 'existing';

const getStringField = (value: FormDataEntryValue | null): string => (typeof value === 'string' ? value : '');

const normalizeSource = (source: string): string => {
	const trimmed = source.trim();

	if (trimmed.length === 0 || trimmed.length > NEWSLETTER_SOURCE_MAX_LENGTH) {
		return '/';
	}

	if (!trimmed.startsWith('/')) {
		return '/';
	}

	return trimmed;
};

export function parseNewsletterSignup(formData: FormData): NewsletterSignupInput {
	const email = getStringField(formData.get('email'));
	const source = normalizeSource(getStringField(formData.get('source')));
	const honeypot = getStringField(formData.get('website')).trim();
	const honeypotFilled = honeypot.length > 0;

	if (honeypotFilled) {
		return {
			email: '',
			normalizedEmail: '',
			source,
			honeypotFilled: true,
		};
	}

	const parsed = NewsletterSignupSchema.safeParse({ email });

	if (!parsed.success) {
		throw new ValidationError('Enter a valid email address');
	}

	const cleanEmail = parsed.data.email;

	return {
		email: cleanEmail,
		normalizedEmail: cleanEmail.toLowerCase(),
		source,
		honeypotFilled: false,
	};
}

export function getNewsletterDatabase(platform: App.Platform | undefined): D1Database | null {
	return platform?.env.NEWSLETTER_DB ?? null;
}

export async function insertNewsletterSubscriber(database: D1Database, input: NewsletterSignupInput): Promise<NewsletterInsertResult> {
	const result = await database
		.prepare(
			`
				INSERT OR IGNORE INTO newsletter_subscribers (
					id,
					email,
					email_normalized,
					source
				) VALUES (?, ?, ?, ?)
			`,
		)
		.bind(crypto.randomUUID(), input.email, input.normalizedEmail, input.source)
		.run();

	return result.meta.changes > 0 ? 'created' : 'existing';
}
