import { defineConfig } from 'drizzle-kit';
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env.local first (override), then fallback to .env
const root = process.cwd();
for (const file of ['.env.local', '.env']) {
	const p = resolve(root, file);
	if (existsSync(p)) {
		loadEnv({ path: p, override: false });
	}
}

if (!process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL is not set (checked .env.local and .env)');
}

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'postgresql',
	dbCredentials: { url: process.env.DATABASE_URL },
	verbose: true,
	strict: true
});
