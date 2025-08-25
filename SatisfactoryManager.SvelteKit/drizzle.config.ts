/**
 * Drizzle Kit configuration
 */

import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export default defineConfig({
	// Database connection
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.DATABASE_URL || 'postgres://app:app@localhost:5432/satisfactory'
	},

	// Schema and migrations
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',

	// Development options
	verbose: true,
	strict: true
});
