/**
 * Enhanced PostgreSQL Azure Managed Identity Authentication with Monitoring
 *
 * This module provides an optimized Azure Entra ID (managed identity) authentication
 * system with comprehensive monitoring, health validation, and advanced error handling.
 */

import { DefaultAzureCredential } from '@azure/identity';

/**
 * Azure access token interface
 */
interface AccessToken {
	token: string;
	expiresOnTimestamp: number;
}

/**
 * Enhanced Azure PostgreSQL token provider configuration
 */
export interface EnhancedPostgreSQLAuthConfig {
	tokenRefreshIntervalMs: number;
	tokenRefreshBufferMs: number;
	scope: string;
	// New monitoring and resilience options
	enableMetrics: boolean;
	enableHealthValidation: boolean;
	maxRetryAttempts: number;
	baseRetryDelayMs: number;
	maxRetryDelayMs: number;
	tokenValidationTimeoutMs: number;
	// Proactive refresh settings
	proactiveRefreshEnabled: boolean;
	proactiveRefreshThresholdMs: number;
}

/**
 * Default enhanced configuration for PostgreSQL Azure authentication
 */
export const DEFAULT_ENHANCED_AUTH_CONFIG: EnhancedPostgreSQLAuthConfig = {
	// Base token settings
	tokenRefreshIntervalMs: 45 * 60 * 1000, // 45 minutes
	tokenRefreshBufferMs: 5 * 60 * 1000, // 5 minutes
	scope: 'https://ossrdbms-aad.database.windows.net/.default',

	// Monitoring and observability
	enableMetrics: true,
	enableHealthValidation: true,

	// Retry and resilience
	maxRetryAttempts: 3,
	baseRetryDelayMs: 1000, // 1 second
	maxRetryDelayMs: 10000, // 10 seconds
	tokenValidationTimeoutMs: 5000, // 5 seconds

	// Proactive refresh
	proactiveRefreshEnabled: true,
	proactiveRefreshThresholdMs: 10 * 60 * 1000 // 10 minutes before expiry
};

/**
 * Token health status
 */
export interface TokenHealth {
	isHealthy: boolean;
	isExpired: boolean;
	isExpiringSoon: boolean;
	timeToExpiry: number;
	lastRefreshTime: Date;
	refreshCount: number;
	errorCount: number;
	lastError?: string;
}

/**
 * Authentication metrics for monitoring
 */
export interface AuthMetrics {
	totalTokenRequests: number;
	successfulTokenRequests: number;
	failedTokenRequests: number;
	cacheHits: number;
	cacheMisses: number;
	averageTokenRequestDuration: number;
	lastTokenRequestDuration: number;
	proactiveRefreshCount: number;
	fallbackToRefreshCount: number;
}

/**
 * Enhanced token cache with health validation and metrics
 */
interface EnhancedTokenCache {
	token: string;
	expiresOn: Date;
	createdAt: Date;
	refreshCount: number;
	errorCount: number;
	lastError?: string;

	// Health methods
	isExpired: () => boolean;
	isExpiringSoon: (bufferMs?: number) => boolean;
	isHealthy: () => boolean;
	getTimeToExpiry: () => number;
	getHealth: () => TokenHealth;

	// Validation method
	validateToken: () => Promise<boolean>;
}

/**
 * Global enhanced token cache and metrics
 */
let enhancedTokenCache: EnhancedTokenCache | null = null;
let authMetrics: AuthMetrics = {
	totalTokenRequests: 0,
	successfulTokenRequests: 0,
	failedTokenRequests: 0,
	cacheHits: 0,
	cacheMisses: 0,
	averageTokenRequestDuration: 0,
	lastTokenRequestDuration: 0,
	proactiveRefreshCount: 0,
	fallbackToRefreshCount: 0
};

// Track request durations for average calculation
let requestDurations: number[] = [];

/**
 * Creates an enhanced token cache object with health validation
 */
