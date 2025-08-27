/**
 * Database migration utilities for automatic migration on startup
 * 
 * This module provides functionality to automatically apply database migrations
 * using the same connection configuration as the main application.
 */

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getDatabaseConfig } from '../../config/database.config.js';

/**
 * Apply all pending database migrations
 * 
 * @returns Promise that resolves when migrations are complete
 * @throws Error if migration fails
 */
export async function runMigrations(): Promise<void> {
	const dbConfig = getDatabaseConfig();
	
	console.log('🔄 Starting database migrations...');
	
	// Create a dedicated connection for migrations
	const migrationClient = postgres(dbConfig.url, {
		max: 1, // Only one connection needed for migrations
		prepare: false,
		ssl: dbConfig.ssl ? 'require' : false
	});
	
	// Create Drizzle instance for migrations
	const migrationDb = drizzle(migrationClient);
	
	try {
		// Run migrations from the drizzle folder
		await migrate(migrationDb, { migrationsFolder: './drizzle' });
		console.log('✅ Database migrations completed successfully');
	} catch (error) {
		console.error('❌ Database migration failed:', error);
		throw error;
	} finally {
		// Always close the migration connection
		await migrationClient.end();
	}
}

/**
 * Check if migrations are needed by comparing latest migration with applied ones
 * This is a lightweight check to avoid unnecessary migration runs
 */
export async function checkMigrationsNeeded(): Promise<boolean> {
	const dbConfig = getDatabaseConfig();
	
	// Create a lightweight connection to check migration status
	const checkClient = postgres(dbConfig.url, {
		max: 1,
		prepare: false,
		ssl: dbConfig.ssl ? 'require' : false
	});
	
	try {
		// Check if the drizzle migrations table exists
		const result = await checkClient`
			SELECT EXISTS (
				SELECT FROM information_schema.tables 
				WHERE table_schema = 'drizzle' 
				AND table_name = 'migrations'
			);
		`;
		
		const tableExists = result[0]?.exists;
		
		if (!tableExists) {
			console.log('📋 Migration table not found - migrations needed');
			return true;
		}
		
		// Count applied migrations
		const appliedMigrations = await checkClient`
			SELECT COUNT(*) as count FROM drizzle.migrations;
		`;
		
		const appliedCount = parseInt(appliedMigrations[0]?.count || '0');
		console.log(`📊 Found ${appliedCount} applied migrations`);
		
		// For now, always run migrations to be safe
		// In the future, we could compare with filesystem migrations
		return true;
		
	} catch (error) {
		console.log('⚠️ Could not check migration status, assuming migrations needed:', error);
		return true;
	} finally {
		await checkClient.end();
	}
}

/**
 * Initialize database with migrations on application startup
 * This function is safe to call multiple times and will only run migrations when needed
 */
export async function initializeDatabase(): Promise<void> {
	try {
		const migrationsNeeded = await checkMigrationsNeeded();
		
		if (migrationsNeeded) {
			await runMigrations();
		} else {
			console.log('✅ Database is up to date, no migrations needed');
		}
	} catch (error) {
		console.error('💥 Database initialization failed:', error);
		throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}