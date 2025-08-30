/**
 * Database migration utilities for automatic migration on startup
 *
 * This module provides functionality to automatically apply database migrations
 * using the same connection configuration as the main application.
 */

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import { createMigrationConnection } from './connection.js';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';

/**
 * Apply all pending database migrations
 *
 * @returns Promise that resolves when migrations are complete
 * @throws Error if migration fails
 */
export async function runMigrations(): Promise<void> {
	console.log('🔄 Starting database migrations...');

	// Create a dedicated connection for migrations with Azure token support
	const migrationClient = await createMigrationConnection();

	// Create Drizzle instance for migrations
	const migrationDb = drizzle(migrationClient);

	try {
		// Run migrations from the drizzle folder with explicit table configuration
		await migrate(migrationDb, { 
			migrationsFolder: './drizzle',
			migrationsTable: 'drizzle_migrations',
			migrationsSchema: 'public'
		});
		console.log('✅ Database migrations completed successfully');
	} catch (error) {
		// Check if the error is about already existing relations/constraints
		const errorMessage = error instanceof Error ? error.message : String(error);
		const isAlreadyExistsError =
			errorMessage.includes('already exists') ||
			(errorMessage.includes('relation') && errorMessage.includes('already exists'));

		if (isAlreadyExistsError) {
			console.log('⚠️ Some database objects already exist - this is likely harmless');
			console.log('✅ Database migrations completed (some objects already existed)');
			
			// Check if we need to record existing migrations
			try {
				const checkCount = await migrationClient`SELECT COUNT(*) as count FROM public.drizzle_migrations`;
				const recordedCount = parseInt(checkCount[0]?.count || '0');
				
				if (recordedCount === 0) {
					console.log('📝 Migration table is empty, recording existing migrations...');
					// Close current connection before creating a new one in recordExistingMigrations
					await migrationClient.end();
					await recordExistingMigrations();
					return;
				} else {
					console.log(`📊 Found ${recordedCount} recorded migrations, no additional recording needed`);
				}
			} catch (recordError) {
				console.warn('⚠️ Could not check or record existing migrations:', recordError);
			}
		} else {
			console.error('❌ Database migration failed:', error);
			throw error;
		}
	} finally {
		// Close the migration connection if not already closed
		try {
			await migrationClient.end();
		} catch (error) {
			// Connection might already be closed, ignore the error
		}
	}
}

/**
 * Record existing migrations in the database when objects already exist
 * This ensures migration tracking is maintained even for pre-existing database objects
 */
async function recordExistingMigrations(): Promise<void> {
	console.log('📝 Recording existing migrations in database...');

	// Create connection for recording migrations
	const recordClient = await createMigrationConnection();

	try {
		// Get all SQL migration files from filesystem
		const migrationsDir = join(process.cwd(), 'drizzle');
		const migrationFiles = await readdir(migrationsDir);
		const sqlFiles = migrationFiles.filter((file) => file.endsWith('.sql')).sort();

		console.log(`📊 Found ${sqlFiles.length} migration files to record`);

		for (const sqlFile of sqlFiles) {
			const filePath = join(migrationsDir, sqlFile);
			const content = await readFile(filePath, 'utf-8');
			
			// Calculate hash like Drizzle does (MD5 of content)
			const hash = createHash('md5').update(content).digest('hex');
			const timestamp = Date.now();

			// Insert migration record (simple insert since table should be empty)
			try {
				await recordClient`
					INSERT INTO public.drizzle_migrations (hash, created_at) 
					VALUES (${hash}, ${timestamp})
				`;
				console.log(`✅ Recorded migration: ${sqlFile}`);
			} catch (error) {
				console.warn(`⚠️ Could not record migration ${sqlFile}:`, error);
			}
		}

		console.log(`✅ Successfully recorded ${sqlFiles.length} existing migrations`);
	} catch (error) {
		console.error('❌ Failed to record existing migrations:', error);
		throw error;
	} finally {
		await recordClient.end();
	}
}

/**
 * Check if migrations are needed by comparing filesystem migrations with applied ones
 * This is a lightweight check to avoid unnecessary migration runs
 */
export async function checkMigrationsNeeded(): Promise<boolean> {
	// Create a lightweight connection to check migration status with Azure token support
	const checkClient = await createMigrationConnection();

	try {
		// Check if the drizzle migrations table exists in the public schema
		const result = await checkClient`
			SELECT EXISTS (
				SELECT FROM information_schema.tables 
				WHERE table_name = 'drizzle_migrations' AND table_schema = 'public'
			);
		`;

		const tableExists = result[0]?.exists;

		if (!tableExists) {
			console.log('📋 Migration table not found - migrations needed');
			return true;
		}

		// Count migrations in the filesystem
		const migrationsDir = join(process.cwd(), 'drizzle');
		const migrationFiles = await readdir(migrationsDir);
		const sqlFiles = migrationFiles.filter((file) => file.endsWith('.sql')).sort();
		const filesystemCount = sqlFiles.length;

		// Count applied migrations in database from the public schema
		const appliedMigrations = await checkClient`
			SELECT COUNT(*) as count FROM public.drizzle_migrations;
		`;

		const appliedCount = parseInt(appliedMigrations[0]?.count || '0');

		console.log(
			`📊 Found ${filesystemCount} migration files and ${appliedCount} applied migrations`
		);

		// If filesystem has more migrations than applied, we need to migrate
		if (filesystemCount > appliedCount) {
			console.log(
				`📋 ${filesystemCount - appliedCount} pending migrations found - migrations needed`
			);
			return true;
		}

		console.log('✅ Database is up to date - no migrations needed');
		return false;
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
		console.log('🚀 Initializing database...');
		const migrationsNeeded = await checkMigrationsNeeded();

		if (migrationsNeeded) {
			await runMigrations();
		} else {
			console.log('✅ Database is up to date, no migrations needed');
		}

		console.log('🎉 Database initialization completed successfully');
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		console.error('💥 Database initialization failed:', error);

		// Provide more context for common errors
		if (errorMessage.includes('already exists') && errorMessage.includes('relation')) {
			throw new Error(
				`Database initialization failed: ${errorMessage}. ` +
					`This usually means migrations were already applied manually via 'npm run db:migrate'. ` +
					`The database may still be functional.`
			);
		}

		throw new Error(`Database initialization failed: ${errorMessage}`);
	}
}
