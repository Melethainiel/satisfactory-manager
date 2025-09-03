/**
 * Enhanced Drizzle ORM configuration with Azure Managed Identity support
 *
 * This module provides a Drizzle database instance configured for both
 * traditional password authentication and Azure managed identity authentication.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getDatabaseConfig, getDrizzleConfig } from '../../config/database.config.js';
import { createAzureTokenProvider } from './auth.js';
import { createEnhancedAzureTokenProvider } from './auth-enhanced.js';
import { startMonitoring } from '../services/authMonitoringService.js';
import * as schema from './schema.js';

// Global connection instance
let dbInstance: ReturnType<typeof drizzle> | null = null;
let currentSql: postgres.Sql | null = null;

/**
 * Creates a PostgreSQL connection with Azure authentication support
 */
async function createConnection() {
	const dbConfig = getDatabaseConfig();
	const drizzleConfig = getDrizzleConfig();

	console.log('🔌 Creating database connection...');

	let connectionUrl = dbConfig.url;
	let sqlInstance: postgres.Sql;

	// Handle Azure Managed Identity authentication
	if (
		dbConfig.auth?.recommendedMethod === 'managed-identity' &&
		dbConfig.auth.usesManagedIdentity
	) {
		console.log('🆔 Setting up Azure Managed Identity authentication...');

		try {
			// Parse the connection URL to remove any existing password
			const url = new URL(connectionUrl);
			url.password = ''; // Clear password as it will be provided by the password function
			connectionUrl = url.toString();

			// Create enhanced Azure token provider function with monitoring
			const tokenProvider = createEnhancedAzureTokenProvider();

			// Create postgres instance with dynamic password function
			// This will automatically request a new token for each new connection
			sqlInstance = postgres(connectionUrl, {
				ssl: dbConfig.ssl,
				max: dbConfig.maxConnections || 20,
				idle_timeout: (dbConfig.idleTimeout || 30000) / 1000,
				connect_timeout: (dbConfig.connectionTimeout || 10000) / 1000,
				// Dynamic password function - called for each new connection
				password: tokenProvider,
				// Handle authentication errors
				onnotice: (notice) => {
					if (notice.message?.includes('password authentication failed')) {
						console.warn('⚠️ Authentication failed, connection will retry with fresh token');
					}
				}
			});

			console.log(
				'✅ Azure Managed Identity authentication configured with enhanced token provider'
			);

			// Start authentication monitoring for Azure environments
			if (process.env.NODE_ENV === 'production') {
				console.log('🔍 Starting enhanced authentication monitoring for production');
				startMonitoring(5 * 60 * 1000); // 5-minute monitoring interval
			} else {
				console.log('🔍 Starting enhanced authentication monitoring for development');
				startMonitoring(1 * 60 * 1000); // 1-minute monitoring interval for faster feedback
			}
		} catch (error) {
			console.error('❌ Failed to configure Azure Managed Identity:', error);
			throw new Error(
				`Azure authentication configuration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	} else {
		console.log('🔐 Using traditional password authentication');

		// Traditional password authentication
		sqlInstance = postgres(connectionUrl, {
			ssl: dbConfig.ssl,
			max: dbConfig.maxConnections || 20,
			idle_timeout: (dbConfig.idleTimeout || 30000) / 1000,
			connect_timeout: (dbConfig.connectionTimeout || 10000) / 1000
		});
	}

	// Test the connection
	try {
		await sqlInstance`SELECT 1 as test`;
		console.log('✅ Database connection test successful');
	} catch (error) {
		console.error('❌ Database connection test failed:', error);
		throw error;
	}

	return sqlInstance;
}

/**
 * Gets a Drizzle database instance with connection pooling and Azure auth support
 */
export async function getDatabase() {
	if (!dbInstance || !currentSql) {
		console.log('🏗️ Initializing database connection...');

		currentSql = await createConnection();

		// Create Drizzle instance with schema
		dbInstance = drizzle(currentSql, {
			schema,
			logger: process.env.NODE_ENV === 'development'
		});

		console.log('✅ Database initialized successfully');
	}

	return dbInstance;
}

/**
 * Creates a new database connection (useful for migrations or testing)
 */
export async function createNewConnection() {
	const sql = await createConnection();
	return drizzle(sql, { schema });
}

/**
 * Closes the database connection
 */
export async function closeDatabase() {
	if (currentSql) {
		console.log('🔌 Closing database connection...');
		await currentSql.end();
		currentSql = null;
		dbInstance = null;
		console.log('✅ Database connection closed');
	}
}

/**
 * Health check for the database connection
 */
export async function checkDatabaseHealth(): Promise<{ healthy: boolean; error?: string }> {
	try {
		if (!currentSql) {
			await getDatabase(); // Initialize if not already done
		}

		if (currentSql) {
			const result = await currentSql`SELECT NOW() as timestamp, version() as version`;
			return {
				healthy: true,
				timestamp: result[0]?.timestamp,
				version: result[0]?.version
			} as any;
		}

		return { healthy: false, error: 'No database connection available' };
	} catch (error) {
		return {
			healthy: false,
			error: error instanceof Error ? error.message : 'Unknown database error'
		};
	}
}

// Default export is the database instance getter
export default getDatabase;

// Export the schema for external use
export { schema };
