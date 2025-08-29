/**
 * Database connection setup using Drizzle ORM and PostgreSQL with Azure authentication support
 *
 * This module provides access to the centralized database connection
 * that supports both traditional password authentication and Azure Managed Identity.
 * Includes automatic database migration on startup.
 */

import { getDatabase, closeDatabase } from './drizzle.js';
import { initializeDatabase } from '../migrations/migrate.js';

// Get the database instance with Azure authentication support
// Use a lazy getter to handle the async initialization
let dbInstance: Awaited<ReturnType<typeof getDatabase>> | null = null;

export const db = new Proxy({} as Awaited<ReturnType<typeof getDatabase>>, {
	get(target, prop) {
		if (!dbInstance) {
			throw new Error(
				'Database not initialized. Make sure to call getDatabaseInitialization() first.'
			);
		}
		return (dbInstance as any)[prop];
	}
});

/**
 * Gracefully close database connections
 * Should be called when the application shuts down
 */
export async function closeDatabaseConnections(): Promise<void> {
	try {
		await closeDatabase();
		console.log('✅ Database connections closed successfully');
	} catch (error) {
		console.error('❌ Error closing database connections:', error);
	}
}

// Initialize database with automatic migrations
let initializationPromise: Promise<void> | null = null;

/**
 * Get the database initialization promise
 * Ensures migrations are run only once during application startup
 */
export function getDatabaseInitialization(): Promise<void> {
	if (!initializationPromise) {
		initializationPromise = Promise.all([initializeDatabase(), getDatabase()]).then(
			([, database]) => {
				dbInstance = database;
				console.log(`✅ Database connection initialized with Azure authentication support`);
			}
		);
	}
	return initializationPromise;
}

// Start database initialization immediately when this module is imported
getDatabaseInitialization().catch((error) => {
	// Check if this is a migration-related error that might be recoverable
	const errorMessage = error instanceof Error ? error.message : String(error);
	const isMigrationError =
		errorMessage.includes('Database initialization failed') &&
		(errorMessage.includes('already exists') || errorMessage.includes('relation'));

	if (isMigrationError) {
		console.warn(
			'⚠️ Database initialization encountered migration conflicts, but may still be functional'
		);
		console.warn(
			'💡 This often happens when migrations were run manually. The application may still work.'
		);
	} else {
		console.error('💥 Critical: Database initialization failed during startup:', error);
	}

	// Allow the application to continue, but log the error
	// The error will be propagated to any code that awaits getDatabaseInitialization()
});
