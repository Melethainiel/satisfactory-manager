import { notificationService } from './notificationService.svelte';
import {
	getApiConfig,
	calculateBackoffDelay,
	isMethodRetryable,
	isStatusRetryable,
	type ApiServiceConfig,
	type ApiConfigOverrides
} from '$lib/config/apiConfig';
import { initializeApiLogger, getApiLogger, type LogContext } from './apiLogger';
import { apiMetrics, type RequestMetric } from './apiMetrics';
import {
	createErrorFromResponse,
	createErrorFromException,
	isRetryableError,
	isApiError,
	getRetryDelay,
	CircuitBreakerError,
	type ApiError,
	type ErrorContext,
	ErrorCategory
} from '$lib/types/apiErrors';

type AuthFetchFn = <T = any>(
	input: string | URL | Request,
	init?: RequestInit & { autoJson?: boolean }
) => Promise<T | Response>;

export interface ApiRequestOptions extends RequestInit {
	showErrorNotification?: boolean;
	autoJson?: boolean;
	retry?: {
		maxAttempts?: number;
		initialDelay?: number;
		maxDelay?: number;
		backoffMultiplier?: number;
		jitter?: boolean;
	};
	timeout?: number;
	circuitBreaker?: boolean;
	logContext?: Partial<LogContext>;
	requestId?: string;
}

export interface ApiService {
	setApiFetch(apiFetch: AuthFetchFn): void;
	configure(config: ApiConfigOverrides): void;
	get<T = any>(url: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T>;
	post<T = any>(url: string, data?: any, options?: Omit<ApiRequestOptions, 'method'>): Promise<T>;
	put<T = any>(url: string, data?: any, options?: Omit<ApiRequestOptions, 'method'>): Promise<T>;
	patch<T = any>(url: string, data?: any, options?: Omit<ApiRequestOptions, 'method'>): Promise<T>;
	delete<T = any>(url: string, options?: Omit<ApiRequestOptions, 'method'>): Promise<T>;
	fetch<T = any>(url: string, options?: ApiRequestOptions): Promise<T>;
	getMetrics(): any;
	getHealth(): any;
}

/**
 * Circuit Breaker implementation for API reliability
 */
class CircuitBreaker {
	private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
	private failureCount: number = 0;
	private lastFailureTime?: Date;
	private nextAttemptTime?: Date;
	private successCount: number = 0;

	constructor(
		private config: { failureThreshold: number; recoveryTimeout: number },
		private url: string
	) {}

	async execute<T>(operation: () => Promise<T>): Promise<T> {
		if (this.state === 'OPEN') {
			if (this.nextAttemptTime && Date.now() < this.nextAttemptTime.getTime()) {
				throw new CircuitBreakerError(
					`Circuit breaker is OPEN for ${this.url}. Next attempt at ${this.nextAttemptTime.toISOString()}`,
					{
						url: this.url,
						method: 'UNKNOWN',
						timestamp: new Date()
					}
				);
			}
			this.state = 'HALF_OPEN';
			this.successCount = 0;
			apiMetrics.recordCircuitBreakerStateChange(this.url, 'OPEN', 'HALF_OPEN');
		}

		try {
			const result = await operation();
			this.onSuccess();
			return result;
		} catch (error) {
			this.onFailure();
			throw error;
		}
	}

	private onSuccess(): void {
		this.failureCount = 0;
		this.successCount++;

		if (this.state === 'HALF_OPEN') {
			this.state = 'CLOSED';
			apiMetrics.recordCircuitBreakerStateChange(this.url, 'HALF_OPEN', 'CLOSED');
		}

		apiMetrics.recordCircuitBreakerRequest(this.url, true);
	}

	private onFailure(): void {
		this.failureCount++;
		this.lastFailureTime = new Date();

		if (this.failureCount >= this.config.failureThreshold) {
			const oldState = this.state;
			this.state = 'OPEN';
			this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
			apiMetrics.recordCircuitBreakerStateChange(this.url, oldState, 'OPEN');
		}

		apiMetrics.recordCircuitBreakerRequest(this.url, false);
	}

