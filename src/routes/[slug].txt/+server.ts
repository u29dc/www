import { handleRawContentRequest } from '$lib/server/raw';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	return handleRawContentRequest('txt', params.slug);
};
