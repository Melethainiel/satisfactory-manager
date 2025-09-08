import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanupTestDb, clearTestData, setupTestDb } from './test-db';
import { config } from 'dotenv';
import { resolve } from 'path';
import { getDatabaseInitialization } from '../../src/lib/server/db/index';

// Load test environment variables
config({ path: resolve(process.cwd(), '.env.test') });

beforeAll(async () => {
	console.log('🚀 Setting up test environment...');
	await setupTestDb();
	// Initialize the production database system with test database
	await getDatabaseInitialization();
});

afterEach(async () => {
	await clearTestData();
});

afterAll(async () => {
	await cleanupTestDb();
});
