/**
 * Centralized database configuration
 *
 * This module provides unified database configuration management
 * using the validated server environment variables.
 */

import { getServerConfig, getServerEnvVar } from './env.server';
import {
	determineAuthenticationMethod,
	getAzurePostgreSQLToken,
	isManagedIdentityAvailable
} from '../server/db/auth.js';

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
	url: string;
	ssl?: boolean;
	maxConnections?: number;
	connectionTimeout?: number;
	idleTimeout?: number;
	schema?: string;
	auth?: {
		usesManagedIdentity: boolean;
		hasPassword: boolean;
		recommendedMethod: 'managed-identity' | 'password' | 'auto';
	};
}

/**
 * Parsed database URL components
 */
export interface DatabaseUrlComponents {
	protocol: string;
	username: string;
	password: string;
	host: string;
	port: number;
	database: string;
	searchParams: URLSearchParams;
}

/**
 * Database connection pool configuration
 */
export interface DatabasePoolConfig {
	max: number;
	min: number;
	acquireTimeoutMillis: number;
	createTimeoutMillis: number;
	destroyTimeoutMillis: number;
	idleTimeoutMillis: number;
	createRetryIntervalMillis: number;
}

/**
 * Converts Aspire/ADO.NET connection string to PostgreSQL URL format
 * Also checks for individual Aspire environment variables for authentication
 *
 * @param connectionString - Connection string in format "Host=localhost;Port=5432;Username=user;Password=pass;Database=db"
 * @returns PostgreSQL URL in format "postgresql://user:pass@host:port/db"
 */
function convertAspireConnectionStringToUrl(connectionString: string): string {
	const params: Record<string, string> = {};

	// Parse key=value pairs separated by semicolons
	connectionString.split(';').forEach((pair) => {
		const [key, value] = pair.split('=');
		if (key && value) {
			params[key.trim()] = value.trim();
		}
	});

	// Extract required components
	const host = params['Host'] || 'localhost';
	const port = params['Port'] || '5432';
	const database = params['Database'] || params['Initial Catalog'] || 'postgres';

	// Handle authentication - check if we should use managed identity first
	const authMethod = determineAuthenticationMethod(connectionString);

	// For authentication, try the connection string first, then Aspire environment variables
	let username = params['Username'] || params['User'];
	let password = params['Password'] || '';

	// If no auth info in connection string, check Aspire individual environment variables
	if (!username || !password) {
		console.log('🔍 No auth info in connection string, checking Aspire environment variables...');

		// Check for various Aspire auth environment variable patterns
		username =
			username ||
			process.env.POSTGRES_USER ||
			process.env.POSTGRES_USERNAME ||
			process.env.postgres_USER ||
			process.env.satisfactory_USER ||
			// For Azure PostgreSQL with managed identity, use the managed identity name
			(authMethod.recommendedMethod === 'managed-identity' ? 'mi-satisfactory' : 'postgres');

		password =
			password ||
			process.env.POSTGRES_PASSWORD ||
			process.env.postgres_PASSWORD ||
			process.env.satisfactory_PASSWORD ||
			'';

		console.log(
			`🔐 Using Aspire auth: username=${username}, password=${password ? '[SET]' : '[NOT SET]'}`
		);
	} else {
		console.log(
			`🔐 Using connection string auth: username=${username}, password=${password ? '[SET]' : '[NOT SET]'}`
		);
	}
	console.log(`🔐 Authentication analysis:`, authMethod);

	let encodedPassword = '';

	if (authMethod.recommendedMethod === 'managed-identity' && authMethod.usesManagedIdentity) {
		console.log(
			'🆔 Using Azure Managed Identity authentication - token will be injected during connection'
		);
		// For managed identity, leave password empty - token will be injected by drizzle.ts
		encodedPassword = '';
	} else {
		console.log('🔐 Using traditional password authentication');
		// Encode password to handle special characters
		encodedPassword = encodeURIComponent(password);
	}

	// Determine SSL mode based on connection string parameters
	// Azure PostgreSQL typically requires SSL, local containers typically don't
	let sslMode = params['SSL Mode'] || params['SslMode'];

	if (!sslMode) {
		// Auto-detect SSL requirements based on host
		// For remote hosts (not localhost/127.0.0.1), default to SSL
		const isLocalHost =
			host.includes('localhost') || host.includes('127.0.0.1') || host === '0.0.0.0';

		if (!isLocalHost) {
			// Remote databases almost always need SSL
			sslMode = 'require';
			console.log(`🔒 Remote host detected (${host}), forcing SSL mode: require`);
		} else {
			// Local databases typically don't need SSL
			sslMode = 'disable';
			console.log(`🔒 Local host detected (${host}), using SSL mode: disable`);
		}
	}

	console.log(`🔒 Using SSL mode: ${sslMode} for host: ${host}`);

	return `postgresql://${username}:${encodedPassword}@${host}:${port}/${database}?sslmode=${sslMode}`;
}

