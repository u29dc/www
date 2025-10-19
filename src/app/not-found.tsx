/**
 * 404 Not Found Handler
 *
 * ## SUMMARY
 * Server-side 404 page that instantly redirects to home page.
 *
 * ## RESPONSIBILITIES
 * - Detect 404 navigation events
 * - Redirect user to home page via server-side redirect
 *
 * @module app/not-found
 */

import { redirect } from 'next/navigation';

export default function NotFound() {
	redirect('/');
}
