/**
 * Shared database connection utility for migrations and checks
 * Supports Azure Managed Identity authentication
 */

import postgres from 'postgres';
import { getDatabaseConfig } from '../../config/database.config.js';
import { getAzurePostgreSQLToken } from '../db/auth.js';

/**
 * Creates a database connection for migrations with Azure token support
 */
export async function createMigrationConnection(): Promise<postgres.Sql> {
	const dbConfig = getDatabaseConfig();
	let connectionUrl = dbConfig.url;

	console.log('🔌 Creating migration connection...');

	// Handle Azure Managed Identity authentication
	if (
		dbConfig.auth?.recommendedMethod === 'managed-identity' &&
		dbConfig.auth.usesManagedIdentity
	) {
		console.log('🆔 Setting up Azure Managed Identity authentication for migrations...');

		try {
			// Get Azure token
			const token = await getAzurePostgreSQLToken();
			console.log(`🔐 Migration: Obtained Azure token (${token.substring(0, 20)}...)`);

			// Parse the connection URL to replace password with token
			const url = new URL(connectionUrl);
			url.password = token; // Set the token as the password
			connectionUrl = url.toString();

			console.log('✅ Successfully injected Azure token into migration connection string');
		} catch (error) {
			console.error('❌ Failed to authenticate with Azure Managed Identity for migrations:', error);
			throw new Error(
				`Azure authentication failed for migrations: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	} else {
		console.log('🔐 Using traditional password authentication for migrations');
	}

	// Create postgres instance
	const client = postgres(connectionUrl, {
		max: 1, // Only one connection needed for migrations
		prepare: false,
		ssl: dbConfig.ssl,
		idle_timeout: (dbConfig.idleTimeout || 30000) / 1000,
		connect_timeout: (dbConfig.connectionTimeout || 10000) / 1000
	});

	// Test the connection
	try {
		await client`SELECT 1 as test`;
		console.log('✅ Migration connection test successful');
	} catch (error) {
		console.error('❌ Migration connection test failed:', error);
		throw error;
	}

	return client;
}
