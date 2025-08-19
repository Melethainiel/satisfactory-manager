import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from '../../src/lib/server/db/schema';

let testDb: ReturnType<typeof drizzle>;
let connection: ReturnType<typeof postgres>;

export async function setupTestDb() {
	// Use test database URL or fallback to main with test suffix
	const testDbUrl = process.env.TEST_DATABASE_URL || 
		process.env.DATABASE_URL?.replace('/satisfactory', '/satisfactory_test') ||
		'postgres://app:app@localhost:5432/satisfactory_test';

	connection = postgres(testDbUrl, { max: 1 });
	testDb = drizzle(connection, { schema });

	// Run migrations
	try {
		await migrate(testDb, { migrationsFolder: './drizzle' });
	} catch (error) {
		console.warn('Migration warning:', error);
	}
}

export async function cleanupTestDb() {
	if (connection) {
		await connection.end();
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