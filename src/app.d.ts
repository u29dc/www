/// <reference types="@sveltejs/kit" />
/// <reference types="@cloudflare/workers-types" />

declare global {
	namespace App {
		interface Platform {
			env: {
				NEWSLETTER_DB?: D1Database;
			};
		}

		interface Locals {
			nonce: string;
			requestId: string;
		}
	}
}

export {};