	getState(): string {
		return this.state;
	}
}

class ApiServiceClass implements ApiService {
	private apiFetch: AuthFetchFn | null = null;
	private config: ApiServiceConfig;
	private circuitBreakers: Map<string, CircuitBreaker> = new Map();
	private requestCounter: number = 0;

	constructor() {
		this.config = getApiConfig();
		initializeApiLogger(this.config.logging);
	}

	setApiFetch(apiFetch: AuthFetchFn) {
		this.apiFetch = apiFetch;
	}

	configure(overrides: ApiConfigOverrides): void {
		this.config = { ...this.config, ...overrides };
		getApiLogger().updateConfig(this.config.logging);
	}

	private ensureApiFetch(): AuthFetchFn {
		if (!this.apiFetch) {
			throw new Error('API service not initialized. Call setApiFetch() first.');
		}
		return this.apiFetch;
	}

	async get<T = any>(
		url: string,
		options: Omit<ApiRequestOptions, 'method' | 'body'> = {}
	): Promise<T> {
		return this.fetch<T>(url, { ...options, method: 'GET' });
	}

	async post<T = any>(
		url: string,
		data?: any,
		options: Omit<ApiRequestOptions, 'method'> = {}
	): Promise<T> {
		return this.fetch<T>(url, {
			...options,
			method: 'POST',
			body: data ? JSON.stringify(data) : undefined,
			headers: {
				'Content-Type': 'application/json',
				...options.headers
			}
		});
	}

	async put<T = any>(
		url: string,
		data?: any,
		options: Omit<ApiRequestOptions, 'method'> = {}
	): Promise<T> {
		return this.fetch<T>(url, {
			...options,
			method: 'PUT',
			body: data ? JSON.stringify(data) : undefined,
			headers: {
				'Content-Type': 'application/json',
				...options.headers
			}
		});
	}

	async patch<T = any>(
		url: string,
		data?: any,
		options: Omit<ApiRequestOptions, 'method'> = {}
	): Promise<T> {
		return this.fetch<T>(url, {
			...options,
			method: 'PATCH',
			body: data ? JSON.stringify(data) : undefined,
			headers: {
				'Content-Type': 'application/json',
				...options.headers
			}
		});
	}

	async delete<T = any>(url: string, options: Omit<ApiRequestOptions, 'method'> = {}): Promise<T> {
		return this.fetch<T>(url, { ...options, method: 'DELETE' });
	}

	async fetch<T = any>(url: string, options: ApiRequestOptions = {}): Promise<T> {
		const requestId = options.requestId || this.generateRequestId();
		const startTime = Date.now();
		const method = (options.method || 'GET').toUpperCase();

		const {
			showErrorNotification = true,
			autoJson = true,
			retry: retryOptions,
			timeout = this.config.timeouts.request,
			circuitBreaker = this.config.enableCircuitBreaker,
			logContext = {},
			...fetchOptions
		} = options;

		const logger = getApiLogger();
		const context: ErrorContext = {
			url,
			method,
			requestId,
			timestamp: new Date(),
			headers: fetchOptions.headers as Record<string, string>,
			body: fetchOptions.body
		};

		logger.logRequestStart(url, method, { ...logContext, requestId });

		// Execute with circuit breaker if enabled
		if (circuitBreaker) {
			return this.executeWithCircuitBreaker(url, () =>
				this.executeWithRetry(url, fetchOptions, {
					showErrorNotification,
					autoJson,
					timeout,
					retry: retryOptions,
					context,
					startTime,
					logContext
				})
			);
		}

		return this.executeWithRetry(url, fetchOptions, {
			showErrorNotification,
			autoJson,
			timeout,
			retry: retryOptions,
			context,
			startTime,
			logContext
		});
	}

