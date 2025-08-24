/**
 * Centralized Azure B2C authentication configuration
 * 
 * This module provides a unified interface for auth configuration
 * that works in both server and client contexts with proper type safety.
 */

import { browser } from '$app/environment';
import type { ServerEnv } from './env.types.js';
import { getPublicConfig, getKnownAuthorities } from './env.client.js';

/**
 * Azure B2C configuration interface
 */
export interface AzureB2CConfig {
  clientId: string;
  authority: string;
  knownAuthorities: string[];
  redirectUri?: string;
  postLogoutRedirectUri?: string;
  clientSecret?: string; // Only available on server-side
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
 * Gets Azure B2C configuration for the current context (server or client)
 * 
 * @returns Azure B2C configuration object
 * @throws Error if required configuration is missing
 */
export async function getAzureB2CConfig(): Promise<AzureB2CConfig> {
  if (browser) {
    // Client-side: use public environment variables
    const publicConfig = getPublicConfig();
    
    return {
      clientId: publicConfig.PUBLIC_AZURE_B2C_CLIENT_ID,
      authority: publicConfig.PUBLIC_AZURE_B2C_AUTHORITY,
      knownAuthorities: getKnownAuthorities(),
      redirectUri: publicConfig.PUBLIC_AZURE_B2C_REDIRECT_URI,
      postLogoutRedirectUri: publicConfig.PUBLIC_AZURE_B2C_POST_LOGOUT_REDIRECT_URI
    };
  } else {
    // Server-side: import environment variables directly to avoid client-side exposure
    // This is safe because the browser check ensures this code never runs on the client
    const { getServerConfig } = await import('./env.server.js');
    const serverConfig = getServerConfig();
    const knownAuthorities = JSON.parse(serverConfig.AZURE_B2C_KNOWN_AUTHORITIES);
    
    return {
      clientId: serverConfig.AZURE_B2C_CLIENT_ID,
      authority: serverConfig.AZURE_B2C_AUTHORITY,
      knownAuthorities,
      clientSecret: serverConfig.AZURE_B2C_CLIENT_SECRET
    };
  }
}

/**
 * Gets MSAL configuration for client-side authentication
 * 
 * @param options - Optional MSAL configuration overrides
 * @returns MSAL configuration object
 */
export async function getMSALConfig(options?: {
  cacheLocation?: 'localStorage' | 'sessionStorage';
  enableLogging?: boolean;
  logLevel?: number;
}): Promise<MSALConfig> {
  const azureConfig = await getAzureB2CConfig();
  
  const config: MSALConfig = {
    auth: {
      clientId: azureConfig.clientId,
      authority: azureConfig.authority,
      knownAuthorities: azureConfig.knownAuthorities,
      redirectUri: azureConfig.redirectUri || (browser ? window.location.origin : undefined),
      postLogoutRedirectUri: azureConfig.postLogoutRedirectUri || (browser ? window.location.origin : undefined)
    },
    cache: {
      cacheLocation: options?.cacheLocation || 'localStorage',
      storeAuthStateInCookie: browser ? false : true // Enable for IE11 support
    }
  };

  // Add logging configuration if enabled
  if (options?.enableLogging && browser) {
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
 * Gets server-side client secret for token validation
 * Only available in server context
 * 
 * @returns Client secret or undefined
 * @throws Error if called in browser context
 */
export async function getClientSecret(): Promise<string | undefined> {
  if (browser) {
    throw new Error('Client secret is not available in browser context');
  }
  
  const { getServerConfig, hasServerEnvVar } = await import('./env.server.js');
  
  if (!hasServerEnvVar('AZURE_B2C_CLIENT_SECRET')) {
    return undefined;
  }
  
  const serverConfig = getServerConfig();
  return serverConfig.AZURE_B2C_CLIENT_SECRET;
}

/**
 * Validates that all required auth configuration is available
 * 
 * @returns True if configuration is valid
 * @throws Error with details if configuration is invalid
 */
export async function validateAuthConfig(): Promise<boolean> {
  try {
    const config = await getAzureB2CConfig();
    
    // Validate required fields
    if (!config.clientId) {
      throw new Error('Client ID is required for authentication');
    }
    
    if (!config.authority) {
      throw new Error('Authority is required for authentication');
    }
    
    if (!config.knownAuthorities || config.knownAuthorities.length === 0) {
      throw new Error('At least one known authority is required');
    }
    
    // Validate that authority is in known authorities
    const authorityDomain = new URL(config.authority).hostname;
    const hasMatchingAuthority = config.knownAuthorities.some(auth => 
      auth.includes(authorityDomain) || new URL(auth).hostname === authorityDomain
    );
    
    if (!hasMatchingAuthority) {
      throw new Error(`Authority ${config.authority} is not in known authorities list`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Auth configuration validation failed:', error);
    throw error;
  }
}

/**
 * Auth scopes for different operations
 */
export const AUTH_SCOPES = {
  // Default scopes for basic user information
  DEFAULT: ['openid', 'profile', 'email'],
  
  // Scopes for API access
  API: ['api://satisfactory-manager/read', 'api://satisfactory-manager/write'],
  
  // Combined scopes for full access
  FULL: ['openid', 'profile', 'email', 'api://satisfactory-manager/read', 'api://satisfactory-manager/write']
} as const;

/**
 * Auth redirect URIs for different scenarios
 */
export const AUTH_URIS = {
  LOGIN: '/auth/callback',
  LOGOUT: '/',
  ERROR: '/auth/error'
} as const;

// Validate configuration during module initialization
if (typeof window === 'undefined') {
  // Only validate on server-side during module loading
  validateAuthConfig()
    .then(() => {
      console.log(`✅ Server auth configuration validated successfully`);
    })
    .catch((error) => {
      console.error(`💥 Failed to initialize server auth configuration`);
      // Don't throw during module loading
    });
} else {
  // Client-side validation
  try {
    validateAuthConfig()
      .then(() => {
        console.log(`✅ Client auth configuration validated successfully`);
      })
      .catch((error) => {
        console.error(`💥 Failed to initialize client auth configuration`);
      });
  } catch (error) {
    console.error(`💥 Failed to initialize client auth configuration`);
  }
}