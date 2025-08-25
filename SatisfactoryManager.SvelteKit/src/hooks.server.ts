/**
 * SvelteKit hooks for server-side request handling
 *
 * This module handles authentication, internationalization, and request processing
 * using the centralized configuration system.
 */

import type { Handle } from '@sveltejs/kit';
import { warn } from 'console';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { locale } from 'svelte-i18n';
import { getAzureB2CConfig } from '$lib/config/auth.config.js';
import { getServerEnvVar } from '$lib/config/env.server.js';

// Initialize authentication configuration asynchronously
let authConfigPromise: Promise<{
	authConfig: any;
	authorityUrl: URL;
	TENANT_DOMAIN: string;
	CLIENT_ID: string;
	TENANT_DOMAIN_ID: string;
	REQUIRED_SCOPE: string;
	POLICY: string;
	jwks: any;
}> | null = null;

async function initAuthConfig() {
	if (authConfigPromise) return authConfigPromise;

	authConfigPromise = (async () => {
		// Get Azure B2C configuration using the centralized system
		const authConfig = await getAzureB2CConfig();

		// Parse configuration values
		const authorityUrl = new URL(authConfig.authority);
		const TENANT_DOMAIN = authConfig.knownAuthorities[0] || authorityUrl.hostname;
		const CLIENT_ID = authConfig.clientId;

		// Extract tenant ID - use explicit configuration or fallback to known value
		// The tenant ID is the GUID, not the domain name (satisfactorymanager.onmicrosoft.com)
		const TENANT_DOMAIN_ID =
			getServerEnvVar('AZURE_B2C_TENANT_ID') || '2b83dcfa-e885-4b3d-a9c9-570fae5ab5c7';

		// API scope configuration
		const REQUIRED_SCOPE = getServerEnvVar('AZURE_B2C_API_SCOPE') || 'access_users';

		// Extract policy from authority URL
		const pathSegments = authorityUrl.pathname.split('/');
		const POLICY = (
			getServerEnvVar('AZURE_B2C_POLICY') ||
			pathSegments[pathSegments.length - 1] ||
			'B2C_1_SignInSignUp'
		).toLowerCase();

		// Build JWKS URL for token verification
		// Format: https://<tenant>.b2clogin.com/<tenant>.onmicrosoft.com/<policy>/discovery/v2.0/keys
		const jwksUrl = `https://${TENANT_DOMAIN}/${TENANT_DOMAIN.split('.')[0]}.onmicrosoft.com/${POLICY}/discovery/v2.0/keys`;
		const jwks = createRemoteJWKSet(new URL(jwksUrl));

		return {
			authConfig,
			authorityUrl,
			TENANT_DOMAIN,
			CLIENT_ID,
			TENANT_DOMAIN_ID,
			REQUIRED_SCOPE,
			POLICY,
			jwks
		};
	})();

	return authConfigPromise;
}

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
		const config = await initAuthConfig();
		const issuerEndpointUrl = `https://${config.TENANT_DOMAIN}/${config.TENANT_DOMAIN_ID}/v2.0/`;
		const { payload } = await jwtVerify(token, config.jwks, {
			issuer: [issuerEndpointUrl],
			audience: config.CLIENT_ID
		});

		// Scope check
		const scpRaw = payload['scp'];
		const scopes = typeof scpRaw === 'string' ? scpRaw.split(' ') : [];
		if (!scopes.includes(config.REQUIRED_SCOPE)) return null;

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
