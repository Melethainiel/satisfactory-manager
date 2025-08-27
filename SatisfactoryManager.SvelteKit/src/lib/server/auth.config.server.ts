/**
 * Server-side Azure B2C authentication configuration
 *
 * This module contains server-side authentication configuration and
 * MUST NEVER be imported by client-side code.
 */

// Note: Using dynamic imports for Aspire deployment compatibility
import { env as dynamicEnv } from '$env/dynamic/private';

/**
 * Azure B2C configuration interface for server-side
 */
export interface ServerAzureB2CConfig {
	clientId: string;
	authority: string;
	knownAuthorities: string[];
	clientSecret?: string;
}

/**
 * Gets Azure B2C configuration for server-side use only
 * This function can ONLY be called in server context
 */
export function getServerAzureB2CConfig(): ServerAzureB2CConfig {
	const authoritiesValue = dynamicEnv.AZURE_B2C_KNOWN_AUTHORITIES || '["satisfactorymanager.b2clogin.com"]';
	
	let knownAuthorities: string[];
	try {
		// Try to parse as JSON array first
		const parsed = JSON.parse(authoritiesValue);
		knownAuthorities = Array.isArray(parsed) ? parsed : [authoritiesValue];
	} catch {
		// If not JSON, treat as single authority string
		knownAuthorities = [authoritiesValue];
	}

	return {
		clientId: dynamicEnv.AZURE_B2C_CLIENT_ID || '',
		authority: dynamicEnv.AZURE_B2C_AUTHORITY || '',
		knownAuthorities,
		clientSecret: undefined // Client secret loaded separately if needed
	};
}

/**
 * Gets server-side client secret for token validation
 * Only available in server context
 */
export async function getServerClientSecret(): Promise<string | undefined> {
	try {
		// Client secret from dynamic environment (sensitive data)
		return dynamicEnv.AZURE_B2C_CLIENT_SECRET;
	} catch {
		// Client secret is optional
		return undefined;
	}
}

/**
 * Validates server-side auth configuration
 */
export function validateServerAuthConfig(): boolean {
	const config = getServerAzureB2CConfig();

	// Validate required fields
	if (!config.clientId) {
		throw new Error('AZURE_B2C_CLIENT_ID is required for server-side authentication');
	}

	if (!config.authority) {
		throw new Error('AZURE_B2C_AUTHORITY is required for server-side authentication');
	}

	if (!config.knownAuthorities || config.knownAuthorities.length === 0) {
		throw new Error('AZURE_B2C_KNOWN_AUTHORITIES must contain at least one authority');
	}

	// Validate that authority is in known authorities
	const authorityDomain = new URL(config.authority).hostname;
	const hasMatchingAuthority = config.knownAuthorities.some(
		(auth) => auth.includes(authorityDomain) || new URL(auth).hostname === authorityDomain
	);

	if (!hasMatchingAuthority) {
		throw new Error(`Authority ${config.authority} is not in known authorities list`);
	}

	return true;
}