function createEnhancedTokenCache(tokenResponse: AccessToken): EnhancedTokenCache {
	const cache: EnhancedTokenCache = {
		token: tokenResponse.token,
		expiresOn: new Date(tokenResponse.expiresOnTimestamp),
		createdAt: new Date(),
		refreshCount: enhancedTokenCache?.refreshCount ? enhancedTokenCache.refreshCount + 1 : 1,
		errorCount: 0,
		lastError: undefined,

		isExpired: () => new Date() >= new Date(tokenResponse.expiresOnTimestamp),

		isExpiringSoon: (bufferMs = DEFAULT_ENHANCED_AUTH_CONFIG.tokenRefreshBufferMs) => {
			const expiryTime = new Date(tokenResponse.expiresOnTimestamp).getTime();
			const currentTime = new Date().getTime();
			return currentTime >= expiryTime - bufferMs;
		},

		isHealthy: () => {
			return !cache.isExpired() && !!cache.token && cache.token.length > 0 && cache.errorCount < 3;
		},

		getTimeToExpiry: () => {
			return new Date(tokenResponse.expiresOnTimestamp).getTime() - new Date().getTime();
		},

		getHealth: (): TokenHealth => ({
			isHealthy: cache.isHealthy(),
			isExpired: cache.isExpired(),
			isExpiringSoon: cache.isExpiringSoon(),
			timeToExpiry: cache.getTimeToExpiry(),
			lastRefreshTime: cache.createdAt,
			refreshCount: cache.refreshCount,
			errorCount: cache.errorCount,
			lastError: cache.lastError
		}),

		validateToken: async (): Promise<boolean> => {
			try {
				// Basic validation: check token format and expiry
				if (!cache.token || cache.token.length === 0) {
					return false;
				}

				// Check if token looks like a JWT (basic structure validation)
				const parts = cache.token.split('.');
				if (parts.length !== 3) {
					return false;
				}

				// Verify it's not expired
				if (cache.isExpired()) {
					return false;
				}

				// Additional validation could include signature verification
				// For now, we'll trust Azure's token generation
				return true;
			} catch (error) {
				console.error('❌ Token validation failed:', error);
				cache.errorCount++;
				cache.lastError = error instanceof Error ? error.message : 'Token validation error';
				return false;
			}
		}
	};

	return cache;
}

/**
 * Implements exponential backoff delay calculation
 */
function calculateBackoffDelay(attempt: number, config: EnhancedPostgreSQLAuthConfig): number {
	const delay = Math.min(
		config.baseRetryDelayMs * Math.pow(2, attempt - 1),
		config.maxRetryDelayMs
	);

	// Add some jitter to prevent thundering herd
	const jitter = Math.random() * 0.1 * delay;
	return delay + jitter;
}

/**
 * Implements retry logic with exponential backoff
 */
