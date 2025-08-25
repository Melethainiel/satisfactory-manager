/**
 * Database connection setup using Drizzle ORM and PostgreSQL
 *
 * This module creates a database connection using the centralized configuration
 * system with proper environment variable validation and type safety.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { getDatabaseConfig, getDatabasePoolConfig } from '../../config/database.config.js';
import { getServerEnvVar } from '../../config/env.server.js';

// Get validated database configuration
const dbConfig = getDatabaseConfig();
const poolConfig = getDatabasePoolConfig();
const environment = getServerEnvVar('NODE_ENV', 'development');

// Create PostgreSQL client with connection pooling
const client = postgres(dbConfig.url, {
	// Connection pool configuration
	max: poolConfig.max,
	idle_timeout: Math.floor(poolConfig.idleTimeoutMillis / 1000), // Convert to seconds
	connect_timeout: Math.floor(poolConfig.createTimeoutMillis / 1000), // Convert to seconds

	// SSL configuration
	ssl: dbConfig.ssl ? 'require' : false,

	// Query logging in development
	debug: environment === 'development',

	// Connection options
	prepare: false, // Disable prepared statements for better compatibility
	max_lifetime: 300, // 5 minutes connection lifetime

	// Error handling
	onnotice: environment === 'development' ? console.log : undefined
});

// Create Drizzle database instance with schema
export const db = drizzle(client, {
	schema,
	logger: environment === 'development' // Enable query logging in development
});

// Export the raw client for direct queries if needed
export { client as postgresClient };

/**
 * Gracefully close database connections
 * Should be called when the application shuts down
 */
export async function closeDatabaseConnections(): Promise<void> {
	try {
		await client.end();
		console.log('✅ Database connections closed successfully');
	} catch (error) {
		console.error('❌ Error closing database connections:', error);
	}
}

// Log successful connection initialization
console.log(`✅ Database connection initialized for ${environment} environment`);
