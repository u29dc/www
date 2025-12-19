/// <reference types="@sveltejs/kit" />

declare global {
	namespace App {
		interface Locals {
			nonce: string;
		}
	}
}

export {};