	getMetrics() {
		return apiMetrics.getOverallMetrics();
	}

	getHealth() {
		return apiMetrics.getHealthCheck();
	}

	private async executeWithCircuitBreaker<T>(url: string, operation: () => Promise<T>): Promise<T> {
		const normalizedUrl = this.normalizeUrlForCircuitBreaker(url);

		if (!this.circuitBreakers.has(normalizedUrl)) {
			this.circuitBreakers.set(
				normalizedUrl,
				new CircuitBreaker(this.config.circuitBreaker, normalizedUrl)
			);
		}

		const circuitBreaker = this.circuitBreakers.get(normalizedUrl)!;
		return circuitBreaker.execute(operation);
	}

	private async executeWithRetry<T>(
		url: string,
		fetchOptions: RequestInit,
		options: {
			showErrorNotification: boolean;
			autoJson: boolean;
			timeout: number;
			retry?: ApiRequestOptions['retry'];
			context: ErrorContext;
			startTime: number;
			logContext: Partial<LogContext>;
		}
	): Promise<T> {
		const {
			showErrorNotification,
			autoJson,
			timeout,
			retry: retryOptions,
			context,
			startTime,
			logContext
		} = options;

		const logger = getApiLogger();
		const method = (fetchOptions.method || 'GET').toUpperCase();

		// Determine retry configuration
		const shouldRetry = this.config.enableRetry && isMethodRetryable(method);
		const maxAttempts = shouldRetry
			? (retryOptions?.maxAttempts ?? this.config.retry.maxAttempts)
			: 1;

		let lastError: ApiError | null = null;
		const totalTimeout = setTimeout(() => {
			throw createErrorFromException(
				new Error(`Total request timeout after ${this.config.timeouts.total}ms`),
				context,
				this.config.timeouts.total
			);
		}, this.config.timeouts.total);

		try {
			for (let attempt = 1; attempt <= maxAttempts; attempt++) {
				const attemptContext = { ...context, attempt };
				const attemptStartTime = Date.now();

				try {
					const result = await this.executeSingleRequest<T>(
						url,
						fetchOptions,
						{ showErrorNotification, autoJson, timeout },
						attemptContext
					);

					// Success - record metrics and return
					const duration = Date.now() - startTime;
					this.recordRequestMetric({
						url,
						method,
						duration,
						success: true,
						timestamp: new Date(),
						attempt
					});

					logger.logRequestSuccess(url, method, 200, duration, {
						...logContext,
						requestId: context.requestId
					});

					return result;
				} catch (error) {
					const apiError = this.convertToApiError(error, attemptContext);
					lastError = apiError;

					// Record failed attempt
					const attemptDuration = Date.now() - attemptStartTime;
					this.recordRequestMetric({
						url,
						method,
						statusCode: apiError.statusCode,
						duration: attemptDuration,
						success: false,
						timestamp: new Date(),
						attempt,
						error: {
							category: apiError.category,
							severity: apiError.severity,
							retryable: apiError.retryable
						}
					});

					// Check if we should retry
					if (attempt >= maxAttempts || !this.shouldRetryError(apiError)) {
						break;
					}

					// Calculate delay and wait
					const baseDelay = getRetryDelay(apiError);
					const delay =
						baseDelay ||
						calculateBackoffDelay(attempt, {
							maxAttempts,
							initialDelay: retryOptions?.initialDelay ?? this.config.retry.initialDelay,
							maxDelay: retryOptions?.maxDelay ?? this.config.retry.maxDelay,
							backoffMultiplier:
								retryOptions?.backoffMultiplier ?? this.config.retry.backoffMultiplier,
							jitter: retryOptions?.jitter ?? this.config.retry.jitter
						});

					logger.logRequestRetry(url, method, attempt, maxAttempts, apiError, delay, {
						...logContext,
						requestId: context.requestId
					});

					if (delay > 0) {
						await new Promise((resolve) => setTimeout(resolve, delay));
					}
				}
			}

			// All attempts failed
			if (lastError) {
				const totalDuration = Date.now() - startTime;
				logger.logRequestFailure(url, method, lastError, totalDuration, {
					...logContext,
					requestId: context.requestId
				});

				if (showErrorNotification && !lastError.message.includes('Circuit breaker')) {
					notificationService.error(this.getErrorNotificationMessage(lastError));
				}

				throw lastError;
			}

			throw new Error('Unexpected error: no attempts were made');
		} finally {
			clearTimeout(totalTimeout);
		}
	}

