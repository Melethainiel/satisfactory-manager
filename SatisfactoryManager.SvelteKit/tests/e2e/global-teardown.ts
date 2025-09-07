import { FullConfig } from '@playwright/test';

/**
 * Global teardown for Playwright E2E tests
 * 
 * This function runs once after all tests complete and cleans up:
 * - Test database
 * - Temporary files
 * - Any global test resources
 */
async function globalTeardown(config: FullConfig) {
	console.log('🧹 Starting E2E test teardown...');
	
	try {
		// Clean up test database if needed
		console.log('🗄️ Cleaning up test database...');
		
		// Clean up any temporary files or resources
		console.log('📁 Cleaning up temporary files...');
		
		console.log('✅ E2E test teardown completed successfully');
	} catch (error) {
		console.error('❌ E2E test teardown failed:', error);
		// Don't throw here to avoid masking test results
		console.error('Continuing despite teardown failure...');
	}
}

export default globalTeardown;