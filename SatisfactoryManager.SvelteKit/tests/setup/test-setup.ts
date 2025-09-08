import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanupTestDb, clearTestData, setupTestDb } from './test-db';
import { config } from 'dotenv';
import { resolve } from 'path';
import { getDatabaseInitialization } from '../../src/lib/server/db/index';

// Load test environment variables from .env file (created by CI/CD or local development)
// Fallback to .env.test for local development if it exists
const envPath = resolve(process.cwd(), '.env');
const testEnvPath = resolve(process.cwd(), '.env.test');

try {
	config({ path: envPath });
} catch (error) {
	// Fallback to .env.test if .env doesn't exist (for local development)
	config({ path: testEnvPath });
}

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
