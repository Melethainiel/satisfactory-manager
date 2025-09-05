/**
 * Structured API Logger
 *
 * Provides structured logging capabilities for the API service with
 * configurable levels, context enrichment, and performance tracking.
 */

import type { LoggingConfig } from '$lib/config/apiConfig';
import type { ErrorContext, ApiError } from '$lib/types/apiErrors';

export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3
}

export interface LogContext {
	requestId?: string;
	userId?: string;
	url?: string;
	method?: string;
	statusCode?: number;
	duration?: number;
	attempt?: number;
	totalAttempts?: number;
	circuitState?: string;
	headers?: Record<string, string>;
	body?: unknown;
	error?: Error | Record<string, unknown>;
	timestamp: string;
}

export interface LogEntry {
	level: keyof typeof LogLevel;
	message: string;
	context: LogContext;
}

/**
 * API Logger class with structured logging capabilities
 */
export class ApiLogger {
	private config: LoggingConfig;
	private currentLogLevel: LogLevel;

	constructor(config: LoggingConfig) {
		this.config = config;
		this.currentLogLevel = LogLevel[config.level.toUpperCase() as keyof typeof LogLevel];
	}

	/**
	 * Update logger configuration
	 */
	updateConfig(config: LoggingConfig): void {
		this.config = config;
		this.currentLogLevel = LogLevel[config.level.toUpperCase() as keyof typeof LogLevel];
	}

	/**
	 * Log debug messages (development/troubleshooting)
	 */
	debug(message: string, context: Partial<LogContext> = {}): void {
		this.log('DEBUG', message, context);
	}

	/**
	 * Log informational messages
	 */
	info(message: string, context: Partial<LogContext> = {}): void {
		this.log('INFO', message, context);
	}

	/**
	 * Log warning messages
	 */
	warn(message: string, context: Partial<LogContext> = {}): void {
		this.log('WARN', message, context);
	}

	/**
	 * Log error messages
	 */
	error(message: string, context: Partial<LogContext> = {}): void {
		this.log('ERROR', message, context);
	}

	/**
	 * Log request start
	 */
	logRequestStart(url: string, method: string, context: Partial<LogContext> = {}): void {
		this.debug('API request started', {
			...context,
			url,
			method,
			headers: this.config.includeHeaders ? context.headers : undefined,
			body: this.shouldIncludeBody(context.body) ? context.body : undefined
		});
	}

	/**
	 * Log request success
	 */
	logRequestSuccess(
		url: string,
		method: string,
		statusCode: number,
		duration: number,
		context: Partial<LogContext> = {}
	): void {
		this.info('API request completed successfully', {
			...context,
			url,
			method,
			statusCode,
			duration
		});
	}

	/**
	 * Log request retry
	 */
	logRequestRetry(
		url: string,
		method: string,
		attempt: number,
		totalAttempts: number,
		error: ApiError,
		delay: number,
		context: Partial<LogContext> = {}
	): void {
		this.warn(`API request retry ${attempt}/${totalAttempts} after ${delay}ms`, {
			...context,
			url,
			method,
			attempt,
			totalAttempts,
			error: {
				message: error.message,
				category: error.category,
				severity: error.severity,
				statusCode: error.statusCode
			}
		});
	}

	/**
	 * Log request failure
	 */
	logRequestFailure(
		url: string,
		method: string,
		error: ApiError,
		duration?: number,
		context: Partial<LogContext> = {}
	): void {
		this.error('API request failed', {
			...context,
			url,
			method,
			duration,
			statusCode: error.statusCode,
			error: {
				name: error.name,
				message: error.message,
				category: error.category,
				severity: error.severity,
				retryable: error.retryable,
				stack: error.stack
			}
		});
	}

	/**
	 * Log circuit breaker state change
	 */
	logCircuitBreakerStateChange(
		url: string,
		oldState: string,
		newState: string,
		context: Partial<LogContext> = {}
	): void {
		const level = newState === 'OPEN' ? 'ERROR' : 'WARN';
		this.log(level, `Circuit breaker state changed: ${oldState} -> ${newState}`, {
			...context,
			url,
			circuitState: newState
		});
	}

