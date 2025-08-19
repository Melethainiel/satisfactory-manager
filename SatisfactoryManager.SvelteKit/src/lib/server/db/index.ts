import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
for (const file of ['.env.local', '.env']) {
	const p = resolve(root, file);
	if (existsSync(p)) {
		loadEnv({ path: p, override: false });
	}
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = postgres(process.env.DATABASE_URL);

export const db = drizzle(client, { schema });
