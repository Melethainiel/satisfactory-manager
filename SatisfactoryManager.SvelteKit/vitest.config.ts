import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	// Load environment variables for tests
	const env = loadEnv(mode, process.cwd(), '');
	
	return {
		plugins: [sveltekit()],
		test: {
			include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
			environment: 'node', // Changed from jsdom to node for API tests
			globals: true,
			setupFiles: ['./tests/setup/test-setup.ts'],
			pool: 'forks',
			poolOptions: {
				forks: {
					singleFork: true
				}
			},
			// Load test environment variables
			env: {
				...env,
				NODE_ENV: 'test'
			},
			// Increase timeout for Docker database startup
			testTimeout: 30000,
			hookTimeout: 30000
		}
	};
});