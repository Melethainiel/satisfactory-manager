import { beforeAll, afterAll, afterEach } from 'vitest';
import { setupTestDb, cleanupTestDb, clearTestData } from './test-db';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load test environment variables
config({ path: resolve(process.cwd(), '.env.test') });

beforeAll(async () => {
	console.log('🚀 Setting up test environment...');
	await setupTestDb();
});

afterEach(async () => {
	await clearTestData();
});

afterAll(async () => {
	await cleanupTestDb();
});