	private async executeSingleRequest<T>(
		url: string,
		fetchOptions: RequestInit,
		options: { showErrorNotification: boolean; autoJson: boolean; timeout: number },
		context: ErrorContext
	): Promise<T> {
		const apiFetch = this.ensureApiFetch();
		const { autoJson, timeout } = options;

		// Create timeout controller
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			const response = await apiFetch(url, {
				...fetchOptions,
				autoJson: false, // We'll handle JSON parsing ourselves
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			if (response instanceof Response) {
				if (!response.ok) {
					let responseText: string | undefined;
					try {
						responseText = await response.text();
					} catch {
						// Ignore text parsing errors
					}
					throw createErrorFromResponse(response, context, responseText);
				}

				if (autoJson) {
					return await response.json();
				}
				return response as unknown as T;
			}

			return response as T;
		} catch (error) {
			clearTimeout(timeoutId);

			if (error instanceof Error && (error.name === 'AbortError' || controller.signal.aborted)) {
				throw createErrorFromException(error, context, timeout);
			}

			if (isApiError(error)) {
				throw error;
			}

			throw createErrorFromException(error as Error, context);
		}
	}

	private convertToApiError(error: unknown, context: ErrorContext): ApiError {
		if (isApiError(error)) {
			return error;
		}

		if (error instanceof Error) {
			return createErrorFromException(error, context);
		}

		return createErrorFromException(new Error(String(error)), context);
	}

	private shouldRetryError(error: ApiError): boolean {
		if (!isRetryableError(error)) {
			return false;
		}

		// Don't retry circuit breaker errors
		if (error instanceof CircuitBreakerError) {
			return false;
		}

		// Check if status code is retryable
		if (error.statusCode && !isStatusRetryable(error.statusCode)) {
			return false;
		}

		return true;
	}

	private recordRequestMetric(metric: RequestMetric): void {
		if (this.config.enableMetrics) {
			apiMetrics.recordRequest(metric);
		}
	}

	private generateRequestId(): string {
		return `req_${Date.now()}_${++this.requestCounter}_${Math.random().toString(36).substr(2, 9)}`;
	}

	private normalizeUrlForCircuitBreaker(url: string): string {
		try {
			const parsed = new URL(url, 'http://localhost');
			return parsed.pathname;
		} catch {
			return url;
		}
	}

	private getErrorNotificationMessage(error: ApiError): string {
		switch (error.category) {
			case ErrorCategory.NETWORK:
				return 'Problème de connexion réseau. Veuillez vérifier votre connexion.';
			case ErrorCategory.AUTHENTICATION:
				return "Problème d'authentification. Veuillez vous reconnecter.";
			case ErrorCategory.AUTHORIZATION:
				return "Vous n'avez pas les permissions nécessaires pour cette action.";
			case ErrorCategory.VALIDATION:
				return 'Données invalides. Veuillez vérifier votre saisie.';
			case ErrorCategory.SERVER:
				return 'Erreur du serveur. Veuillez réessayer plus tard.';
			case ErrorCategory.TIMEOUT:
				return 'La requête a expiré. Veuillez réessayer.';
			case ErrorCategory.RATE_LIMIT:
				return 'Trop de requêtes. Veuillez attendre un moment avant de réessayer.';
			default:
				return error.message || "Une erreur inattendue s'est produite.";
		}
	}
}

export const apiService: ApiService = new ApiServiceClass();
