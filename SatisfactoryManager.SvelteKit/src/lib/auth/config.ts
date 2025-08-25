/**
 * Azure B2C authentication configuration
 *
 * This module provides authentication configuration using the new centralized
 * environment variable system with proper type safety and validation.
 */

import type { AzureB2CConfig } from '../states/authState.svelte';
import { getAzureB2CConfig, AUTH_SCOPES } from '../config/auth.config.js';
import { getPublicEnvVar } from '../config/env.client.js';

// Primary custom API scope for backend authorization
export const API_USER_ACCESS_SCOPE =
	getPublicEnvVar('PUBLIC_AZURE_B2C_API_USER_ACCESS_SCOPE') ||
	'https://SatisfactoryManager.onmicrosoft.com/71d43619-ad3d-49d4-bae9-97e38ec57dc4/access_users';

/**
 * Gets Azure B2C configuration compatible with the existing authState interface
 *
 * @returns Azure B2C configuration object
 */
export async function getCompatibleAzureB2CConfig(): Promise<AzureB2CConfig> {
	const config = await getAzureB2CConfig();

	return {
		clientId: config.clientId,
		authority: config.authority,
		knownAuthorities: config.knownAuthorities,
		redirectUri: config.redirectUri,
		postLogoutRedirectUri: config.postLogoutRedirectUri,
		// Include API scope for consent upfront
		scopes: [...AUTH_SCOPES.DEFAULT, API_USER_ACCESS_SCOPE]
	};
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
let _cachedConfig: AzureB2CConfig | null = null;
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
		_cachedConfig = config;
		Object.assign(azureB2CConfig, config);
	})
	.catch((error) => {
		console.error('Failed to initialize auth config:', error);
	});
