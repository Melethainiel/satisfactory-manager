/**
 * Client-side environment configuration with validation
 * 
 * This module provides type-safe access to public environment variables
 * using SvelteKit's native $env/static/public and $env/dynamic/public modules.
 */

import { z } from 'zod';
import { browser } from '$app/environment';
import type { PublicEnv, EnvValidationError } from './env.types.js';

// Import static public environment variables using SvelteKit native modules
// Only import variables that are actually defined in .env and available in static
import {
  PUBLIC_AZURE_B2C_CLIENT_ID,
  PUBLIC_AZURE_B2C_AUTHORITY,
  PUBLIC_AZURE_B2C_KNOWN_AUTHORITIES,
  PUBLIC_AZURE_B2C_REDIRECT_URI,
  PUBLIC_AZURE_B2C_POST_LOGOUT_REDIRECT_URI
} from '$env/static/public';

// Import dynamic public environment variables
import { env as dynamicPublicEnv } from '$env/dynamic/public';

/**
 * Zod schema for public environment variables
 * Only validates variables that are safe for client-side exposure
 */
const publicEnvSchema = z.object({
  // Azure B2C Client Configuration
  PUBLIC_AZURE_B2C_CLIENT_ID: z
    .uuid('PUBLIC_AZURE_B2C_CLIENT_ID must be a valid UUID')
    .min(1, 'PUBLIC_AZURE_B2C_CLIENT_ID is required'),
  
  PUBLIC_AZURE_B2C_AUTHORITY: z
    .url('PUBLIC_AZURE_B2C_AUTHORITY must be a valid URL')
    .min(1, 'PUBLIC_AZURE_B2C_AUTHORITY is required'),
  
  PUBLIC_AZURE_B2C_KNOWN_AUTHORITIES: z.string()
    .min(1, 'PUBLIC_AZURE_B2C_KNOWN_AUTHORITIES is required')
    .refine(
      (val) => {
        try {
          const authorities = JSON.parse(val);
          return Array.isArray(authorities) && authorities.every(a => typeof a === 'string');
        } catch {
          return false;
        }
      },
      'PUBLIC_AZURE_B2C_KNOWN_AUTHORITIES must be a valid JSON array of strings'
    ),
  
  PUBLIC_AZURE_B2C_REDIRECT_URI: z
    .url('PUBLIC_AZURE_B2C_REDIRECT_URI must be a valid URL')
    .optional(),
  
  PUBLIC_AZURE_B2C_POST_LOGOUT_REDIRECT_URI: z
    .url('PUBLIC_AZURE_B2C_POST_LOGOUT_REDIRECT_URI must be a valid URL')
    .optional(),
  
  PUBLIC_AZURE_B2C_API_USER_ACCESS_SCOPE: z.string()
    .min(1, 'PUBLIC_AZURE_B2C_API_USER_ACCESS_SCOPE must not be empty')
    .optional(),
  
  // API Configuration
  PUBLIC_API_BASE_URL: z
    .url('PUBLIC_API_BASE_URL must be a valid URL')
    .optional(),
  
  // Application Configuration
  PUBLIC_APP_NAME: z.string()
    .min(1, 'PUBLIC_APP_NAME must not be empty')
    .optional()
});

/**
 * Validated public environment configuration
 */
let publicConfig: PublicEnv | null = null;

/**
 * Validation errors encountered during initialization
 */
let validationErrors: EnvValidationError[] = [];

/**
 * Validates and returns public environment configuration
 * 
 * @param forceReload - Force reload of configuration
 * @returns Validated public environment configuration
 * @throws Error if validation fails
 */
