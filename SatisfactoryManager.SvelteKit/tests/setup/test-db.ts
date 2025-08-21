import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from '../../src/lib/server/db/schema';

let testDb: ReturnType<typeof drizzle>;
let connection: ReturnType<typeof postgres>;

const MAX_RETRIES = 5;
const RETRY_DELAY = 1000;

async function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function setupTestDb() {
	// Environment variable validation and diagnostics
	console.log('🔍 Environment diagnostics:');
	console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
	console.log(`   TEST_DATABASE_URL: ${process.env.TEST_DATABASE_URL ? 'defined' : 'undefined'}`);
	console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'defined' : 'undefined'}`);

	// Use test database URL with Docker-friendly defaults
	const testDbUrl =
		process.env.TEST_DATABASE_URL ||
		process.env.DATABASE_URL?.replace('/satisfactory', '/satisfactory_test') ||
		'postgres://app:app@localhost:5433/satisfactory_test';

	console.log(`🔌 Connecting to test database: ${testDbUrl.replace(/\/\/[^@]+@/, '//***:***@')}`);

	// Validate database URL format
	if (!testDbUrl.startsWith('postgres://')) {
		throw new Error(`Invalid database URL format: ${testDbUrl}`);
	}

	// Retry connection logic for Docker containers that might be starting
	let retries = 0;
	while (retries < MAX_RETRIES) {
		try {
			connection = postgres(testDbUrl, {
				max: 1,
				connect_timeout: 10,
				idle_timeout: 5,
				max_lifetime: 60 * 10,
				// Disable prepared statements for better compatibility with Docker
				prepare: false
			});

			// Test the connection
			await connection`SELECT 1 as test`;
			testDb = drizzle(connection, { schema });

			console.log('✅ Test database connection established');
			break;
		} catch (error: any) {
			retries++;
			if (retries >= MAX_RETRIES) {
				console.error(`❌ Failed to connect to test database after ${MAX_RETRIES} attempts`);
				console.error(
					`💡 Make sure the test database is running: docker compose up -d postgres-test`
				);
				console.error(`🔍 Or run: npm run test:docker:setup`);
				console.error(`📋 Connection details: ${testDbUrl.replace(/\/\/[^@]+@/, '//***:***@')}`);
				console.error(`⚠️  Error: ${error.code || error.message || error}`);

				// Provide specific help based on error type
				if (error.code === 'ECONNREFUSED') {
					console.error(`   → Database server is not running or not accessible`);
				} else if (error.code === '3D000') {
					console.error(`   → Database 'satisfactory_test' does not exist`);
				}

				throw error;
			}

			console.log(
				`⏳ Database connection failed (attempt ${retries}/${MAX_RETRIES}), retrying in ${RETRY_DELAY * retries}ms...`
			);
			console.log(`   Error: ${error.code || error.message}`);
			await sleep(RETRY_DELAY * retries); // Exponential backoff
		}
	}

	// Run migrations
	try {
		console.log('🔄 Running database migrations...');
		await migrate(testDb, { migrationsFolder: './drizzle' });
		console.log('✅ Database migrations completed');
	} catch (error: any) {
		// Only warn if the error is about migrations already being applied
		if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
			console.log('ℹ️  Database migrations already applied');
		} else {
			console.warn('⚠️  Migration warning:', error.message || error);
		}
	}
}

export async function cleanupTestDb() {
	if (connection) {
		try {
			console.log('🔌 Closing test database connection...');
			await connection.end();
			console.log('✅ Test database connection closed');
		} catch (error: any) {
			console.warn('⚠️  Warning while closing database connection:', error.message || error);
		}
	}
}

export async function clearTestData() {
	if (!testDb) return;

	try {
		// Clear all tables in reverse dependency order to respect foreign key constraints
		console.log('🧹 Clearing test data...');

		// Recipe-related tables (most dependent first)
		await testDb.delete(schema.recipeBuildings);
		await testDb.delete(schema.recipeProducts);
		await testDb.delete(schema.recipeIngredients);
		await testDb.delete(schema.recipeVersions);
		await testDb.delete(schema.recipes);

		// Building-related tables
		await testDb.delete(schema.buildingVersions);
		await testDb.delete(schema.buildings);

		// Item-related tables
		await testDb.delete(schema.itemVersions);
		await testDb.delete(schema.items);

		// Module-related tables
		await testDb.delete(schema.moduleVersions);
		await testDb.delete(schema.modules);

		// Site-related tables
		await testDb.delete(schema.sites);

		// User/Game relationship tables
		await testDb.delete(schema.userGames);
		await testDb.delete(schema.games);
		await testDb.delete(schema.users);

		console.log('✅ Test data cleared successfully');
	} catch (error: any) {
		console.warn('⚠️  Warning during test data cleanup:', error.message || error);
		// Don't throw - cleanup issues shouldn't fail tests
	}
}

export function getTestDb() {
	return testDb;
}
