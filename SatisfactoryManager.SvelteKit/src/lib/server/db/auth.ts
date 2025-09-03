/**
 * PostgreSQL Azure Managed Identity Authentication
 *
 * This module provides Azure Entra ID (managed identity) authentication
 * for PostgreSQL connections using periodic token refresh.
 */

import { DefaultAzureCredential } from '@azure/identity';

/**
 * Azure access token interface
 */
interface AccessToken {
	token: string;
	expiresOnTimestamp: number;
}

/**
 * Azure PostgreSQL token provider configuration
 */
export interface PostgreSQLAuthConfig {
	tokenRefreshIntervalMs: number;
	tokenRefreshBufferMs: number;
	scope: string;
}

/**
 * Default configuration for PostgreSQL Azure authentication
 */
export const DEFAULT_POSTGRESQL_AUTH_CONFIG: PostgreSQLAuthConfig = {
	// Refresh token every 45 minutes (tokens are valid for ~1 hour)
	tokenRefreshIntervalMs: 45 * 60 * 1000, // 45 minutes
	// Start refresh 5 minutes before expiry
	tokenRefreshBufferMs: 5 * 60 * 1000, // 5 minutes
	// Azure PostgreSQL scope for token requests
	scope: 'https://ossrdbms-aad.database.windows.net/.default'
};

/**
 * Token cache interface for managing Azure access tokens
 */
interface TokenCache {
	token: string;
	expiresOn: Date;
	isExpired: () => boolean;
	isExpiringSoon: (bufferMs?: number) => boolean;
}

/**
 * Global token cache to avoid excessive Azure API calls
 */
let tokenCache: TokenCache | null = null;

/**
 * Creates a token cache object from an Azure access token
 */
function createTokenCache(tokenResponse: AccessToken): TokenCache {
	return {
		token: tokenResponse.token,
		expiresOn: new Date(tokenResponse.expiresOnTimestamp),
		isExpired: () => new Date() >= new Date(tokenResponse.expiresOnTimestamp),
		isExpiringSoon: (bufferMs = DEFAULT_POSTGRESQL_AUTH_CONFIG.tokenRefreshBufferMs) => {
			const expiryTime = new Date(tokenResponse.expiresOnTimestamp).getTime();
			const currentTime = new Date().getTime();
			return currentTime >= expiryTime - bufferMs;
		}
	};
}

/**
 * Gets an Azure access token for PostgreSQL authentication
 *
 * @param config - Authentication configuration
 * @param forceRefresh - Force a new token even if cached token is valid
 * @returns Promise that resolves to the access token string
 */
export async function getAzurePostgreSQLToken(
	config: PostgreSQLAuthConfig = DEFAULT_POSTGRESQL_AUTH_CONFIG,
	forceRefresh = false
): Promise<string> {
	try {
		// Check if we have a valid cached token
		if (!forceRefresh && tokenCache && !tokenCache.isExpiringSoon()) {
			console.log(
				`🔐 Using cached Azure PostgreSQL token (expires: ${tokenCache.expiresOn.toISOString()})`
			);
			return tokenCache.token;
		}

		const credential = new DefaultAzureCredential();

		console.log(`🔐 Requesting new Azure PostgreSQL access token with scope: ${config.scope}`);

		const tokenResponse = await credential.getToken([config.scope]);

		if (!tokenResponse || !tokenResponse.token) {
			throw new Error('Failed to obtain access token from Azure credential');
		}

		// Update the cache
		tokenCache = createTokenCache(tokenResponse);

		console.log(
			`✅ Successfully obtained Azure PostgreSQL access token (expires: ${new Date(tokenResponse.expiresOnTimestamp).toISOString()})`
		);

		return tokenResponse.token;
	} catch (error) {
		console.error('❌ Failed to obtain Azure PostgreSQL access token:', error);
		throw new Error(
			`Azure authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Gets a cached Azure access token for PostgreSQL authentication with automatic refresh
 * This is the recommended function to use for connection password providers
 *
 * @param config - Authentication configuration
 * @returns Promise that resolves to the access token string
 */
export async function getCachedAzureToken(
	config: PostgreSQLAuthConfig = DEFAULT_POSTGRESQL_AUTH_CONFIG
): Promise<string> {
	try {
		// Always use the caching mechanism
		return await getAzurePostgreSQLToken(config, false);
	} catch (error) {
		// If the cached token fails, try to force refresh once
		console.warn('⚠️ Cached token failed, attempting force refresh...');
		try {
			return await getAzurePostgreSQLToken(config, true);
		} catch (retryError) {
			console.error('❌ Failed to refresh Azure token after retry:', retryError);
			throw retryError;
		}
	}
}

/**
 * Checks if the current environment supports Azure managed identity authentication
 *
 * @returns True if managed identity is available, false otherwise
 */
export function isManagedIdentityAvailable(): boolean {
	// Check for common Azure environment variables that indicate managed identity availability
	return !!(
		process.env.AZURE_CLIENT_ID ||
		process.env.MSI_ENDPOINT ||
		process.env.IDENTITY_ENDPOINT ||
		process.env.IMDS_ENDPOINT ||
		// Check for Azure App Service environment
		process.env.WEBSITE_SITE_NAME ||
		// Check for Azure Functions environment
		process.env.FUNCTIONS_WORKER_RUNTIME ||
		// Check for Azure Container Instances
		process.env.ACI_DNS_NAME_LABEL ||
		// Check for Azure VM with managed identity
		process.env.AZURE_TENANT_ID
	);
}

/**
 * Creates a password provider function for use with database drivers
 * that support dynamic password functions (like postgres.js)
 *
 * @param config - Authentication configuration
 * @returns Async function that returns the current access token
 */
export function createAzureTokenProvider(
	config: PostgreSQLAuthConfig = DEFAULT_POSTGRESQL_AUTH_CONFIG
): () => Promise<string> {
	return async (): Promise<string> => {
		return getCachedAzureToken(config);
	};
}

/**
 * Clears the token cache (useful for testing or forcing re-authentication)
 */
export function clearTokenCache(): void {
	tokenCache = null;
	console.log('🗑️ Azure token cache cleared');
}

/**
 * Determines the appropriate authentication method based on environment and connection string
 *
 * @param connectionString - Database connection string to analyze
 * @returns Object indicating which authentication method to use
 */
export function determineAuthenticationMethod(connectionString?: string): {
	usesManagedIdentity: boolean;
	hasPassword: boolean;
	recommendedMethod: 'managed-identity' | 'password' | 'auto';
} {
	const hasPassword = connectionString
		? connectionString.includes('Password=') ||
			connectionString.includes('password=') ||
			(connectionString.includes(':') && connectionString.includes('@')) // URL format with password
		: false;

	const managedIdentityAvailable = isManagedIdentityAvailable();

	// If we have a password in connection string, prefer password auth
	// If managed identity is available but no password, use managed identity
	// Otherwise default to password auth
	let recommendedMethod: 'managed-identity' | 'password' | 'auto' = 'auto';

	if (hasPassword && !managedIdentityAvailable) {
		recommendedMethod = 'password';
	} else if (!hasPassword && managedIdentityAvailable) {
		recommendedMethod = 'managed-identity';
	} else if (hasPassword && managedIdentityAvailable) {
		// Both available - prefer managed identity for security
		recommendedMethod = 'managed-identity';
	} else {
		// Neither available - fallback to password
		recommendedMethod = 'password';
	}

	return {
		usesManagedIdentity: managedIdentityAvailable,
		hasPassword,
		recommendedMethod
	};
}
