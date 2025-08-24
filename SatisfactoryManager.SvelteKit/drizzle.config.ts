/**
 * Drizzle Kit configuration using centralized environment management
 * 
 * This configuration uses the new centralized database configuration
 * system with proper validation and type safety.
 */

import { defineConfig } from 'drizzle-kit';
import { getDatabaseConfig, MIGRATION_CONFIG } from './src/lib/config/database.config.js';
import { getServerEnvVar } from './src/lib/config/env.server.js';

// Get validated database configuration
const dbConfig = getDatabaseConfig();
const environment = getServerEnvVar('NODE_ENV', 'development');

export default defineConfig({
  // Database connection
  dialect: 'postgresql',
  dbCredentials: { url: dbConfig.url },
  
  // Schema and migrations
  schema: './src/lib/server/db/schema.ts',
  out: MIGRATION_CONFIG.migrationsFolder,
  tablesFilter: MIGRATION_CONFIG.schemaFilter,
  
  // Development options
  verbose: environment === 'development',
  strict: true,
  
  // Migration configuration
  migrations: {
    table: MIGRATION_CONFIG.migrationsTable,
    schema: 'public'
  },
  
  // Introspection options
  introspect: {
    casing: 'camel'
  }
});
