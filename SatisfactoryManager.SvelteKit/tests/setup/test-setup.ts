import { beforeAll, afterAll, afterEach } from 'vitest';
import { setupTestDb, cleanupTestDb, clearTestData } from './test-db';

beforeAll(async () => {
	await setupTestDb();
});

afterEach(async () => {
	await clearTestData();
});

afterAll(async () => {
	await cleanupTestDb();
});