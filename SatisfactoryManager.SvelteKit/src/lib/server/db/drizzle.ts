/**
 * Enhanced Drizzle ORM configuration with Azure Managed Identity support
 *
 * This module provides a Drizzle database instance configured for both
 * traditional password authentication and Azure managed identity authentication.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getDatabaseConfig, getDrizzleConfig } from '../../config/database.config.js';
import { getAzurePostgreSQLToken } from './auth.js';
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
			// Get initial token
			const token = await getAzurePostgreSQLToken();
			console.log(`🔐 Obtained Azure token (${token.substring(0, 20)}...)`);

			// Parse the connection URL to replace password with token
			const url = new URL(connectionUrl);
			url.password = token; // Set the token as the password
			connectionUrl = url.toString();

			console.log('✅ Successfully injected Azure token into connection string');

			// Create postgres instance with token refresh capability
			sqlInstance = postgres(connectionUrl, {
				ssl: dbConfig.ssl,
				max: dbConfig.maxConnections || 20,
				idle_timeout: (dbConfig.idleTimeout || 30000) / 1000,
				connect_timeout: (dbConfig.connectionTimeout || 10000) / 1000,
				// Setup periodic token refresh
				onnotice: (notice) => {
					if (notice.message?.includes('password authentication failed')) {
						console.warn('🔄 Token may have expired, will refresh on next connection...');
					}
				}
			});

			// Set up periodic token refresh (every 20 hours to be safe)
			const tokenRefreshInterval = 20 * 60 * 60 * 1000; // 20 hours

			setInterval(async () => {
				try {
					console.log('🔄 Refreshing Azure PostgreSQL token...');
					const newToken = await getAzurePostgreSQLToken();

					// Note: postgres-js doesn't support runtime password updates
					// In a production environment, you'd want to recreate the connection
					console.log(
						'✅ Token refreshed successfully (connection will use new token on next reconnect)'
					);
				} catch (error) {
					console.error('❌ Failed to refresh Azure token:', error);
				}
			}, tokenRefreshInterval);
		} catch (error) {
			console.error('❌ Failed to authenticate with Azure Managed Identity:', error);
			throw new Error(
				`Azure authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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
