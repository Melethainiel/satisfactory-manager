/**
 * Server-side environment configuration with validation
 *
 * This module provides type-safe access to server-only environment variables
 * using SvelteKit's native $env/static/private and $env/dynamic/private modules.
 */

import { z } from 'zod';
import type { ServerEnv, EnvValidationError } from './env.types.js';

// Import static environment variables using SvelteKit native modules
// Only import variables that are actually defined in .env and available in static
import {
	DATABASE_URL,
	AZURE_B2C_CLIENT_ID,
	AZURE_B2C_AUTHORITY,
	AZURE_B2C_KNOWN_AUTHORITIES,
	AZURE_B2C_TENANT_ID
} from '$env/static/private';

// Import dynamic environment variables
import { env as dynamicEnv } from '$env/dynamic/private';

/**
 * Zod schema for server environment variables
 * Validates types, formats, and required fields
 */
const serverEnvSchema = z.object({
	// Database Configuration
	DATABASE_URL: z
		.string()
		.url('DATABASE_URL must be a valid URL')
		.min(1, 'DATABASE_URL is required'),

	// Azure B2C Server Configuration
	AZURE_B2C_CLIENT_ID: z
		.string()
		.uuid('AZURE_B2C_CLIENT_ID must be a valid UUID')
		.min(1, 'AZURE_B2C_CLIENT_ID is required'),

	AZURE_B2C_AUTHORITY: z
		.string()
		.url('AZURE_B2C_AUTHORITY must be a valid URL')
		.min(1, 'AZURE_B2C_AUTHORITY is required'),

	AZURE_B2C_CLIENT_SECRET: z
		.string()
		.min(1, 'AZURE_B2C_CLIENT_SECRET must not be empty')
		.optional(),

	AZURE_B2C_KNOWN_AUTHORITIES: z
		.string()
		.min(1, 'AZURE_B2C_KNOWN_AUTHORITIES is required')
		.refine((val) => {
			try {
				const authorities = JSON.parse(val);
				return Array.isArray(authorities) && authorities.every((a) => typeof a === 'string');
			} catch {
				return false;
			}
		}, 'AZURE_B2C_KNOWN_AUTHORITIES must be a valid JSON array of strings'),

	AZURE_B2C_TENANT_ID: z.string().min(1, 'AZURE_B2C_TENANT_ID must not be empty').optional(),

	AZURE_B2C_POLICY: z.string().min(1, 'AZURE_B2C_POLICY must not be empty').optional(),

	AZURE_B2C_API_SCOPE: z.string().min(1, 'AZURE_B2C_API_SCOPE must not be empty').optional(),

	// API Configuration
	API_BASE_URL: z.string().url('API_BASE_URL must be a valid URL').optional(),

	// Development/Runtime Environment
	NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development')
});

/**
 * Validated server environment configuration
 */
let serverConfig: ServerEnv | null = null;

/**
 * Validation errors encountered during initialization
 */
let validationErrors: EnvValidationError[] = [];

/**
 * Validates and returns server environment configuration
 *
 * @param forceReload - Force reload of configuration (useful in development)
 * @returns Validated server environment configuration
 * @throws Error if validation fails
 */
export function getServerConfig(forceReload = false): ServerEnv {
	// Return cached config if available and not forcing reload
	if (serverConfig && !forceReload) {
		return serverConfig;
	}

	// Clear previous errors
	validationErrors = [];

	try {
		// Combine static and dynamic environment variables
		// Static variables are preferred for performance (injected at build time)
		// Dynamic variables are used for runtime-only secrets and optional variables
		const envVars = {
			DATABASE_URL: DATABASE_URL || dynamicEnv.DATABASE_URL,
			AZURE_B2C_CLIENT_ID: AZURE_B2C_CLIENT_ID || dynamicEnv.AZURE_B2C_CLIENT_ID,
			AZURE_B2C_AUTHORITY: AZURE_B2C_AUTHORITY || dynamicEnv.AZURE_B2C_AUTHORITY,
			AZURE_B2C_KNOWN_AUTHORITIES:
				AZURE_B2C_KNOWN_AUTHORITIES || dynamicEnv.AZURE_B2C_KNOWN_AUTHORITIES,
			AZURE_B2C_CLIENT_SECRET: dynamicEnv.AZURE_B2C_CLIENT_SECRET, // Only in dynamic (sensitive)
			AZURE_B2C_TENANT_ID: AZURE_B2C_TENANT_ID || dynamicEnv.AZURE_B2C_TENANT_ID,
			AZURE_B2C_POLICY: dynamicEnv.AZURE_B2C_POLICY,
			AZURE_B2C_API_SCOPE: dynamicEnv.AZURE_B2C_API_SCOPE,
			API_BASE_URL: dynamicEnv.API_BASE_URL,
			NODE_ENV: (dynamicEnv.NODE_ENV || 'development') as 'development' | 'production' | 'test'
		};

		// Validate against schema
		const result = serverEnvSchema.safeParse(envVars);

		if (!result.success) {
			// Collect validation errors
			validationErrors = result.error.issues.map((issue) => ({
				variable: issue.path.join('.'),
				message: issue.message,
				value:
					typeof (envVars as any)[issue.path[0]] === 'string'
						? (envVars as any)[issue.path[0]]
						: undefined
			}));

			throw new Error(
				`Server environment validation failed:\n${validationErrors
					.map(
						(err) =>
							`  - ${err.variable}: ${err.message}${err.value ? ` (got: "${err.value}")` : ''}`
					)
					.join('\n')}`
			);
		}

		// Cache validated configuration
		serverConfig = result.data;

		return serverConfig;
	} catch (error) {
		console.error('❌ Server environment configuration failed:', error);
		throw error;
	}
}

/**
 * Returns validation errors from the last configuration attempt
 */
export function getServerConfigErrors(): EnvValidationError[] {
	return [...validationErrors];
}

/**
 * Checks if a server environment variable is defined
 *
 * @param key - Environment variable key
 * @returns True if the variable is defined and non-empty
 */
export function hasServerEnvVar(key: keyof ServerEnv): boolean {
	try {
		const config = getServerConfig();
		const value = config[key];
		return value !== undefined && value !== null && value !== '';
	} catch {
		return false;
	}
}

/**
 * Gets a server environment variable with optional fallback
 *
 * @param key - Environment variable key
 * @param fallback - Fallback value if variable is not defined
 * @returns Environment variable value or fallback
 */
export function getServerEnvVar<K extends keyof ServerEnv>(
	key: K,
	fallback?: ServerEnv[K]
): ServerEnv[K] | undefined {
	try {
		const config = getServerConfig();
		const value = config[key];
		return value !== undefined && value !== null && value !== '' ? value : fallback;
	} catch {
		return fallback;
	}
}

/**
 * Validates server configuration during module initialization
 * This ensures early detection of configuration issues
 */
try {
	if (typeof window === 'undefined') {
		// Only validate on server-side (not during client-side hydration)
		getServerConfig();
		console.log('✅ Server environment configuration validated successfully');
	}
} catch (error) {
	console.error('💥 Failed to initialize server environment configuration');
	// Don't throw during module loading to avoid breaking the entire app
	// Errors will be thrown when getServerConfig() is called
}
