/**
 * 404 Not Found Handler
 *
 * ## SUMMARY
 * Client-side 404 page that automatically redirects to home page.
 *
 * ## RESPONSIBILITIES
 * - Detect 404 navigation events
 * - Redirect user to home page via router
 *
 * @module app/not-found
 */

'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function NotFound() {
	const router = useRouter();

	useEffect(() => {
		router.push('/');
	}, [router]);

	return null;
}
