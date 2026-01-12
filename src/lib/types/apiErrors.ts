/**
 * API Error Types and Interfaces
 *
 * Defines custom error classes and types for comprehensive error handling
 * in the centralized API service.
 */

export enum ErrorSeverity {
	LOW = 'low',
	MEDIUM = 'medium',
	HIGH = 'high',
	CRITICAL = 'critical'
}

export enum ErrorCategory {
	NETWORK = 'network',
	AUTHENTICATION = 'authentication',
	AUTHORIZATION = 'authorization',
	VALIDATION = 'validation',
	SERVER = 'server',
	TIMEOUT = 'timeout',
	RATE_LIMIT = 'rate_limit',
	UNKNOWN = 'unknown'
}

export interface ErrorContext {
	url: string;
	method: string;
	requestId?: string;
	userId?: string;
	timestamp: Date;
	attempt?: number;
	duration?: number;
	headers?: Record<string, string>;
	body?: any;
}

export interface ErrorMetadata {
	category: ErrorCategory;
	severity: ErrorSeverity;
	retryable: boolean;
	context: ErrorContext;
	originalError?: Error;
	statusCode?: number;
	statusText?: string;
}

/**
 * Base API Error class with enhanced metadata
 */
export abstract class ApiError extends Error {
	public readonly category: ErrorCategory;
	public readonly severity: ErrorSeverity;
	public readonly retryable: boolean;
	public readonly context: ErrorContext;
	public readonly originalError?: Error;
	public readonly statusCode?: number;
	public readonly statusText?: string;

	constructor(message: string, metadata: ErrorMetadata) {
		super(message);
		this.name = this.constructor.name;
		this.category = metadata.category;
		this.severity = metadata.severity;
		this.retryable = metadata.retryable;
		this.context = metadata.context;
		this.originalError = metadata.originalError;
		this.statusCode = metadata.statusCode;
		this.statusText = metadata.statusText;

		// Maintains proper stack trace for where our error was thrown
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}

	/**
	 * Get a serializable representation of the error
	 * Automatically sanitizes sensitive information in production
	 */
	toJSON(): Record<string, any> {
		const isProduction = isProductionEnvironment();

		return {
			name: this.name,
			message: sanitizeErrorMessage(this, isProduction),
			category: this.category,
			severity: this.severity,
			retryable: this.retryable,
			context: isProduction
				? {
						url: this.context.url,
						method: this.context.method,
						requestId: this.context.requestId,
						timestamp: this.context.timestamp.toISOString(),
						attempt: this.context.attempt,
						duration: this.context.duration
					}
				: {
						...this.context,
						timestamp: this.context.timestamp.toISOString()
					},
			statusCode: this.statusCode,
			statusText: this.statusText,
			stack: isProduction ? undefined : this.stack // Remove stack trace in production
		};
	}
}

/**
 * Network-related errors (connection issues, DNS, etc.)
 */
export class NetworkError extends ApiError {
	constructor(message: string, context: ErrorContext, originalError?: Error) {
		super(message, {
			category: ErrorCategory.NETWORK,
			severity: ErrorSeverity.MEDIUM,
			retryable: true,
			context,
			originalError
		});
	}
}

/**
 * Authentication errors (invalid tokens, expired sessions, etc.)
 */
export class AuthenticationError extends ApiError {
	constructor(message: string, context: ErrorContext, statusCode?: number, statusText?: string) {
		super(message, {
			category: ErrorCategory.AUTHENTICATION,
			severity: ErrorSeverity.HIGH,
			retryable: false, // Usually requires user intervention
			context,
			statusCode,
			statusText
		});
	}
}

/**
 * Authorization errors (insufficient permissions)
 */
export class AuthorizationError extends ApiError {
	constructor(message: string, context: ErrorContext, statusCode?: number, statusText?: string) {
		super(message, {
			category: ErrorCategory.AUTHORIZATION,
			severity: ErrorSeverity.HIGH,
			retryable: false,
			context,
			statusCode,
			statusText
		});
	}
}

/**
 * Validation errors (bad request data, schema violations)
 */
