/**
 * Vitest configuration for integration tests that need database
 */

import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');

	return {
		plugins: [sveltekit()],
		test: {
			// Integration test patterns
			include: ['tests/integration/**/*.{test,spec}.{js,ts}'],
			exclude: ['node_modules/**', 'build/**', 'dist/**'],

			// Node environment for server-side tests
			environment: 'node',
			globals: true,

			// Setup files with database
			setupFiles: ['./tests/setup/test-setup.ts'],

			// Pool configuration for database consistency
			pool: 'forks',
			poolOptions: {
				forks: {
					singleFork: true
				}
			},

			// Environment variables for test execution
			env: {
				...env,
				NODE_ENV: 'test',
				DATABASE_URL: env.TEST_DATABASE_URL || env.DATABASE_URL,
				VITE_LOG_LEVEL: env.VITE_TEST_LOG_LEVEL || 'warn'
			},

			// Timeout configuration for database operations
			testTimeout: 30000,
			hookTimeout: 30000,

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
					'**/*.d.ts'
				]
			}
		},

		// Vite configuration specific to testing
		define: {
			'process.env.NODE_ENV': JSON.stringify('test')
		}
	};
});