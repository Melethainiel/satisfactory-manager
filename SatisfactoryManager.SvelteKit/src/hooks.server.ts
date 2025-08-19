import type { Handle } from '@sveltejs/kit';
import { warn } from 'console';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { locale } from 'svelte-i18n';

// Environment / configuration
// These could be moved to a dedicated config file if needed.
const TENANT_DOMAIN = process.env.AZURE_B2C_KNOWN_AUTHORITY || 'satisfactorymanager.b2clogin.com';
const TENANT_DOMAIN_ID = process.env.AZURE_B2C_TENANT_ID || '2b83dcfa-e885-4b3d-a9c9-570fae5ab5c7';
const CLIENT_ID = process.env.AZURE_B2C_CLIENT_ID || '71d43619-ad3d-49d4-bae9-97e38ec57dc4';
// Exposed API scope we expect in `scp` claim (space separated list). Only the scope name portion, not full URI, will appear in scp.
// If your scope is defined as: https://SatisfactoryManager.onmicrosoft.com/71d43619-ad3d-49d4-bae9-97e38ec57dc4/access_users
// then the token's scp claim should contain "access_users".
const REQUIRED_SCOPE = 'access_users';

// JWKS endpoint pattern for Azure AD B2C (v2). The {policy} part must match the user flow used to issue the token.
// If you have multiple policies, you may need a mapping; for now we assume the single sign-in/sign-up policy used at login.
const POLICY = (process.env.AZURE_B2C_POLICY || 'B2C_1_SignInSignUp').toLowerCase();

// Example: https://<tenant>.b2clogin.com/<tenant>.onmicrosoft.com/<policy>/discovery/v2.0/keys
const jwksUrl = `https://${TENANT_DOMAIN}/${TENANT_DOMAIN.split('.')[0]}.onmicrosoft.com/${POLICY}/discovery/v2.0/keys`;
const jwks = createRemoteJWKSet(new URL(jwksUrl));

// Extend locals with auth info
interface AuthUserLocals {
	sub: string;
	name?: string;
	email?: string;
	scopes?: string[];
	raw: JWTPayload;
}

declare module '@sveltejs/kit' {
	interface Locals {
		user?: AuthUserLocals;
	}
}

async function verifyBearer(token: string): Promise<AuthUserLocals | null> {
	try {
		const issuerEndpointUrl = `https://${TENANT_DOMAIN}/${TENANT_DOMAIN_ID}/v2.0/`;
		const { payload } = await jwtVerify(token, jwks, {
			issuer: [issuerEndpointUrl],
			audience: CLIENT_ID
		});

		// Scope check
		const scpRaw = payload['scp'];
		const scopes = typeof scpRaw === 'string' ? scpRaw.split(' ') : [];
		if (!scopes.includes(REQUIRED_SCOPE)) return null;

		return {
			sub: String(payload.sub),
			name: typeof payload.name === 'string' ? payload.name : undefined,
			email: Array.isArray((payload as any).emails)
				? (payload as any).emails[0]
				: (payload as any).email,
			scopes,
			raw: payload
		};
	} catch (e) {
		// Silently ignore invalid tokens; downstream route can decide if auth required
		warn('Failed to verify token:', e);
		return null;
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	const urlPath = event.url.pathname;

	// Handle i18n locale detection from Accept-Language header
	const lang = event.request.headers.get('accept-language')?.split(',')[0];
	if (lang) {
		const supportedLocales = ['en', 'fr'];
		const detectedLocale = lang.slice(0, 2);
		if (supportedLocales.includes(detectedLocale)) {
			locale.set(detectedLocale);
		}
	}

	const authHeader =
		event.request.headers.get('authorization') || event.request.headers.get('Authorization');

	if (authHeader?.startsWith('Bearer ')) {
		const token = authHeader.substring('Bearer '.length).trim();
		const user = await verifyBearer(token);
		if (user) event.locals.user = user;
	}

	// Enforce authentication for all API routes
	if (urlPath.startsWith('/api')) {
		// Allow CORS preflight or similar OPTIONS without auth enforcement
		if (event.request.method === 'OPTIONS') {
			return new Response(null, { status: 204 });
		}
		if (!event.locals.user) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'content-type': 'application/json' }
			});
		}
	}

	return resolve(event);
};
