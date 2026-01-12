/**
 * Client-side Azure B2C authentication configuration
 *
 * This module provides authentication configuration that is SAFE for client-side use.
 * It only uses PUBLIC environment variables and browser APIs.
 */

import { browser } from '$app/environment';

/**
 * Azure B2C configuration interface for client-side
 */
export interface ClientAzureB2CConfig {
	clientId: string;
	authority: string;
	knownAuthorities: string[];
	redirectUri?: string;
	postLogoutRedirectUri?: string;
	scopes?: string[];
}

/**
 * MSAL (Microsoft Authentication Library) configuration
 * Compatible with @azure/msal-browser
 */
export interface MSALConfig {
	auth: {
		clientId: string;
		authority: string;
		knownAuthorities: string[];
		redirectUri?: string;
		postLogoutRedirectUri?: string;
	};
	cache?: {
		cacheLocation: 'localStorage' | 'sessionStorage';
		storeAuthStateInCookie?: boolean;
	};
	system?: {
		loggerOptions?: {
			loggerCallback: (level: number, message: string, containsPii: boolean) => void;
			logLevel: number;
			piiLoggingEnabled: boolean;
		};
	};
}

/**
 * Gets Azure B2C configuration for client-side use only
 * This function can ONLY be called in browser context
 */
export async function getClientAzureB2CConfig(): Promise<ClientAzureB2CConfig> {
	if (!browser) {
		throw new Error('getClientAzureB2CConfig can only be called in browser context');
	}

	// Import client environment functions only when needed
	const { getPublicConfig, getKnownAuthorities } = await import('./env.client.js');
	const publicConfig = getPublicConfig();

	return {
		clientId: publicConfig.PUBLIC_AZURE_B2C_CLIENT_ID,
		authority: publicConfig.PUBLIC_AZURE_B2C_AUTHORITY,
		knownAuthorities: getKnownAuthorities(),
		redirectUri: window.location.origin,
		postLogoutRedirectUri: window.location.origin,
		scopes: ['openid', 'profile', 'email'] // Default scopes
	};
}

/**
 * Gets MSAL configuration for client-side authentication
 */
export async function getClientMSALConfig(options?: {
	cacheLocation?: 'localStorage' | 'sessionStorage';
	enableLogging?: boolean;
	logLevel?: number;
}): Promise<MSALConfig> {
	const azureConfig = await getClientAzureB2CConfig();

	const config: MSALConfig = {
		auth: {
			clientId: azureConfig.clientId,
			authority: azureConfig.authority,
			knownAuthorities: azureConfig.knownAuthorities,
			redirectUri: azureConfig.redirectUri,
			postLogoutRedirectUri: azureConfig.postLogoutRedirectUri
		},
		cache: {
			cacheLocation: options?.cacheLocation || 'localStorage',
			storeAuthStateInCookie: false // Modern browsers don't need this
		}
	};

	// Add logging configuration if enabled
	if (options?.enableLogging) {
		config.system = {
			loggerOptions: {
				loggerCallback: (level: number, message: string, containsPii: boolean) => {
					if (!containsPii) {
						switch (level) {
							case 0: // Error
								console.error('MSAL Error:', message);
								break;
							case 1: // Warning
								console.warn('MSAL Warning:', message);
								break;
							case 2: // Info
								console.info('MSAL Info:', message);
								break;
							case 3: // Verbose
								console.debug('MSAL Debug:', message);
								break;
						}
					}
				},
				logLevel: options?.logLevel || 2, // Info level by default
				piiLoggingEnabled: false // Never log PII
			}
		};
	}

	return config;
}

/**
 * Auth scopes for different operations
 */
export const CLIENT_AUTH_SCOPES = {
	// Default scopes for basic user information
	DEFAULT: ['openid', 'profile', 'email'],

	// API access scopes (add your custom API scopes here)
	API: ['api://satisfactory-manager/read', 'api://satisfactory-manager/write'],

	// Combined scopes for full access
	FULL: [
		'openid',
		'profile',
		'email',
		'api://satisfactory-manager/read',
		'api://satisfactory-manager/write'
	]
} as const;

/**
 * Auth redirect URIs for different scenarios
 */
export const CLIENT_AUTH_URIS = {
	LOGIN: '/auth/callback',
	LOGOUT: '/',
	ERROR: '/auth/error'
} as const;
