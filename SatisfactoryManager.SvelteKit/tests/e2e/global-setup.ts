import { FullConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { execSync } from 'child_process';

/**
 * Global setup for Playwright E2E tests
 * 
 * This function runs once before all tests and sets up:
 * - Test database
 * - Test environment variables  
 * - Any global test fixtures
 */
async function globalSetup(config: FullConfig) {
	console.log('🚀 Starting E2E test setup...');
	
	// Load test environment variables
	const dotenvResult = dotenv.config({ path: resolve(process.cwd(), '.env.test') });
	if (dotenvResult.error) {
		console.error('❌ Failed to load .env.test:', dotenvResult.error);
		throw dotenvResult.error;
	}
	
	// Set up test database if needed
	// This could include running migrations, seeding data, etc.
	try {
		// Set up test database and run migrations
		console.log('📊 Setting up test database and running migrations...');
		
		// Ensure the test database URL is set
		if (!process.env.DATABASE_URL) {
			throw new Error('DATABASE_URL is not set in .env.test');
		}
		
		// Run database migrations using the test database URL
		console.log('🔄 Running database migrations on test database...');
		execSync('npm run db:migrate', {
			env: { ...process.env },
			stdio: 'inherit'
		});
		
		console.log('✅ E2E test setup completed successfully');
	} catch (error) {
		console.error('❌ E2E test setup failed:', error);
		throw error;
	}
}

export default globalSetup;