/**
 * Checks if a connection string is in Aspire/ADO.NET format
 *
 * @param connectionString - The connection string to check
 * @returns True if it's in ADO.NET format (contains semicolons and key=value pairs)
 */
function isAspireConnectionString(connectionString: string): boolean {
	return (
		connectionString.includes(';') &&
		connectionString.includes('=') &&
		!connectionString.startsWith('postgresql://') &&
		!connectionString.startsWith('postgres://')
	);
}

/**
 * Gets the validated database configuration
 *
 * @returns Database configuration object
 * @throws Error if configuration is invalid
 */
export function getDatabaseConfig(): DatabaseConfig {
	// Try to get connection string from Aspire first (injected via WithReference)
	// Note: Aspire injects these variables dynamically, so we access process.env directly

	// Debug: Log all available database-related environment variables
	const allConnections = Object.keys(process.env)
		.filter(
			(key) =>
				key.startsWith('ConnectionStrings') || key.includes('POSTGRES') || key.includes('DATABASE')
		)
		.map(
			(key) =>
				`${key}=${process.env[key] ? (key.toLowerCase().includes('password') ? '[HIDDEN]' : '[SET]') : '[EMPTY]'}`
		);

	if (allConnections.length > 0) {
		console.log('🔍 Available database environment variables:', allConnections.join(', '));
	} else {
		console.log('🔍 No database-related environment variables found');
	}

	// Try various Aspire connection string patterns
	const aspireConnectionString =
		process.env.ConnectionStrings__satisfactory ||
		process.env.ConnectionStrings__postgres ||
		process.env['ConnectionStrings_postgres-db'] ||
		process.env.ConnectionStrings__postgres_db ||
		process.env.ConnectionStrings__database ||
		process.env.ConnectionStrings__PostgreSQL ||
		process.env.ConnectionStrings__db ||
		// Azure Bicep might output as POSTGRES_CONNECTIONSTRING
		process.env.POSTGRES_CONNECTIONSTRING ||
		// Check for any ConnectionStrings_ variable as fallback
		Object.keys(process.env)
			.filter((key) => key.startsWith('ConnectionStrings_') && process.env[key])
			.map((key) => process.env[key])[0];

	// Fallback to traditional DATABASE_URL for local development
	const serverConfig = getServerConfig();
	let databaseUrl = aspireConnectionString || serverConfig.DATABASE_URL;

	// Log which connection source is being used and convert if needed
	if (aspireConnectionString) {
		// Identify which Aspire variable was used
		const aspireVarName = Object.keys(process.env).find(
			(key) => key.startsWith('ConnectionStrings') && process.env[key] === aspireConnectionString
		);

		console.log(`🚀 Using Aspire-injected database connection from: ${aspireVarName || 'unknown'}`);
		console.log('📝 Raw Aspire connection string:', aspireConnectionString);

		if (isAspireConnectionString(aspireConnectionString)) {
			console.log('🔄 Converting Aspire connection string to PostgreSQL URL format');
			databaseUrl = convertAspireConnectionStringToUrl(aspireConnectionString);
			console.log(
				'📝 Converted PostgreSQL URL:',
				databaseUrl.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@')
			); // Hide credentials in logs
		} else {
			console.log('📝 Aspire connection string is already in PostgreSQL URL format');
		}
	} else {
		console.log('🔧 Using fallback DATABASE_URL connection');
		console.log(
			'📝 DATABASE_URL source:',
			serverConfig.DATABASE_URL ? 'environment variable' : 'not set'
		);
	}

	// Ensure we have a database connection string
	if (!databaseUrl) {
		throw new Error(
			'No database connection available. Either configure an Aspire connection string or set DATABASE_URL.'
		);
	}

	// Parse database URL to extract components
	let parsedUrl: URL;
	try {
		parsedUrl = new URL(databaseUrl);
	} catch (error) {
		throw new Error(
			`Invalid database connection format: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}

	// Validate protocol
	if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
		throw new Error(
			`Unsupported database protocol: ${parsedUrl.protocol}. Only PostgreSQL is supported.`
		);
	}

	// Extract SSL preference from URL parameters
	const ssl =
		parsedUrl.searchParams.get('sslmode') !== 'disable' &&
		parsedUrl.searchParams.get('ssl') !== 'false';

	// Analyze authentication method for the final URL
	const finalAuthMethod = determineAuthenticationMethod(databaseUrl);

	return {
		url: databaseUrl,
		ssl,
		maxConnections: parseInt(parsedUrl.searchParams.get('max_connections') || '20'),
		connectionTimeout: parseInt(parsedUrl.searchParams.get('connect_timeout') || '10000'),
		idleTimeout: parseInt(parsedUrl.searchParams.get('idle_timeout') || '30000'),
		schema: parsedUrl.searchParams.get('schema') || 'public',
		auth: finalAuthMethod
	};
}

/**
 * Parses a database URL into its components
 *
 * @param url - Database URL to parse
 * @returns Parsed URL components
 */
export function parseDatabaseUrl(url?: string): DatabaseUrlComponents {
	// If URL is provided, use it directly, otherwise get from config
	let databaseUrl: string;
	if (url) {
		databaseUrl = url;
	} else {
		const config = getDatabaseConfig();
		databaseUrl = config.url;
	}

	if (!databaseUrl) {
		throw new Error('No database connection available. Either configure an Aspire connection string or set DATABASE_URL.');
	}

	let parsedUrl: URL;
	try {
		parsedUrl = new URL(databaseUrl);
	} catch (error) {
		throw new Error(
			`Invalid DATABASE_URL format: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}

	return {
		protocol: parsedUrl.protocol,
		username: parsedUrl.username,
		password: parsedUrl.password,
		host: parsedUrl.hostname,
		port: parseInt(parsedUrl.port) || 5432,
		database: parsedUrl.pathname.slice(1), // Remove leading slash
		searchParams: parsedUrl.searchParams
	};
}

/**
 * Gets database connection pool configuration
 *
 * @param environment - Environment type for different pool sizes
 * @returns Database pool configuration
 */
export function getDatabasePoolConfig(
	environment?: 'development' | 'production' | 'test'
): DatabasePoolConfig {
	const env = environment || getServerEnvVar('NODE_ENV', 'development');

	// Different pool configurations for different environments
	switch (env) {
		case 'production':
			return {
				max: 20,
				min: 5,
				acquireTimeoutMillis: 30000,
				createTimeoutMillis: 10000,
				destroyTimeoutMillis: 5000,
				idleTimeoutMillis: 300000, // 5 minutes
				createRetryIntervalMillis: 500
			};

		case 'test':
			return {
				max: 5,
				min: 1,
				acquireTimeoutMillis: 10000,
				createTimeoutMillis: 5000,
				destroyTimeoutMillis: 1000,
				idleTimeoutMillis: 30000, // 30 seconds
				createRetryIntervalMillis: 200
			};

		case 'development':
		default:
			return {
				max: 10,
				min: 2,
				acquireTimeoutMillis: 20000,
				createTimeoutMillis: 8000,
				destroyTimeoutMillis: 2000,
				idleTimeoutMillis: 60000, // 1 minute
				createRetryIntervalMillis: 300
			};
	}
}

/**
 * Gets Drizzle ORM configuration object with Azure authentication support
 *
 * @returns Configuration object suitable for Drizzle ORM
 */
export function getDrizzleConfig() {
	const dbConfig = getDatabaseConfig();
	const env = getServerEnvVar('NODE_ENV', 'development');

	// Base configuration
	const config: any = {
		connectionString: dbConfig.url,
		ssl: dbConfig.ssl,
		logger: env === 'development', // Enable query logging in development
		pool: getDatabasePoolConfig(env)
	};

	// Add Azure authentication configuration if using managed identity
	if (
		dbConfig.auth?.recommendedMethod === 'managed-identity' &&
		dbConfig.auth.usesManagedIdentity
	) {
		console.log('🆔 Configuring Drizzle with Azure Managed Identity token provider');

		// We'll need to replace the token placeholder with actual tokens
		// This will be handled by the periodic token refresh in the connection pool
		config.azureAuth = {
			usesManagedIdentity: true,
			tokenProvider: async () => {
				try {
					return await getAzurePostgreSQLToken();
				} catch (error) {
					console.error('❌ Failed to get Azure token for database connection:', error);
					throw error;
				}
			}
		};
	}

	return config;
}

/**
 * Validates database connection configuration
 *
 * @returns True if configuration is valid
 * @throws Error if configuration is invalid
 */
export function validateDatabaseConfig(): boolean {
	try {
		const config = getDatabaseConfig();
		const components = parseDatabaseUrl(config.url);

		// Validate required components
		if (!components.host) {
			throw new Error('Database host is required');
		}

		if (!components.database) {
			throw new Error('Database name is required');
		}

		if (!components.username) {
			throw new Error('Database username is required');
		}

		// Validate port is a valid number
		if (isNaN(components.port) || components.port < 1 || components.port > 65535) {
			throw new Error(`Invalid database port: ${components.port}`);
		}

		// Validate connection limits
		if (config.maxConnections && (config.maxConnections < 1 || config.maxConnections > 100)) {
			throw new Error(
				`Invalid max connections: ${config.maxConnections}. Must be between 1 and 100.`
			);
		}

		return true;
	} catch (error) {
		console.error('❌ Database configuration validation failed:', error);
		throw error;
	}
}

/**
 * Database migration configuration
 */
export const MIGRATION_CONFIG = {
	migrationsFolder: './drizzle',
	migrationsTable: 'drizzle_migrations',
	schemaFilter: ['public'] as string[] // Only use public schema by default
} as const;

/**
 * Common database connection options for different tools
 */
export const DB_CONNECTION_OPTIONS = {
	// For node-postgres
	postgres: () => {
		const components = parseDatabaseUrl();
		return {
			host: components.host,
			port: components.port,
			database: components.database,
			user: components.username,
			password: components.password,
			ssl: components.searchParams.get('sslmode') !== 'disable',
			max: 20,
			idleTimeoutMillis: 30000,
			connectionTimeoutMillis: 10000
		};
	},

	// For Drizzle Kit
	drizzleKit: () => {
		const config = getDatabaseConfig();
		return {
			connectionString: config.url,
			migrations: {
				folder: MIGRATION_CONFIG.migrationsFolder,
				table: MIGRATION_CONFIG.migrationsTable
			}
		};
	}
} as const;

// Validate configuration during module initialization
try {
	if (typeof window === 'undefined') {
		// Only validate on server-side
		// Skip validation if using Aspire connection (which might not be URL format)
		const aspireConnectionString =
			process.env.ConnectionStrings__satisfactory ||
			process.env['ConnectionStrings_postgres-db'] ||
			process.env.ConnectionStrings__postgres_db;

		if (!aspireConnectionString) {
			validateDatabaseConfig();
			console.log('✅ Database configuration validated successfully');
		} else {
			console.log('✅ Database configuration (Aspire) loaded successfully');
		}

		// Log authentication method information
		if (isManagedIdentityAvailable()) {
			console.log('🆔 Azure Managed Identity is available in this environment');
		} else {
			console.log('🔐 Using traditional password authentication (no managed identity detected)');
		}
	}
} catch (error) {
	console.error('💥 Failed to initialize database configuration');
	// Don't throw during module loading
}
