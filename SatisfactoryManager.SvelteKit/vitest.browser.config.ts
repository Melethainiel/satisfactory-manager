/**
 * Vitest configuration for browser-side tests (DOM environment)
 *
 * This configuration is specifically for component tests, UI logic, and client-side code
 * that needs DOM simulation and browser-like behavior.
 */

import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	// Load environment variables for tests using Vite's built-in loader
	// This loads variables from .env, .env.local, .env.[mode], and .env.[mode].local
	// The empty string prefix means it loads all variables (not just VITE_)
	const env = loadEnv(mode, process.cwd(), '');

	return {
		plugins: [sveltekit()],
		
		// Vite configuration for testing
		resolve: {
			conditions: ['browser']
		},
		
		test: {
			// Test file patterns - focus on component and client-side tests
			include: [
				'src/lib/components/**/*.{test,spec}.{js,ts,svelte}',
				'src/lib/states/**/*.{test,spec}.{js,ts}',
				'src/lib/services/**/*.{test,spec}.{js,ts}', // Client-side services only
				'tests/components/**/*.{test,spec}.{js,ts}',
				'tests/browser/**/*.{test,spec}.{js,ts}'
			],
			exclude: [
				'node_modules/**', 
				'build/**', 
				'dist/**',
				'src/lib/server/**', // Exclude server-side tests
				'tests/server/**',
				'tests/integration/**'
			],

			// Test environment configuration
			environment: 'happy-dom', // DOM environment for component testing
			globals: true, // Enable global test functions (describe, it, expect)

			// Setup files - component setup only for browser tests
			setupFiles: ['./tests/setup/component-setup.ts'],

			// Pool configuration for parallel test execution
			pool: 'forks',
			poolOptions: {
				forks: {
					singleFork: true // Single fork for database connection consistency
				}
			},

			// Environment variables for test execution
			env: {
				...env, // Spread loaded environment variables
				NODE_ENV: 'test', // Ensure test environment
				// Test-specific overrides
				DATABASE_URL: env.TEST_DATABASE_URL || env.DATABASE_URL,
				// Disable verbose logging in tests unless explicitly enabled
				VITE_LOG_LEVEL: env.VITE_TEST_LOG_LEVEL || 'warn'
			},

			// Timeout configuration for database operations
			testTimeout: 30000, // 30 seconds for individual tests
			hookTimeout: 30000, // 30 seconds for setup/teardown hooks

			// Coverage configuration for browser-side code
			coverage: {
				provider: 'v8',
				reporter: ['text', 'json', 'html'],
				exclude: [
					'node_modules/**',
					'build/**',
					'dist/**',
					'tests/**',
					'**/*.config.*',
					'**/*.d.ts',
					'src/lib/server/**', // Exclude server-side code
					'src/routes/**/+*.server.*'
				]
			}
		},

		// Vite configuration specific to testing
		define: {
			// Ensure compatibility with the new environment system
			'process.env.NODE_ENV': JSON.stringify('test')
		}
	};
});
