/**
 * Drizzle Kit configuration
 * Uses the same database configuration logic as the main application
 */

import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Check if a connection string is in Aspire (.NET) format
 */
function isAspireConnectionString(connectionString: string): boolean {
	return connectionString.includes('Host=') && connectionString.includes('Port=');
}

/**
 * Convert Aspire (.NET format) connection string to PostgreSQL URL
 */
function convertAspireConnectionStringToUrl(connectionString: string): string {
	const params: Record<string, string> = {};
	
	// Parse key=value pairs separated by semicolons
	connectionString.split(';').forEach(pair => {
		if (pair.trim()) {
			const [key, value] = pair.split('=');
			if (key && value) {
				params[key.trim()] = value.trim();
			}
		}
	});

	// Extract required components
	const host = params['Host'] || 'localhost';
	const port = params['Port'] || '5432';
	const username = params['Username'] || params['User Id'] || 'postgres';
	const password = params['Password'] || '';
	const database = params['Database'] || params['Initial Catalog'] || 'postgres';
	
	// Encode password to handle special characters
	const encodedPassword = encodeURIComponent(password);
	
	// For Aspire local containers, disable SSL by default
	const sslMode = params['SSL Mode'] || params['SslMode'] || 'disable';
	
	const url = `postgresql://${username}:${encodedPassword}@${host}:${port}/${database}?sslmode=${sslMode}`;
	console.log(`🔄 Converted Aspire connection string to URL for Drizzle Kit`);
	
	return url;
}

/**
 * Get database URL using the same logic as the main application
 */
function getDatabaseUrl(): string {
	// Priority 1: Aspire injected connection string
	const aspireConnectionString = process.env.ConnectionStrings__satisfactory;
	if (aspireConnectionString) {
		console.log('📡 Using Aspire connection string for Drizzle Kit');
		if (isAspireConnectionString(aspireConnectionString)) {
			return convertAspireConnectionStringToUrl(aspireConnectionString);
		}
		return aspireConnectionString;
	}
	
	// Priority 2: Manual DATABASE_URL override
	if (process.env.DATABASE_URL) {
		console.log('🔧 Using manual DATABASE_URL for Drizzle Kit');
		return process.env.DATABASE_URL;
	}
	
	// Priority 3: Fallback for local development
	console.log('⚠️ Using fallback local database URL for Drizzle Kit');
	return 'postgres://app:app@localhost:5432/satisfactory';
}

export default defineConfig({
	// Database connection
	dialect: 'postgresql',
	dbCredentials: {
		url: getDatabaseUrl()
	},

	// Schema and migrations
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',

	// Development options
	verbose: true,
	strict: true
});
