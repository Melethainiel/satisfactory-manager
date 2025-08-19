import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from '../../src/lib/server/db/schema';

let testDb: ReturnType<typeof drizzle>;
let connection: ReturnType<typeof postgres>;

const MAX_RETRIES = 5;
const RETRY_DELAY = 1000;

async function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export async function setupTestDb() {
	// Use test database URL with Docker-friendly defaults
	const testDbUrl = process.env.TEST_DATABASE_URL || 
		process.env.DATABASE_URL?.replace('/satisfactory', '/satisfactory_test') ||
		'postgres://app:app@localhost:5433/satisfactory_test';

	console.log(`🔌 Connecting to test database: ${testDbUrl.replace(/\/\/[^@]+@/, '//***:***@')}`);

	// Retry connection logic for Docker containers that might be starting
	let retries = 0;
	while (retries < MAX_RETRIES) {
		try {
			connection = postgres(testDbUrl, { 
				max: 1,
				connect_timeout: 10,
				idle_timeout: 5,
				max_lifetime: 60 * 10
			});
			
			// Test the connection
			await connection`SELECT 1 as test`;
			testDb = drizzle(connection, { schema });
			
			console.log('✅ Test database connection established');
			break;
		} catch (error) {
			retries++;
			if (retries >= MAX_RETRIES) {
				console.error(`❌ Failed to connect to test database after ${MAX_RETRIES} attempts`);
				console.error(`💡 Make sure the test database is running: docker compose up -d postgres-test`);
				console.error(`🔍 Or run: npm run test:docker:setup`);
				throw error;
			}
			
			console.log(`⏳ Database connection failed (attempt ${retries}/${MAX_RETRIES}), retrying in ${RETRY_DELAY}ms...`);
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

	// Clear all tables in reverse dependency order
	await testDb.delete(schema.recipeVersionBuildings);
	await testDb.delete(schema.recipeVersionProducts);
	await testDb.delete(schema.recipeVersionIngredients);
	await testDb.delete(schema.recipeVersions);
	await testDb.delete(schema.recipes);
	
	await testDb.delete(schema.buildingVersions);
	await testDb.delete(schema.buildings);
	
	await testDb.delete(schema.itemVersions);
	await testDb.delete(schema.items);
	
	await testDb.delete(schema.gameModules);
	await testDb.delete(schema.moduleVersions);
	await testDb.delete(schema.modules);
	
	await testDb.delete(schema.userGames);
	await testDb.delete(schema.games);
	await testDb.delete(schema.users);
}

export function getTestDb() {
	return testDb;
}