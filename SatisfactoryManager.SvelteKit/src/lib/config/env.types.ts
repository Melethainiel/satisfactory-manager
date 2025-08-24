/**
 * TypeScript type definitions for environment variables
 * 
 * This file defines the shape of environment variables used throughout the application.
 * It provides type safety and serves as documentation for required configuration.
 */

/**
 * Server-side only environment variables
 * These variables are never exposed to the client and are only available in server contexts
 */
export interface ServerEnv {
  // Database Configuration
  DATABASE_URL: string;
  
  // Azure B2C Server Configuration (for server-side token validation)
  AZURE_B2C_CLIENT_ID: string;
  AZURE_B2C_AUTHORITY: string;
  AZURE_B2C_CLIENT_SECRET?: string;
  AZURE_B2C_KNOWN_AUTHORITIES: string;
  AZURE_B2C_TENANT_ID?: string;
  AZURE_B2C_POLICY?: string;
  AZURE_B2C_API_SCOPE?: string;
  
  // API Configuration
  API_BASE_URL?: string;
  
  // Development/Runtime Environment
  NODE_ENV?: 'development' | 'production' | 'test';
}

/**
 * Public environment variables exposed to the client
 * These variables are prefixed with PUBLIC_ and are safe for client-side access
 */
export interface PublicEnv {
  // Azure B2C Client Configuration (safe for client-side)
  PUBLIC_AZURE_B2C_CLIENT_ID: string;
  PUBLIC_AZURE_B2C_AUTHORITY: string;
  PUBLIC_AZURE_B2C_KNOWN_AUTHORITIES: string;
  PUBLIC_AZURE_B2C_REDIRECT_URI?: string;
  PUBLIC_AZURE_B2C_POST_LOGOUT_REDIRECT_URI?: string;
  PUBLIC_AZURE_B2C_API_USER_ACCESS_SCOPE?: string;
  
  // API Configuration (if needed on client-side)
  PUBLIC_API_BASE_URL?: string;
  
  // Application Configuration
  PUBLIC_APP_NAME?: string;
}

/**
 * Combined environment configuration
 * Union of server and public environment variables
 */
export interface EnvironmentConfig {
  server: ServerEnv;
  public: PublicEnv;
}

/**
 * Environment variable validation errors
 */
export interface EnvValidationError {
  variable: string;
  message: string;
  value?: string;
}

/**
 * Type guards for environment variable validation
 */
export type EnvValidator<T> = (value: unknown) => value is T;

/**
 * Configuration for different environments (development, production, test)
 */
export type EnvironmentType = 'development' | 'production' | 'test';

/**
 * Environment-specific configuration overrides
 */
export interface EnvironmentOverrides {
  development?: Partial<ServerEnv & PublicEnv>;
  production?: Partial<ServerEnv & PublicEnv>;
  test?: Partial<ServerEnv & PublicEnv>;
}