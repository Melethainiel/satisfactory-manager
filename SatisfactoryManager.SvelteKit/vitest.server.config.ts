/**
 * Vitest configuration for server-side tests (Node.js environment)
 *
 * This configuration is specifically for server-side code that needs Node.js environment,
 * such as Azure authentication, database operations, and API endpoint logic.
 */

import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	// Load environment variables for tests using Vite's built-in loader
	const env = loadEnv(mode, process.cwd(), '');

	return {
		plugins: [sveltekit()],
		
		// Vite configuration for server-side testing
		resolve: {
			conditions: ['node'] // Use Node.js versions of modules
		},
		
		test: {
			// Test file patterns - focus on server-side tests
			include: [
				'src/lib/server/**/*.{test,spec}.{js,ts}',
				'src/routes/**/+*.server.test.{js,ts}',
				'tests/server/**/*.{test,spec}.{js,ts}',
				'tests/integration/**/*.{test,spec}.{js,ts}'
			],
			exclude: ['node_modules/**', 'build/**', 'dist/**'],

			// Node.js environment for server-side code
			environment: 'node',
			globals: true,

			// Setup files - includes database and server setup
			setupFiles: ['./tests/setup/test-setup.ts'],

			// Pool configuration for parallel test execution
			pool: 'forks',
			poolOptions: {
				forks: {
					singleFork: true // Single fork for database connection consistency
				}
			},

			// Environment variables for test execution
			env: {
				...env,
				NODE_ENV: 'test',
				DATABASE_URL: env.TEST_DATABASE_URL || env.DATABASE_URL,
				VITE_LOG_LEVEL: env.VITE_TEST_LOG_LEVEL || 'warn'
			},

			// Timeout configuration for database operations and Azure calls
			testTimeout: 30000, // 30 seconds for individual tests
			hookTimeout: 30000, // 30 seconds for setup/teardown hooks

			// Coverage configuration
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
					'src/lib/components/**', // Exclude components from server coverage
					'src/app.html'
				]
			}
		},

		// Vite configuration specific to Node.js testing
		define: {
			'process.env.NODE_ENV': JSON.stringify('test')
		}
	};
});