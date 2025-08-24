/**
 * Centralized database configuration
 * 
 * This module provides unified database configuration management
 * using the validated server environment variables.
 */

import { getServerConfig, getServerEnvVar } from './env.server.js';

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  url: string;
  ssl?: boolean;
  maxConnections?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
  schema?: string;
}

/**
 * Parsed database URL components
 */
export interface DatabaseUrlComponents {
  protocol: string;
  username: string;
  password: string;
  host: string;
  port: number;
  database: string;
  searchParams: URLSearchParams;
}

/**
 * Database connection pool configuration
 */
export interface DatabasePoolConfig {
  max: number;
  min: number;
  acquireTimeoutMillis: number;
  createTimeoutMillis: number;
  destroyTimeoutMillis: number;
  idleTimeoutMillis: number;
  createRetryIntervalMillis: number;
}

/**
 * Gets the validated database configuration
 * 
 * @returns Database configuration object
 * @throws Error if configuration is invalid
 */
export function getDatabaseConfig(): DatabaseConfig {
  const serverConfig = getServerConfig();
  const databaseUrl = serverConfig.DATABASE_URL;
  
  // Parse database URL to extract components
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch (error) {
    throw new Error(`Invalid DATABASE_URL format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Validate protocol
  if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
    throw new Error(`Unsupported database protocol: ${parsedUrl.protocol}. Only PostgreSQL is supported.`);
  }

  // Extract SSL preference from URL parameters
  const ssl = parsedUrl.searchParams.get('sslmode') !== 'disable' && 
               parsedUrl.searchParams.get('ssl') !== 'false';

  return {
    url: databaseUrl,
    ssl,
    maxConnections: parseInt(parsedUrl.searchParams.get('max_connections') || '20'),
    connectionTimeout: parseInt(parsedUrl.searchParams.get('connect_timeout') || '10000'),
    idleTimeout: parseInt(parsedUrl.searchParams.get('idle_timeout') || '30000'),
    schema: parsedUrl.searchParams.get('schema') || 'public'
  };
}

/**
 * Parses a database URL into its components
 * 
 * @param url - Database URL to parse
 * @returns Parsed URL components
 */
export function parseDatabaseUrl(url?: string): DatabaseUrlComponents {
  const databaseUrl = url || getServerEnvVar('DATABASE_URL');
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch (error) {
    throw new Error(`Invalid DATABASE_URL format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    protocol: parsedUrl.protocol,
    username: parsedUrl.username,
    password: parsedUrl.password,
    host: parsedUrl.hostname,
    port: parseInt(parsedUrl.port) || 5432,
    database: parsedUrl.pathname.slice(1), // Remove leading slash
    searchParams: parsedUrl.searchParams
  };
}

/**
 * Gets database connection pool configuration
 * 
 * @param environment - Environment type for different pool sizes
 * @returns Database pool configuration
 */
export function getDatabasePoolConfig(environment?: 'development' | 'production' | 'test'): DatabasePoolConfig {
  const env = environment || getServerEnvVar('NODE_ENV', 'development');
  
  // Different pool configurations for different environments
  switch (env) {
    case 'production':
      return {
        max: 20,
        min: 5,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 10000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 300000, // 5 minutes
        createRetryIntervalMillis: 500
      };
    
    case 'test':
      return {
        max: 5,
        min: 1,
        acquireTimeoutMillis: 10000,
        createTimeoutMillis: 5000,
        destroyTimeoutMillis: 1000,
        idleTimeoutMillis: 30000, // 30 seconds
        createRetryIntervalMillis: 200
      };
    
    case 'development':
    default:
      return {
        max: 10,
        min: 2,
        acquireTimeoutMillis: 20000,
        createTimeoutMillis: 8000,
        destroyTimeoutMillis: 2000,
        idleTimeoutMillis: 60000, // 1 minute
        createRetryIntervalMillis: 300
      };
  }
}

/**
 * Gets Drizzle ORM configuration object
 * 
 * @returns Configuration object suitable for Drizzle ORM
 */
export function getDrizzleConfig() {
  const dbConfig = getDatabaseConfig();
  const env = getServerEnvVar('NODE_ENV', 'development');
  
  return {
    connectionString: dbConfig.url,
    ssl: dbConfig.ssl,
    logger: env === 'development', // Enable query logging in development
    pool: getDatabasePoolConfig(env)
  };
}

/**
 * Validates database connection configuration
 * 
 * @returns True if configuration is valid
 * @throws Error if configuration is invalid
 */
export function validateDatabaseConfig(): boolean {
  try {
    const config = getDatabaseConfig();
    const components = parseDatabaseUrl(config.url);
    
    // Validate required components
    if (!components.host) {
      throw new Error('Database host is required');
    }
    
    if (!components.database) {
      throw new Error('Database name is required');
    }
    
    if (!components.username) {
      throw new Error('Database username is required');
    }
    
    // Validate port is a valid number
    if (isNaN(components.port) || components.port < 1 || components.port > 65535) {
      throw new Error(`Invalid database port: ${components.port}`);
    }
    
    // Validate connection limits
    if (config.maxConnections && (config.maxConnections < 1 || config.maxConnections > 100)) {
      throw new Error(`Invalid max connections: ${config.maxConnections}. Must be between 1 and 100.`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database configuration validation failed:', error);
    throw error;
  }
}

/**
 * Database migration configuration
 */
export const MIGRATION_CONFIG = {
  migrationsFolder: './drizzle',
  migrationsTable: 'drizzle_migrations',
  schemaFilter: ['public'] as string[] // Only use public schema by default
} as const;

/**
 * Common database connection options for different tools
 */
export const DB_CONNECTION_OPTIONS = {
  // For node-postgres
  postgres: () => {
    const components = parseDatabaseUrl();
    return {
      host: components.host,
      port: components.port,
      database: components.database,
      user: components.username,
      password: components.password,
      ssl: components.searchParams.get('sslmode') !== 'disable',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    };
  },
  
  // For Drizzle Kit
  drizzleKit: () => {
    const config = getDatabaseConfig();
    return {
      connectionString: config.url,
      migrations: {
        folder: MIGRATION_CONFIG.migrationsFolder,
        table: MIGRATION_CONFIG.migrationsTable
      }
    };
  }
} as const;

// Validate configuration during module initialization
try {
  if (typeof window === 'undefined') {
    // Only validate on server-side
    validateDatabaseConfig();
    console.log('✅ Database configuration validated successfully');
  }
} catch (error) {
  console.error('💥 Failed to initialize database configuration');
  // Don't throw during module loading
}