	/**
	 * Log performance metrics
	 */
	logMetrics(
		url: string,
		metrics: {
			totalRequests: number;
			successfulRequests: number;
			failedRequests: number;
			averageDuration: number;
			circuitState?: string;
		},
		context: Partial<LogContext> = {}
	): void {
		this.info('API performance metrics', {
			...context,
			url,
			...metrics
		});
	}

	/**
	 * Create log context from error context
	 */
	createContextFromError(errorContext: ErrorContext): LogContext {
		return {
			requestId: errorContext.requestId,
			userId: errorContext.userId,
			url: errorContext.url,
			method: errorContext.method,
			attempt: errorContext.attempt,
			duration: errorContext.duration,
			headers: this.config.includeHeaders ? errorContext.headers : undefined,
			body: this.shouldIncludeBody(errorContext.body) ? errorContext.body : undefined,
			timestamp: errorContext.timestamp.toISOString()
		};
	}

	/**
	 * Core logging method
	 */
	private log(level: keyof typeof LogLevel, message: string, context: Partial<LogContext>): void {
		const logLevel = LogLevel[level];

		// Skip if log level is below current threshold
		if (logLevel < this.currentLogLevel) {
			return;
		}

		const logEntry: LogEntry = {
			level,
			message,
			context: {
				...context,
				timestamp: context.timestamp || new Date().toISOString()
			}
		};

		// Use console methods based on log level
		switch (level) {
			case 'DEBUG':
				console.debug(this.formatLogEntry(logEntry));
				break;
			case 'INFO':
				console.info(this.formatLogEntry(logEntry));
				break;
			case 'WARN':
				console.warn(this.formatLogEntry(logEntry));
				break;
			case 'ERROR':
				console.error(this.formatLogEntry(logEntry));
				break;
		}
	}

	/**
	 * Format log entry for output
	 */
	private formatLogEntry(entry: LogEntry): string {
		const { level, message, context } = entry;
		const { timestamp, ...contextWithoutTimestamp } = context;

		// In development, provide more readable format
		if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
			return `[${timestamp}] ${level}: ${message} ${
				Object.keys(contextWithoutTimestamp).length > 0
					? JSON.stringify(contextWithoutTimestamp, null, 2)
					: ''
			}`;
		}

		// In production, use compact JSON format for easier parsing
		return JSON.stringify({
			timestamp,
			level,
			message,
			...contextWithoutTimestamp
		});
	}

	/**
	 * Check if body should be included in logs based on config and size
	 */
	private shouldIncludeBody(body: unknown): boolean {
		if (!this.config.includeBody || !body) {
			return false;
		}

		// Check body size if it's a string
		if (typeof body === 'string') {
			return body.length <= this.config.maxBodySize;
		}

		// For objects, stringify and check size
		try {
			const bodyString = JSON.stringify(body);
			return bodyString.length <= this.config.maxBodySize;
		} catch {
			return false; // Can't serialize, don't include
		}
	}
}

/**
 * Default logger instance (will be configured by API service)
 */
export let apiLogger: ApiLogger;

/**
 * Initialize the logger with configuration
 */
export function initializeApiLogger(config: LoggingConfig): void {
	apiLogger = new ApiLogger(config);
}

/**
 * Get the current logger instance
 */
export function getApiLogger(): ApiLogger {
	if (!apiLogger) {
		// Fallback configuration if not initialized
		const fallbackConfig: LoggingConfig = {
			level: 'warn',
			includeHeaders: false,
			includeBody: false,
			maxBodySize: 1024
		};
		apiLogger = new ApiLogger(fallbackConfig);
	}
	return apiLogger;
}

/**
 * Type for logger methods (for testing/mocking)
 */
export type LoggerMethod = (message: string, context?: Partial<LogContext>) => void;
