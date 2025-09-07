import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';

/**
 * Playwright configuration for E2E testing
 * 
 * This configuration sets up comprehensive E2E testing for the Satisfactory Manager
 * application, including authentication flows, cross-browser testing, and accessibility audits.
 */

// Load environment variables for tests
const env = loadEnv('test', process.cwd(), '');

export default defineConfig({
	// Test directory
	testDir: './tests/e2e',
	
	// Timeout for individual tests
	timeout: 60000,

	// Expect timeout for assertions
	expect: {
		timeout: 10000,
	},

	// Fail the build on CI if you accidentally left test.only in the source code
	forbidOnly: !!process.env.CI,

	// Retry on CI only
	retries: process.env.CI ? 2 : 0,

	// Opt out of parallel tests on CI for more stable results
	workers: process.env.CI ? 1 : undefined,

	// Reporter configuration
	reporter: process.env.CI 
		? [['html'], ['github']] 
		: [['list'], ['html', { open: 'never' }]],

	// Global setup and teardown
	globalSetup: './tests/e2e/global-setup.ts',
	globalTeardown: './tests/e2e/global-teardown.ts',

	// Shared settings for all tests
	use: {
		// Base URL for tests
		baseURL: env.TEST_BASE_URL || 'http://localhost:5173',
		
		// Global timeout for actions
		actionTimeout: 30000,
		
		// Navigation timeout
		navigationTimeout: 30000,

		// Browser context options
		contextOptions: {
			// Ignore HTTPS errors for local testing
			ignoreHTTPSErrors: true,
		},

		// Screenshot on failure
		screenshot: 'only-on-failure',

		// Record video on failure
		video: 'retain-on-failure',

		// Collect trace on failure
		trace: 'retain-on-failure',

		// Set viewport size
		viewport: { width: 1280, height: 720 },

		// Locale for testing
		locale: 'en-US',
		
		// Timezone
		timezoneId: 'America/New_York',
	},

	// Test projects for different browsers and scenarios
	projects: [
		// Authentication setup project (run first)
		{
			name: 'setup',
			testMatch: /auth\.setup\.ts/,
			use: { ...devices['Desktop Chrome'] },
		},

		// Chromium tests with authentication
		{
			name: 'chromium',
			use: { 
				...devices['Desktop Chrome'],
				storageState: './tests/e2e/auth/user.json'
			},
			dependencies: ['setup'],
		},

		// Firefox tests with authentication
		{
			name: 'firefox',
			use: { 
				...devices['Desktop Firefox'],
				storageState: './tests/e2e/auth/user.json'
			},
			dependencies: ['setup'],
		},

		// WebKit tests with authentication
		{
			name: 'webkit',
			use: { 
				...devices['Desktop Safari'],
				storageState: './tests/e2e/auth/user.json'
			},
			dependencies: ['setup'],
		},

		// Mobile Chrome tests with authentication
		{
			name: 'Mobile Chrome',
			use: { 
				...devices['Pixel 5'],
				storageState: './tests/e2e/auth/user.json'
			},
			dependencies: ['setup'],
		},

		// Mobile Safari tests with authentication
		{
			name: 'Mobile Safari',
			use: { 
				...devices['iPhone 12'],
				storageState: './tests/e2e/auth/user.json'
			},
			dependencies: ['setup'],
		},

		// Accessibility tests
		{
			name: 'accessibility',
			use: { 
				...devices['Desktop Chrome'],
				// Use stored authentication state for accessibility tests
				storageState: './tests/e2e/auth/user.json'
			},
			testMatch: /.*\.accessibility\.spec\.ts/,
			dependencies: ['setup'],
		},
	],

	// Development server configuration
	webServer: {
		command: 'npm run dev',
		port: 5173,
		reuseExistingServer: !process.env.CI,
		timeout: 120000,
		env: {
			...env,
			NODE_ENV: 'test'
		}
	},
});