async function withRetry<T>(
	operation: () => Promise<T>,
	config: EnhancedPostgreSQLAuthConfig,
	operationName = 'operation'
): Promise<T> {
	let lastError: Error;

	for (let attempt = 1; attempt <= config.maxRetryAttempts; attempt++) {
		try {
			const result = await operation();

			if (attempt > 1) {
				console.log(`✅ ${operationName} succeeded on attempt ${attempt}`);
			}

			return result;
		} catch (error) {
			lastError = error instanceof Error ? error : new Error('Unknown error');

			if (attempt === config.maxRetryAttempts) {
				console.error(`❌ ${operationName} failed after ${attempt} attempts:`, lastError);
				break;
			}

			const delay = calculateBackoffDelay(attempt, config);
			console.warn(
				`⚠️ ${operationName} attempt ${attempt} failed, retrying in ${delay}ms:`,
				lastError.message
			);

			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}

	throw lastError!;
}

/**
 * Updates authentication metrics
 */
function updateMetrics(duration: number, success: boolean) {
	authMetrics.totalTokenRequests++;
	authMetrics.lastTokenRequestDuration = duration;

	if (success) {
		authMetrics.successfulTokenRequests++;
	} else {
		authMetrics.failedTokenRequests++;
	}

	// Update average duration (rolling average with max 100 samples)
	requestDurations.push(duration);
	if (requestDurations.length > 100) {
		requestDurations.shift();
	}

	authMetrics.averageTokenRequestDuration =
		requestDurations.reduce((sum, d) => sum + d, 0) / requestDurations.length;
}

/**
 * Enhanced Azure access token retrieval with monitoring and retry logic
 */
export async function getEnhancedAzurePostgreSQLToken(
	config: EnhancedPostgreSQLAuthConfig = DEFAULT_ENHANCED_AUTH_CONFIG,
	forceRefresh = false
): Promise<string> {
	const startTime = Date.now();

	try {
		// Check if we have a valid cached token
		if (!forceRefresh && enhancedTokenCache) {
			// Validate token health if health validation is enabled
			if (config.enableHealthValidation) {
				const isValid = await enhancedTokenCache.validateToken();
				if (!isValid) {
					console.warn('⚠️ Cached token failed health validation, forcing refresh');
					forceRefresh = true;
				}
			}

			// Check expiry with buffer
			if (!enhancedTokenCache.isExpiringSoon(config.tokenRefreshBufferMs) && !forceRefresh) {
				const health = enhancedTokenCache.getHealth();
				console.log(
					`🔐 Using cached Azure PostgreSQL token (expires: ${enhancedTokenCache.expiresOn.toISOString()}, health: ${health.isHealthy ? 'good' : 'degraded'})`
				);

				if (config.enableMetrics) {
					authMetrics.cacheHits++;
				}

				return enhancedTokenCache.token;
			}
		}

		if (config.enableMetrics) {
			authMetrics.cacheMisses++;
		}

		// Request new token with retry logic
		const tokenResponse = await withRetry(
			async () => {
				const credential = new DefaultAzureCredential();

				console.log(`🔐 Requesting new Azure PostgreSQL access token with scope: ${config.scope}`);

				const response = await credential.getToken([config.scope]);

				if (!response || !response.token) {
					throw new Error('Failed to obtain access token from Azure credential');
				}

				return response;
			},
			config,
			'Azure token request'
		);

		// Update the cache with enhanced features
		enhancedTokenCache = createEnhancedTokenCache(tokenResponse);

		const duration = Date.now() - startTime;
		updateMetrics(duration, true);

		console.log(
			`✅ Successfully obtained Azure PostgreSQL access token (expires: ${new Date(tokenResponse.expiresOnTimestamp).toISOString()}, duration: ${duration}ms)`
		);

		// Schedule proactive refresh if enabled
		if (config.proactiveRefreshEnabled) {
			scheduleProactiveRefresh(config);
		}

		return tokenResponse.token;
	} catch (error) {
		const duration = Date.now() - startTime;
		updateMetrics(duration, false);

		// Update cache error count if we have one
		if (enhancedTokenCache) {
			enhancedTokenCache.errorCount++;
			enhancedTokenCache.lastError = error instanceof Error ? error.message : 'Unknown error';
		}

		console.error('❌ Failed to obtain Azure PostgreSQL access token:', error);
		throw new Error(
			`Enhanced Azure authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Schedules proactive token refresh
 */
let proactiveRefreshTimer: NodeJS.Timeout | null = null;

function scheduleProactiveRefresh(config: EnhancedPostgreSQLAuthConfig) {
	// Clear existing timer
	if (proactiveRefreshTimer) {
		clearTimeout(proactiveRefreshTimer);
	}

	if (!enhancedTokenCache) {
		return;
	}

	const timeToRefresh = enhancedTokenCache.getTimeToExpiry() - config.proactiveRefreshThresholdMs;

	if (timeToRefresh > 0) {
		console.log(
			`⏰ Scheduling proactive token refresh in ${Math.round(timeToRefresh / 60000)} minutes`
		);

		proactiveRefreshTimer = setTimeout(async () => {
			try {
				console.log('🔄 Starting proactive token refresh');
				await getEnhancedAzurePostgreSQLToken(config, true);
				authMetrics.proactiveRefreshCount++;
				console.log('✅ Proactive token refresh completed');
			} catch (error) {
				console.error('❌ Proactive token refresh failed:', error);
			}
		}, timeToRefresh);
	}
}

/**
 * Enhanced cached Azure access token with fallback mechanisms
 */
export async function getEnhancedCachedAzureToken(
	config: EnhancedPostgreSQLAuthConfig = DEFAULT_ENHANCED_AUTH_CONFIG
): Promise<string> {
	try {
		return await getEnhancedAzurePostgreSQLToken(config, false);
	} catch (error) {
		console.warn('⚠️ Primary token retrieval failed, attempting fallback strategies...');

		// Strategy 1: Try force refresh
		try {
			console.log('🔄 Attempting force refresh fallback...');
			const token = await getEnhancedAzurePostgreSQLToken(config, true);
			authMetrics.fallbackToRefreshCount++;
			return token;
		} catch (refreshError) {
			console.error('❌ Force refresh fallback failed:', refreshError);
		}

		// Strategy 2: If we have an expired but recent token, try using it as last resort
		if (enhancedTokenCache && enhancedTokenCache.token) {
			const health = enhancedTokenCache.getHealth();
			const expiredRecently = health.timeToExpiry > -5 * 60 * 1000; // Less than 5 minutes expired

			if (expiredRecently) {
				console.warn('⚠️ Using recently expired token as last resort');
				return enhancedTokenCache.token;
			}
		}

		// All fallback strategies failed
		throw error;
	}
}

/**
 * Gets current authentication metrics for monitoring
 */
export function getAuthMetrics(): AuthMetrics {
	return { ...authMetrics };
}

/**
 * Gets current token health information
 */
export function getTokenHealth(): TokenHealth | null {
	return enhancedTokenCache?.getHealth() || null;
}

/**
 * Resets authentication metrics (useful for testing)
 */
export function resetAuthMetrics(): void {
	authMetrics = {
		totalTokenRequests: 0,
		successfulTokenRequests: 0,
		failedTokenRequests: 0,
		cacheHits: 0,
		cacheMisses: 0,
		averageTokenRequestDuration: 0,
		lastTokenRequestDuration: 0,
		proactiveRefreshCount: 0,
		fallbackToRefreshCount: 0
	};
	requestDurations = [];
	console.log('📊 Authentication metrics reset');
}

/**
 * Logs comprehensive authentication status for monitoring
 */
export function logAuthStatus(): void {
	const metrics = getAuthMetrics();
	const health = getTokenHealth();

	console.log('📊 Azure Authentication Status:');
	console.log(
		`   Token Health: ${health ? (health.isHealthy ? '✅ Healthy' : '⚠️ Degraded') : '❌ No Token'}`
	);

	if (health) {
		console.log(`   Expires: ${new Date(Date.now() + health.timeToExpiry).toISOString()}`);
		console.log(`   Time to Expiry: ${Math.round(health.timeToExpiry / 60000)} minutes`);
		console.log(`   Refresh Count: ${health.refreshCount}`);
		console.log(`   Error Count: ${health.errorCount}`);
	}

	console.log(`   Metrics:`);
	console.log(`     Total Requests: ${metrics.totalTokenRequests}`);
	console.log(
		`     Success Rate: ${metrics.totalTokenRequests > 0 ? Math.round((metrics.successfulTokenRequests / metrics.totalTokenRequests) * 100) : 0}%`
	);
	console.log(
		`     Cache Hit Rate: ${metrics.cacheHits + metrics.cacheMisses > 0 ? Math.round((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100) : 0}%`
	);
	console.log(`     Avg Duration: ${Math.round(metrics.averageTokenRequestDuration)}ms`);
	console.log(`     Proactive Refreshes: ${metrics.proactiveRefreshCount}`);
}

/**
 * Creates an enhanced Azure token provider function with monitoring
 */
export function createEnhancedAzureTokenProvider(
	config: EnhancedPostgreSQLAuthConfig = DEFAULT_ENHANCED_AUTH_CONFIG
): () => Promise<string> {
	return async (): Promise<string> => {
		return getEnhancedCachedAzureToken(config);
	};
}

/**
 * Enhanced version of cache clearing with cleanup
 */
export function clearEnhancedTokenCache(): void {
	enhancedTokenCache = null;

	if (proactiveRefreshTimer) {
		clearTimeout(proactiveRefreshTimer);
		proactiveRefreshTimer = null;
	}

	console.log('🗑️ Enhanced Azure token cache cleared');
}

/**
 * Health check endpoint for monitoring systems
 */
export function getAuthHealthCheck(): {
	status: 'healthy' | 'degraded' | 'unhealthy';
	details: {
		tokenHealth: TokenHealth | null;
		metrics: AuthMetrics;
		uptime: number;
	};
} {
	const health = getTokenHealth();
	const metrics = getAuthMetrics();

	let status: 'healthy' | 'degraded' | 'unhealthy';

	if (!health) {
		status = 'unhealthy';
	} else if (health.isHealthy && health.errorCount === 0) {
		status = 'healthy';
	} else if (health.isHealthy && health.errorCount < 3) {
		status = 'degraded';
	} else {
		status = 'unhealthy';
	}

	return {
		status,
		details: {
			tokenHealth: health,
			metrics,
			uptime: process.uptime()
		}
	};
}
