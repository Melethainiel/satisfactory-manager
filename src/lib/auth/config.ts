/**
 * Azure B2C authentication configuration
 *
 * This module provides authentication configuration using the new centralized
 * environment variable system with proper type safety and validation.
 */

import { browser } from '$app/environment';
import type { AzureB2CConfig } from '../states/authState.svelte';

// Primary custom API scope for backend authorization
export const API_USER_ACCESS_SCOPE =
	'https://SatisfactoryManager.onmicrosoft.com/71d43619-ad3d-49d4-bae9-97e38ec57dc4/access_users';

/**
 * Gets Azure B2C configuration compatible with the existing authState interface
 * This function works in both client and server contexts
 *
 * @returns Azure B2C configuration object
 */
export async function getCompatibleAzureB2CConfig(): Promise<AzureB2CConfig> {
	if (browser) {
		// Client-side: use client config
		const { getClientAzureB2CConfig, CLIENT_AUTH_SCOPES } = await import(
			'../config/auth.config.client.js'
		);
		const config = await getClientAzureB2CConfig();

		return {
			clientId: config.clientId,
			authority: config.authority,
			knownAuthorities: config.knownAuthorities,
			redirectUri: config.redirectUri,
			postLogoutRedirectUri: config.postLogoutRedirectUri,
			// Include API scope for consent upfront
			scopes: [...CLIENT_AUTH_SCOPES.DEFAULT, API_USER_ACCESS_SCOPE]
		};
	} else {
		// Server-side: use server config with minimal data for SSR
		const { getServerAzureB2CConfig } = await import('../server/auth.config.server.js');
		const config = getServerAzureB2CConfig();

		return {
			clientId: config.clientId,
			authority: config.authority,
			knownAuthorities: config.knownAuthorities,
			redirectUri: undefined, // Will be set client-side
			postLogoutRedirectUri: undefined, // Will be set client-side
			scopes: ['openid', 'profile', 'email', API_USER_ACCESS_SCOPE]
		};
	}
}

/**
 * Backwards compatibility: creates a promise-based config
 * Note: This should be replaced with proper async handling in components
 */
export const azureB2CConfigPromise: Promise<AzureB2CConfig> = getCompatibleAzureB2CConfig();

/**
 * Legacy synchronous export for backwards compatibility
 * This is deprecated and should be replaced with async usage
 */
export const azureB2CConfig: AzureB2CConfig = {
	clientId: '',
	authority: '',
	knownAuthorities: [],
	redirectUri: undefined,
	postLogoutRedirectUri: undefined,
	scopes: []
};

// Initialize the config asynchronously
getCompatibleAzureB2CConfig()
	.then((config) => {
		Object.assign(azureB2CConfig, config);
	})
	.catch((error) => {
		console.error('Failed to initialize auth config:', error);
	});
