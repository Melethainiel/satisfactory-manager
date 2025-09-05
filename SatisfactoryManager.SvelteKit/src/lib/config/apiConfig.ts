/**
 * API Service Configuration
 *
 * Centralized configuration for API service behavior including retry logic,
 * circuit breaker settings, timeouts, and logging levels.
 */

export interface RetryConfig {
	maxAttempts: number;
	initialDelay: number; // milliseconds
	maxDelay: number; // milliseconds
	backoffMultiplier: number;
	jitter: boolean; // add randomness to prevent thundering herd
}

export interface CircuitBreakerConfig {
	failureThreshold: number; // number of failures before opening
	recoveryTimeout: number; // milliseconds to wait in open state
	monitoringPeriod: number; // milliseconds to track failure rate
	minimumRequests: number; // minimum requests before circuit can trip
}

export interface TimeoutConfig {
	request: number; // milliseconds for individual requests
	total: number; // milliseconds for entire request including retries
}

export interface LoggingConfig {
	level: 'debug' | 'info' | 'warn' | 'error';
	includeHeaders: boolean;
	includeBody: boolean;
	maxBodySize: number; // maximum body size to log (bytes)
}

export interface ApiServiceConfig {
	retry: RetryConfig;
	circuitBreaker: CircuitBreakerConfig;
	timeouts: TimeoutConfig;
	logging: LoggingConfig;
	enableMetrics: boolean;
	enableCircuitBreaker: boolean;
	enableRetry: boolean;
}

/**
 * Default configuration values optimized for web applications
 */
export const DEFAULT_API_CONFIG: ApiServiceConfig = {
	retry: {
		maxAttempts: 3,
		initialDelay: 1000, // 1 second
		maxDelay: 10000, // 10 seconds
		backoffMultiplier: 2,
		jitter: true
	},
	circuitBreaker: {
		failureThreshold: 5, // 5 consecutive failures
		recoveryTimeout: 30000, // 30 seconds
		monitoringPeriod: 60000, // 1 minute rolling window
		minimumRequests: 10 // at least 10 requests to consider circuit tripping
	},
	timeouts: {
		request: 10000, // 10 seconds for individual request
		total: 30000 // 30 seconds for entire operation including retries
	},
	logging: {
		level: 'warn',
		includeHeaders: false,
		includeBody: false,
		maxBodySize: 1024 // 1KB
	},
	enableMetrics: true,
	enableCircuitBreaker: true,
	enableRetry: true
};

/**
 * Development configuration with more verbose logging and longer timeouts
 */
export const DEV_API_CONFIG: ApiServiceConfig = {
	...DEFAULT_API_CONFIG,
	retry: {
		...DEFAULT_API_CONFIG.retry,
		maxAttempts: 2,
		initialDelay: 500 // faster retries in dev
	},
	timeouts: {
		request: 15000, // 15 seconds for debugging
		total: 45000 // 45 seconds total
	},
	logging: {
		level: 'debug',
		includeHeaders: true,
		includeBody: true,
		maxBodySize: 4096 // 4KB for debugging
	}
};

/**
 * Test configuration optimized for unit tests
 */
export const TEST_API_CONFIG: ApiServiceConfig = {
	...DEFAULT_API_CONFIG,
	retry: {
		...DEFAULT_API_CONFIG.retry,
		maxAttempts: 1, // no retries in tests by default
		initialDelay: 10,
		maxDelay: 100
	},
	circuitBreaker: {
		...DEFAULT_API_CONFIG.circuitBreaker,
		failureThreshold: 2, // trip faster in tests
		recoveryTimeout: 100, // recover faster in tests
		monitoringPeriod: 1000, // 1 second window
		minimumRequests: 2
	},
	timeouts: {
		request: 1000, // 1 second for fast tests
		total: 5000 // 5 seconds total
	},
	logging: {
		level: 'error', // quiet in tests unless there's an issue
		includeHeaders: false,
		includeBody: false,
		maxBodySize: 512
	}
};

/**
 * Configuration for different HTTP status codes and their retry behavior
 */
export const RETRY_STATUS_CODES = new Set([
	408, // Request Timeout
	429, // Too Many Requests (with backoff)
	500, // Internal Server Error
	502, // Bad Gateway
	503, // Service Unavailable
	504, // Gateway Timeout
	507, // Insufficient Storage
	509, // Bandwidth Limit Exceeded
	520, // Unknown Error (Cloudflare)
	521, // Web Server Is Down (Cloudflare)
	522, // Connection Timed Out (Cloudflare)
	523, // Origin Is Unreachable (Cloudflare)
	524 // A Timeout Occurred (Cloudflare)
]);

/**
 * HTTP methods that are safe to retry (idempotent operations)
 */
export const RETRY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);

/**
 * Get configuration based on environment
 */
export function getApiConfig(environment?: string): ApiServiceConfig {
	const env = environment || (typeof process !== 'undefined' ? process.env.NODE_ENV : 'production');

	switch (env) {
		case 'development':
			return DEV_API_CONFIG;
		case 'test':
			return TEST_API_CONFIG;
		case 'production':
		default:
			return DEFAULT_API_CONFIG;
	}
}

/**
 * Calculate exponential backoff delay with jitter
 */
export function calculateBackoffDelay(
	attempt: number,
	config: RetryConfig,
	baseDelay?: number
): number {
	const delay = baseDelay || config.initialDelay;
	let backoffDelay = delay * Math.pow(config.backoffMultiplier, attempt - 1);

	// Cap the delay at maxDelay
	backoffDelay = Math.min(backoffDelay, config.maxDelay);

	// Add jitter if enabled (±25% randomness)
	if (config.jitter) {
		const jitterRange = backoffDelay * 0.25;
		backoffDelay += (Math.random() - 0.5) * 2 * jitterRange;
	}

	return Math.max(0, Math.floor(backoffDelay));
}

/**
 * Check if HTTP method is safe to retry
 */
export function isMethodRetryable(method: string): boolean {
	return RETRY_METHODS.has(method.toUpperCase());
}

/**
 * Check if HTTP status code indicates a retryable error
 */
export function isStatusRetryable(status: number): boolean {
	return RETRY_STATUS_CODES.has(status);
}

/**
 * Type for custom configuration overrides
 */
export type ApiConfigOverrides = Partial<ApiServiceConfig> & {
	retry?: Partial<RetryConfig>;
	circuitBreaker?: Partial<CircuitBreakerConfig>;
	timeouts?: Partial<TimeoutConfig>;
	logging?: Partial<LoggingConfig>;
};

/**
 * Merge configuration with overrides
 */
export function mergeApiConfig(
	baseConfig: ApiServiceConfig,
	overrides: ApiConfigOverrides
): ApiServiceConfig {
	return {
		...baseConfig,
		...overrides,
		retry: {
			...baseConfig.retry,
			...(overrides.retry || {})
		},
		circuitBreaker: {
			...baseConfig.circuitBreaker,
			...(overrides.circuitBreaker || {})
		},
		timeouts: {
			...baseConfig.timeouts,
			...(overrides.timeouts || {})
		},
		logging: {
			...baseConfig.logging,
			...(overrides.logging || {})
		}
	};
}