export function getPublicConfig(forceReload = false): PublicEnv {
  // Return cached config if available and not forcing reload
  if (publicConfig && !forceReload) {
    return publicConfig;
  }

  // Clear previous errors
  validationErrors = [];

  try {
    // Combine static and dynamic public environment variables
    // Static variables are preferred for performance (injected at build time)
    // Dynamic variables are used for runtime configuration
    const envVars = {
      PUBLIC_AZURE_B2C_CLIENT_ID: PUBLIC_AZURE_B2C_CLIENT_ID || dynamicPublicEnv.PUBLIC_AZURE_B2C_CLIENT_ID,
      PUBLIC_AZURE_B2C_AUTHORITY: PUBLIC_AZURE_B2C_AUTHORITY || dynamicPublicEnv.PUBLIC_AZURE_B2C_AUTHORITY,
      PUBLIC_AZURE_B2C_KNOWN_AUTHORITIES: PUBLIC_AZURE_B2C_KNOWN_AUTHORITIES || dynamicPublicEnv.PUBLIC_AZURE_B2C_KNOWN_AUTHORITIES,
      PUBLIC_AZURE_B2C_REDIRECT_URI: PUBLIC_AZURE_B2C_REDIRECT_URI || dynamicPublicEnv.PUBLIC_AZURE_B2C_REDIRECT_URI,
      PUBLIC_AZURE_B2C_POST_LOGOUT_REDIRECT_URI: PUBLIC_AZURE_B2C_POST_LOGOUT_REDIRECT_URI || dynamicPublicEnv.PUBLIC_AZURE_B2C_POST_LOGOUT_REDIRECT_URI,
      PUBLIC_AZURE_B2C_API_USER_ACCESS_SCOPE: dynamicPublicEnv.PUBLIC_AZURE_B2C_API_USER_ACCESS_SCOPE,
      PUBLIC_API_BASE_URL: dynamicPublicEnv.PUBLIC_API_BASE_URL,
      PUBLIC_APP_NAME: dynamicPublicEnv.PUBLIC_APP_NAME
    };

    // Validate against schema
    const result = publicEnvSchema.safeParse(envVars);

    if (!result.success) {
      // Collect validation errors
      validationErrors = result.error.issues.map(issue => ({
        variable: issue.path.join('.'),
        message: issue.message,
        value: typeof (envVars as any)[issue.path[0]] === 'string' 
          ? (envVars as any)[issue.path[0]] 
          : undefined
      }));

      throw new Error(
        `Public environment validation failed:\n${
          validationErrors.map(err => 
            `  - ${err.variable}: ${err.message}${err.value ? ` (got: "${err.value}")` : ''}`
          ).join('\n')
        }`
      );
    }

    // Cache validated configuration
    publicConfig = result.data;
    
    return publicConfig;
  } catch (error) {
    const context = browser ? 'Client' : 'Server';
    console.error(`❌ ${context} public environment configuration failed:`, error);
    throw error;
  }
}

/**
 * Returns validation errors from the last configuration attempt
 */
export function getPublicConfigErrors(): EnvValidationError[] {
  return [...validationErrors];
}

/**
 * Checks if a public environment variable is defined
 * 
 * @param key - Environment variable key
 * @returns True if the variable is defined and non-empty
 */
export function hasPublicEnvVar(key: keyof PublicEnv): boolean {
  try {
    const config = getPublicConfig();
    const value = config[key];
    return value !== undefined && value !== null && value !== '';
  } catch {
    return false;
  }
}

/**
 * Gets a public environment variable with optional fallback
 * 
 * @param key - Environment variable key
 * @param fallback - Fallback value if variable is not defined
 * @returns Environment variable value or fallback
 */
export function getPublicEnvVar<K extends keyof PublicEnv>(
  key: K,
  fallback?: PublicEnv[K]
): PublicEnv[K] | undefined {
  try {
    const config = getPublicConfig();
    const value = config[key];
    return value !== undefined && value !== null && value !== '' ? value : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Gets the parsed known authorities array
 * Helper function since this is commonly used in auth configuration
 */
export function getKnownAuthorities(): string[] {
  try {
    const config = getPublicConfig();
    return JSON.parse(config.PUBLIC_AZURE_B2C_KNOWN_AUTHORITIES);
  } catch {
    return [];
  }
}

/**
 * Validates public configuration during module initialization
 * This ensures early detection of configuration issues
 */
try {
  getPublicConfig();
  const context = browser ? 'Client' : 'Server';
  console.log(`✅ ${context} public environment configuration validated successfully`);
} catch (error) {
  const context = browser ? 'Client' : 'Server';
  console.error(`💥 Failed to initialize ${context} public environment configuration`);
  // Don't throw during module loading to avoid breaking the entire app
  // Errors will be thrown when getPublicConfig() is called
}