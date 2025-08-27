/**
 * PostgreSQL Azure Managed Identity Authentication
 *
 * This module provides Azure Entra ID (managed identity) authentication
 * for PostgreSQL connections using periodic token refresh.
 */

import { DefaultAzureCredential } from '@azure/identity';

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
	// Refresh token every 24 hours
	tokenRefreshIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
	// Start refresh 10 seconds before expiry
	tokenRefreshBufferMs: 10 * 1000, // 10 seconds
	// Azure PostgreSQL scope for token requests
	scope: 'https://ossrdbms-aad.database.windows.net/.default'
};

/**
 * Gets an Azure access token for PostgreSQL authentication
 *
 * @param config - Authentication configuration
 * @returns Promise that resolves to the access token string
 */
export async function getAzurePostgreSQLToken(
	config: PostgreSQLAuthConfig = DEFAULT_POSTGRESQL_AUTH_CONFIG
): Promise<string> {
	try {
		const credential = new DefaultAzureCredential();

		console.log(`🔐 Requesting Azure PostgreSQL access token with scope: ${config.scope}`);

		const tokenResponse = await credential.getToken([config.scope]);

		if (!tokenResponse || !tokenResponse.token) {
			throw new Error('Failed to obtain access token from Azure credential');
		}

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
 * that support periodic password refresh (like node-postgres with UsePeriodicPasswordProvider pattern)
 *
 * @param config - Authentication configuration
 * @returns Async function that returns the current access token
 */
export function createAzureTokenProvider(
	config: PostgreSQLAuthConfig = DEFAULT_POSTGRESQL_AUTH_CONFIG
): () => Promise<string> {
	return async (): Promise<string> => {
		return getAzurePostgreSQLToken(config);
	};
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
