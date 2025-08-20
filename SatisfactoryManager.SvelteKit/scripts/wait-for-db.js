#!/usr/bin/env node

/**
 * Wait for test database to be ready before running tests
 * This script waits for the PostgreSQL test database to be available
 */

import postgres from 'postgres';
import { setTimeout } from 'timers/promises';

const MAX_RETRIES = 30;
const RETRY_DELAY = 1000; // 1 second

async function waitForDatabase() {
	const testDbUrl =
		process.env.TEST_DATABASE_URL || 'postgres://app:app@localhost:5433/satisfactory_test';

	console.log('⏳ Waiting for test database to be ready...');
	console.log(`🔌 Connection URL: ${testDbUrl.replace(/\/\/[^@]+@/, '//***:***@')}`);

	let retries = 0;

	while (retries < MAX_RETRIES) {
		try {
			const sql = postgres(testDbUrl, {
				max: 1,
				connect_timeout: 3,
				idle_timeout: 1
			});

			// Try to connect and run a simple query
			await sql`SELECT 1 as test`;
			await sql.end();

			console.log('✅ Test database is ready!');
			return;
		} catch (error) {
			retries++;
			const timeLeft = MAX_RETRIES - retries;

			if (retries >= MAX_RETRIES) {
				console.error('❌ Failed to connect to test database after maximum retries');
				console.error(
					`💡 Make sure the test database is running: docker compose up -d postgres-test`
				);
				console.error(`🔍 Check logs with: docker compose logs postgres-test`);
				console.error(`📋 Error details: ${error.message}`);
				process.exit(1);
			}

			if (retries === 1 || retries % 5 === 0) {
				console.log(
					`⏳ Waiting for database... (attempt ${retries}/${MAX_RETRIES}, ${timeLeft} retries left)`
				);

				if (error.message.includes('ECONNREFUSED')) {
					console.log('   Database container might still be starting...');
				} else if (error.message.includes('database') && error.message.includes('does not exist')) {
					console.log('   Database exists but might still be initializing...');
				}
			}

			await setTimeout(RETRY_DELAY);
		}
	}
}

// Handle process termination gracefully
process.on('SIGINT', () => {
	console.log('\n🛑 Database wait interrupted');
	process.exit(0);
});

process.on('SIGTERM', () => {
	console.log('\n🛑 Database wait terminated');
	process.exit(0);
});

// Run the wait function
waitForDatabase().catch((error) => {
	console.error('❌ Unexpected error while waiting for database:', error);
	process.exit(1);
});