export class ValidationError extends ApiError {
	public readonly validationErrors?: Record<string, string[]>;

	constructor(
		message: string,
		context: ErrorContext,
		validationErrors?: Record<string, string[]>,
		statusCode?: number,
		statusText?: string
	) {
		super(message, {
			category: ErrorCategory.VALIDATION,
			severity: ErrorSeverity.LOW,
			retryable: false,
			context,
			statusCode,
			statusText
		});
		this.validationErrors = validationErrors;
	}

	toJSON(): Record<string, any> {
		return {
			...super.toJSON(),
			validationErrors: this.validationErrors
		};
	}
}

/**
 * Server errors (5xx status codes)
 */
export class ServerError extends ApiError {
	constructor(message: string, context: ErrorContext, statusCode?: number, statusText?: string) {
		const severity = statusCode && statusCode >= 500 ? ErrorSeverity.CRITICAL : ErrorSeverity.HIGH;
		const retryable = statusCode ? statusCode >= 500 && statusCode < 502 : false; // 500, 501 not retryable, 502+ retryable

		super(message, {
			category: ErrorCategory.SERVER,
			severity,
			retryable,
			context,
			statusCode,
			statusText
		});
	}
}

/**
 * Timeout errors (request/response timeouts)
 */
export class TimeoutError extends ApiError {
	public readonly timeoutMs: number;

	constructor(message: string, context: ErrorContext, timeoutMs: number) {
		super(message, {
			category: ErrorCategory.TIMEOUT,
			severity: ErrorSeverity.MEDIUM,
			retryable: true,
			context
		});
		this.timeoutMs = timeoutMs;
	}

	toJSON(): Record<string, any> {
		return {
			...super.toJSON(),
			timeoutMs: this.timeoutMs
		};
	}
}

/**
 * Rate limiting errors (429 status)
 */
export class RateLimitError extends ApiError {
	public readonly retryAfter?: number; // seconds to wait before retry

	constructor(
		message: string,
		context: ErrorContext,
		retryAfter?: number,
		statusCode?: number,
		statusText?: string
	) {
		super(message, {
			category: ErrorCategory.RATE_LIMIT,
			severity: ErrorSeverity.MEDIUM,
			retryable: true,
			context,
			statusCode,
			statusText
		});
		this.retryAfter = retryAfter;
	}

	toJSON(): Record<string, any> {
		return {
			...super.toJSON(),
			retryAfter: this.retryAfter
		};
	}
}

/**
 * Circuit breaker errors (when circuit is open)
 */
export class CircuitBreakerError extends ApiError {
	constructor(message: string, context: ErrorContext) {
		super(message, {
			category: ErrorCategory.NETWORK,
			severity: ErrorSeverity.HIGH,
			retryable: true,
			context
		});
	}
}

/**
 * Generic API errors for unknown/unexpected scenarios
 */
export class GenericApiError extends ApiError {
	constructor(message: string, context: ErrorContext, originalError?: Error) {
		super(message, {
			category: ErrorCategory.UNKNOWN,
			severity: ErrorSeverity.MEDIUM,
			retryable: false,
			context,
			originalError
		});
	}
}

/**
 * Utility function to create appropriate error from HTTP response
 */
export function createErrorFromResponse(
	response: Response,
	context: ErrorContext,
	responseText?: string
): ApiError {
	const { status, statusText } = response;
	const message = responseText || `HTTP ${status}: ${statusText}`;

	switch (true) {
		case status === 401:
			return new AuthenticationError(message, context, status, statusText);
		case status === 403:
			return new AuthorizationError(message, context, status, statusText);
		case status === 400:
			return new ValidationError(message, context, undefined, status, statusText);
		case status === 429:
			const retryAfter = response.headers.get('Retry-After');
			return new RateLimitError(
				message,
				context,
				retryAfter ? parseInt(retryAfter, 10) : undefined,
				status,
				statusText
			);
		case status >= 500:
			return new ServerError(message, context, status, statusText);
		default:
			return new GenericApiError(message, context);
	}
}

