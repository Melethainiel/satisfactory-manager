// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { JWTPayload } from 'jose';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user?: {
				sub: string;
				name?: string;
				email?: string;
				scopes?: string[];
				raw: JWTPayload;
			};
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