/**
 * Utility function to create error from network/fetch errors
 */
export function createErrorFromException(
	error: Error,
	context: ErrorContext,
	timeoutMs?: number
): ApiError {
	if (error.name === 'AbortError' || error.message.includes('timeout')) {
		return new TimeoutError(
			`Request timed out after ${timeoutMs || 'unknown'}ms`,
			context,
			timeoutMs || 0
		);
	}

	if (error.message.includes('fetch') || error.message.includes('network')) {
		return new NetworkError(error.message, context, error);
	}

	return new GenericApiError(error.message, context, error);
}

/**
 * Type guard to check if error is retryable
 */
export function isRetryableError(error: unknown): error is ApiError {
	return error instanceof ApiError && error.retryable;
}

/**
 * Type guard to check if error is an API error
 */
export function isApiError(error: unknown): error is ApiError {
	return error instanceof ApiError;
}

/**
 * Get retry delay based on error type (used for rate limiting)
 */
export function getRetryDelay(error: ApiError): number {
	if (error instanceof RateLimitError && error.retryAfter) {
		return error.retryAfter * 1000; // Convert to milliseconds
	}
	return 0; // Let the retry logic handle exponential backoff
}

/**
 * Sanitize error message for production environment
 * Removes potentially sensitive information while keeping the error useful for debugging
 */
export function sanitizeErrorMessage(error: ApiError, isProduction: boolean = false): string {
	if (!isProduction) {
		return error.message; // In development, show full error messages
	}

	// In production, provide generic messages based on error category
	switch (error.category) {
		case ErrorCategory.AUTHENTICATION:
			return 'Authentification requise. Veuillez vous connecter à nouveau.';
		case ErrorCategory.AUTHORIZATION:
			return "Vous n'avez pas les permissions nécessaires pour cette opération.";
		case ErrorCategory.VALIDATION:
			// For validation errors, we can show more details since they don't contain sensitive info
			if (error instanceof ValidationError && error.validationErrors) {
				const fieldCount = Object.keys(error.validationErrors).length;
				return `Données invalides (${fieldCount} champ(s) en erreur).`;
			}
			return 'Les données fournies ne sont pas valides.';
		case ErrorCategory.SERVER:
			return 'Erreur interne du serveur. Veuillez réessayer plus tard.';
		case ErrorCategory.NETWORK:
			return 'Problème de connexion réseau. Vérifiez votre connexion internet.';
		case ErrorCategory.TIMEOUT:
			return 'La requête a pris trop de temps à aboutir. Veuillez réessayer.';
		case ErrorCategory.RATE_LIMIT:
			if (error instanceof RateLimitError && error.retryAfter) {
				return `Trop de requêtes. Veuillez patienter ${error.retryAfter} secondes.`;
			}
			return 'Trop de requêtes. Veuillez patienter avant de réessayer.';
		case ErrorCategory.UNKNOWN:
		default:
			return "Une erreur inattendue s'est produite. Veuillez réessayer.";
	}
}

/**
 * Sanitize error details for logging in production
 * Removes sensitive information while preserving debugging context
 */
export function sanitizeErrorForLogging(
	error: ApiError,
	isProduction: boolean = false
): Partial<ApiError> {
	if (!isProduction) {
		return error; // In development, log everything
	}

	// In production, remove potentially sensitive fields
	return {
		name: error.name,
		message: sanitizeErrorMessage(error, true),
		category: error.category,
		severity: error.severity,
		retryable: error.retryable,
		statusCode: error.statusCode,
		statusText: error.statusText,
		context: {
			url: error.context.url,
			method: error.context.method,
			requestId: error.context.requestId,
			timestamp: error.context.timestamp,
			attempt: error.context.attempt,
			duration: error.context.duration
			// Exclude: headers, body, userId (potentially sensitive)
		}
		// Exclude: stack trace in production for security
	};
}

/**
 * Check if we're in production environment
 */
export function isProductionEnvironment(): boolean {
	return typeof process !== 'undefined' && process.env.NODE_ENV === 'production';
}
