/**
 * API Performance Metrics System
 *
 * Collects and tracks performance metrics, success rates, and health statistics
 * for the API service with circuit breaker integration.
 */

import type { ApiError } from '$lib/types/apiErrors';

export interface RequestMetric {
	url: string;
	method: string;
	statusCode?: number;
	duration: number;
	success: boolean;
	timestamp: Date;
	attempt: number;
	error?: {
		category: string;
		severity: string;
		retryable: boolean;
	};
}

export interface EndpointMetrics {
	url: string;
	totalRequests: number;
	successfulRequests: number;
	failedRequests: number;
	totalDuration: number;
	averageDuration: number;
	minDuration: number;
	maxDuration: number;
	successRate: number;
	lastRequestTime: Date;
	recentRequests: RequestMetric[];
	errorsByCategory: Record<string, number>;
	errorsBySeverity: Record<string, number>;
}

export interface CircuitBreakerMetrics {
	state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
	failureCount: number;
	successCount: number;
	lastFailureTime?: Date;
	lastSuccessTime?: Date;
	openedTime?: Date;
	totalTrips: number;
	requestsSinceLastTrip: number;
}

export interface OverallMetrics {
	totalRequests: number;
	successfulRequests: number;
	failedRequests: number;
	averageResponseTime: number;
	uptime: number;
	startTime: Date;
	endpoints: Record<string, EndpointMetrics>;
	circuitBreakers: Record<string, CircuitBreakerMetrics>;
}

/**
 * Simple object pool for RequestMetric objects to reduce GC pressure
 */
class RequestMetricPool {
	private pool: RequestMetric[] = [];
	private readonly maxPoolSize: number = 50;

	get(): RequestMetric {
		return this.pool.pop() || this.createNew();
	}

	release(metric: RequestMetric): void {
		if (this.pool.length < this.maxPoolSize) {
			// Reset the metric object for reuse
			this.resetMetric(metric);
			this.pool.push(metric);
		}
	}

	private createNew(): RequestMetric {
		return {
			url: '',
			method: '',
			statusCode: 0,
			duration: 0,
			success: false,
			timestamp: new Date(),
			attempt: 0,
			error: undefined
		};
	}

	private resetMetric(metric: RequestMetric): void {
		metric.url = '';
		metric.method = '';
		metric.statusCode = 0;
		metric.duration = 0;
		metric.success = false;
		metric.timestamp = new Date();
		metric.attempt = 0;
		metric.error = undefined;
	}
}

/**
 * API Metrics Collector
 */
export class ApiMetricsCollector {
	private metrics: OverallMetrics;
	private readonly maxRecentRequests: number = 100; // Keep last 100 requests per endpoint
	private readonly metricsRetentionMs: number = 60 * 60 * 1000; // 1 hour
	private cleanupInterval: NodeJS.Timeout | null = null;
	private lastCleanupTime: number = Date.now();
	private readonly cleanupIntervalMs: number = 5 * 60 * 1000; // Clean up every 5 minutes
	private objectPool: RequestMetricPool = new RequestMetricPool();
	private enableObjectPooling: boolean = true;

	constructor() {
		this.metrics = {
			totalRequests: 0,
			successfulRequests: 0,
			failedRequests: 0,
			averageResponseTime: 0,
			uptime: 0,
			startTime: new Date(),
			endpoints: {},
			circuitBreakers: {}
		};

		// Start periodic cleanup
		this.startPeriodicCleanup();
	}

	/**
	 * Configure object pooling
	 */
	configureObjectPooling(enabled: boolean): void {
		this.enableObjectPooling = enabled;
	}

	/**
	 * Create a request metric (using object pooling if enabled)
	 */
	createRequestMetric(data: Omit<RequestMetric, 'timestamp'>): RequestMetric {
		if (!this.enableObjectPooling) {
			return {
				...data,
				timestamp: new Date()
			};
		}

		const metric = this.objectPool.get();
		metric.url = data.url;
		metric.method = data.method;
		metric.statusCode = data.statusCode;
		metric.duration = data.duration;
		metric.success = data.success;
		metric.timestamp = new Date();
		metric.attempt = data.attempt;
		metric.error = data.error;
		return metric;
	}

	/**
	 * Record a request metric
	 */
	recordRequest(metric: RequestMetric): void {
		const endpointKey = this.getEndpointKey(metric.url, metric.method);

		// Update overall metrics
		this.metrics.totalRequests++;
		if (metric.success) {
			this.metrics.successfulRequests++;
		} else {
			this.metrics.failedRequests++;
		}

		// Calculate new average response time (incremental)
		this.metrics.averageResponseTime =
			(this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + metric.duration) /
			this.metrics.totalRequests;

		// Update endpoint-specific metrics
		this.updateEndpointMetrics(endpointKey, metric);

		// Clean old metrics periodically (both count-based and time-based)
		if (
			this.metrics.totalRequests % 100 === 0 ||
			Date.now() - this.lastCleanupTime > this.cleanupIntervalMs
		) {
			this.cleanOldMetrics();
			this.lastCleanupTime = Date.now();
		}
	}

	/**
	 * Record circuit breaker state change
	 */
	recordCircuitBreakerStateChange(
		url: string,
		oldState: string,
		newState: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
	): void {
		const key = this.normalizeUrl(url);

		if (!this.metrics.circuitBreakers[key]) {
			this.metrics.circuitBreakers[key] = {
				state: newState,
				failureCount: 0,
				successCount: 0,
				totalTrips: 0,
				requestsSinceLastTrip: 0
			};
		}

		const cb = this.metrics.circuitBreakers[key];
		cb.state = newState;

		if (newState === 'OPEN') {
			cb.openedTime = new Date();
			cb.totalTrips++;
			cb.requestsSinceLastTrip = 0;
		}
	}

	/**
	 * Record circuit breaker request result
	 */
	recordCircuitBreakerRequest(url: string, success: boolean): void {
		const key = this.normalizeUrl(url);

		if (!this.metrics.circuitBreakers[key]) {
			this.metrics.circuitBreakers[key] = {
				state: 'CLOSED',
				failureCount: 0,
				successCount: 0,
				totalTrips: 0,
				requestsSinceLastTrip: 0
			};
		}

		const cb = this.metrics.circuitBreakers[key];
		cb.requestsSinceLastTrip++;

		if (success) {
			cb.successCount++;
			cb.lastSuccessTime = new Date();
		} else {
			cb.failureCount++;
			cb.lastFailureTime = new Date();
		}
	}

	/**
	 * Get metrics for a specific endpoint
	 */
	getEndpointMetrics(url: string, method: string): EndpointMetrics | null {
		const key = this.getEndpointKey(url, method);
		return this.metrics.endpoints[key] || null;
	}

	/**
	 * Get circuit breaker metrics for an endpoint
	 */
	getCircuitBreakerMetrics(url: string): CircuitBreakerMetrics | null {
		const key = this.normalizeUrl(url);
		return this.metrics.circuitBreakers[key] || null;
	}

	/**
	 * Get overall metrics
	 */
	getOverallMetrics(): OverallMetrics {
		// Calculate uptime
		this.metrics.uptime = Date.now() - this.metrics.startTime.getTime();
		return { ...this.metrics };
	}

	/**
	 * Get health check information
	 */
	getHealthCheck(): {
		status: 'healthy' | 'degraded' | 'unhealthy';
		checks: Record<string, { status: string; message: string }>;
	} {
		const checks: Record<string, { status: string; message: string }> = {};
		let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

		// Check overall success rate
		const successRate =
			this.metrics.totalRequests > 0
				? this.metrics.successfulRequests / this.metrics.totalRequests
				: 1;

		if (successRate < 0.5) {
			overallStatus = 'unhealthy';
			checks.successRate = {
				status: 'unhealthy',
				message: `Success rate too low: ${(successRate * 100).toFixed(1)}%`
			};
		} else if (successRate < 0.9) {
			overallStatus = 'degraded';
			checks.successRate = {
				status: 'degraded',
				message: `Success rate degraded: ${(successRate * 100).toFixed(1)}%`
			};
		} else {
			checks.successRate = {
				status: 'healthy',
				message: `Success rate good: ${(successRate * 100).toFixed(1)}%`
			};
		}

		// Enhanced circuit breaker health checks
		const circuitBreakerMetrics = this.getCircuitBreakerHealthMetrics();

		if (circuitBreakerMetrics.openCount > 0) {
			if (overallStatus === 'healthy') overallStatus = 'degraded';
			checks.circuitBreakers = {
				status: 'degraded',
				message: `${circuitBreakerMetrics.openCount} circuit breaker(s) open, ${circuitBreakerMetrics.halfOpenCount} recovering`
			};
		} else if (circuitBreakerMetrics.halfOpenCount > 0) {
			checks.circuitBreakers = {
				status: 'healthy',
				message: `${circuitBreakerMetrics.halfOpenCount} circuit breaker(s) recovering`
			};
		} else if (circuitBreakerMetrics.totalCount > 0) {
			checks.circuitBreakers = {
				status: 'healthy',
				message: `All ${circuitBreakerMetrics.totalCount} circuit breakers closed`
			};
		} else {
			checks.circuitBreakers = {
				status: 'healthy',
				message: 'No circuit breakers configured'
			};
		}

		// Add individual circuit breaker details if any are problematic
		if (circuitBreakerMetrics.openCount > 0 || circuitBreakerMetrics.halfOpenCount > 0) {
			for (const [url, cb] of Object.entries(this.metrics.circuitBreakers)) {
				if (cb.state !== 'CLOSED') {
					const key = `circuit_${url.replace(/\W/g, '_')}`;
					const nextAttemptIn =
						cb.openedTime && cb.state === 'OPEN'
							? Math.max(0, cb.openedTime.getTime() + 30000 - Date.now()) // Assuming 30s timeout
							: 0;

					checks[key] = {
						status: cb.state === 'OPEN' ? 'degraded' : 'healthy',
						message:
							cb.state === 'OPEN'
								? `${url}: ${cb.state} (${cb.failureCount} failures, next attempt in ${Math.ceil(nextAttemptIn / 1000)}s)`
								: `${url}: ${cb.state} (${cb.successCount} successes since recovery)`
					};
				}
			}
		}

		// Check average response time
		if (this.metrics.averageResponseTime > 10000) {
			// 10 seconds
			if (overallStatus !== 'unhealthy') overallStatus = 'degraded';
			checks.responseTime = {
				status: 'degraded',
				message: `High average response time: ${this.metrics.averageResponseTime}ms`
			};
		} else {
			checks.responseTime = {
				status: 'healthy',
				message: `Response time good: ${this.metrics.averageResponseTime}ms`
			};
		}

		return { status: overallStatus, checks };
	}

	/**
	 * Get detailed circuit breaker health metrics
	 */
	private getCircuitBreakerHealthMetrics(): {
		totalCount: number;
		openCount: number;
		halfOpenCount: number;
		closedCount: number;
		totalTrips: number;
		averageFailureRate: number;
	} {
		const circuits = Object.values(this.metrics.circuitBreakers);
		const totalCount = circuits.length;
		const openCount = circuits.filter((cb) => cb.state === 'OPEN').length;
		const halfOpenCount = circuits.filter((cb) => cb.state === 'HALF_OPEN').length;
		const closedCount = circuits.filter((cb) => cb.state === 'CLOSED').length;
		const totalTrips = circuits.reduce((sum, cb) => sum + cb.totalTrips, 0);

		// Calculate average failure rate across all circuits
		const totalRequests = circuits.reduce((sum, cb) => sum + cb.failureCount + cb.successCount, 0);
		const totalFailures = circuits.reduce((sum, cb) => sum + cb.failureCount, 0);
		const averageFailureRate = totalRequests > 0 ? totalFailures / totalRequests : 0;

		return {
			totalCount,
			openCount,
			halfOpenCount,
			closedCount,
			totalTrips,
			averageFailureRate
		};
	}

	/**
	 * Reset all metrics
	 */
	reset(): void {
		// Stop existing cleanup timer
		this.stopPeriodicCleanup();

		this.metrics = {
			totalRequests: 0,
			successfulRequests: 0,
			failedRequests: 0,
			averageResponseTime: 0,
			uptime: 0,
			startTime: new Date(),
			endpoints: {},
			circuitBreakers: {}
		};

		// Restart cleanup timer
		this.startPeriodicCleanup();
		this.lastCleanupTime = Date.now();
	}

	/**
	 * Export metrics in Prometheus format
	 */
	exportPrometheusMetrics(): string {
		const lines: string[] = [];
		const timestamp = Date.now();

		// Overall metrics
		lines.push(`# HELP api_requests_total Total number of API requests`);
		lines.push(`# TYPE api_requests_total counter`);
		lines.push(`api_requests_total ${this.metrics.totalRequests} ${timestamp}`);

		lines.push(`# HELP api_requests_successful_total Total number of successful API requests`);
		lines.push(`# TYPE api_requests_successful_total counter`);
		lines.push(`api_requests_successful_total ${this.metrics.successfulRequests} ${timestamp}`);

		lines.push(`# HELP api_requests_failed_total Total number of failed API requests`);
		lines.push(`# TYPE api_requests_failed_total counter`);
		lines.push(`api_requests_failed_total ${this.metrics.failedRequests} ${timestamp}`);

		lines.push(`# HELP api_response_time_average_ms Average response time in milliseconds`);
		lines.push(`# TYPE api_response_time_average_ms gauge`);
		lines.push(`api_response_time_average_ms ${this.metrics.averageResponseTime} ${timestamp}`);

		// Per-endpoint metrics
		for (const [endpoint, metrics] of Object.entries(this.metrics.endpoints)) {
			const [url, method] = endpoint.split('|');

			lines.push(
				`api_endpoint_requests_total{url="${url}",method="${method}"} ${metrics.totalRequests} ${timestamp}`
			);
			lines.push(
				`api_endpoint_requests_successful_total{url="${url}",method="${method}"} ${metrics.successfulRequests} ${timestamp}`
			);
			lines.push(
				`api_endpoint_requests_failed_total{url="${url}",method="${method}"} ${metrics.failedRequests} ${timestamp}`
			);
			lines.push(
				`api_endpoint_response_time_average_ms{url="${url}",method="${method}"} ${metrics.averageDuration} ${timestamp}`
			);
			lines.push(
				`api_endpoint_success_rate{url="${url}",method="${method}"} ${metrics.successRate} ${timestamp}`
			);
		}

		// Circuit breaker metrics
		lines.push(
			`# HELP api_circuit_breaker_state Circuit breaker state (0=CLOSED, 1=OPEN, 2=HALF_OPEN)`
		);
		lines.push(`# TYPE api_circuit_breaker_state gauge`);

		for (const [url, cb] of Object.entries(this.metrics.circuitBreakers)) {
			const stateValue = cb.state === 'CLOSED' ? 0 : cb.state === 'OPEN' ? 1 : 2;
			lines.push(`api_circuit_breaker_state{url="${url}"} ${stateValue} ${timestamp}`);
			lines.push(`api_circuit_breaker_total_trips{url="${url}"} ${cb.totalTrips} ${timestamp}`);
		}

		return lines.join('\n') + '\n';
	}

	/**
	 * Update endpoint-specific metrics
	 */
	private updateEndpointMetrics(endpointKey: string, metric: RequestMetric): void {
		if (!this.metrics.endpoints[endpointKey]) {
			this.metrics.endpoints[endpointKey] = {
				url: metric.url,
				totalRequests: 0,
				successfulRequests: 0,
				failedRequests: 0,
				totalDuration: 0,
				averageDuration: 0,
				minDuration: metric.duration,
				maxDuration: metric.duration,
				successRate: 0,
				lastRequestTime: metric.timestamp,
				recentRequests: [],
				errorsByCategory: {},
				errorsBySeverity: {}
			};
		}

		const endpoint = this.metrics.endpoints[endpointKey];

		endpoint.totalRequests++;
		endpoint.totalDuration += metric.duration;
		endpoint.averageDuration = endpoint.totalDuration / endpoint.totalRequests;
		endpoint.minDuration = Math.min(endpoint.minDuration, metric.duration);
		endpoint.maxDuration = Math.max(endpoint.maxDuration, metric.duration);
		endpoint.lastRequestTime = metric.timestamp;

		if (metric.success) {
			endpoint.successfulRequests++;
		} else {
			endpoint.failedRequests++;

			// Track error categories and severity
			if (metric.error) {
				endpoint.errorsByCategory[metric.error.category] =
					(endpoint.errorsByCategory[metric.error.category] || 0) + 1;
				endpoint.errorsBySeverity[metric.error.severity] =
					(endpoint.errorsBySeverity[metric.error.severity] || 0) + 1;
			}
		}

		endpoint.successRate = endpoint.successfulRequests / endpoint.totalRequests;

		// Add to recent requests (limited size)
		endpoint.recentRequests.push(metric);
		if (endpoint.recentRequests.length > this.maxRecentRequests) {
			endpoint.recentRequests.shift();
		}
	}

	/**
	 * Generate endpoint key from URL and method
	 */
	private getEndpointKey(url: string, method: string): string {
		return `${this.normalizeUrl(url)}|${method.toUpperCase()}`;
	}

	/**
	 * Normalize URL for consistent metrics tracking
	 */
	private normalizeUrl(url: string): string {
		try {
			const parsed = new URL(url, 'http://localhost');
			// Remove query parameters for cleaner metrics
			return parsed.pathname;
		} catch {
			// If URL parsing fails, return as-is
			return url;
		}
	}

	/**
	 * Start periodic cleanup timer
	 */
	private startPeriodicCleanup(): void {
		// Only start if we're in a browser/Node.js environment that supports timers
		if (typeof setInterval !== 'undefined') {
			this.cleanupInterval = setInterval(() => {
				this.cleanOldMetrics();
			}, this.cleanupIntervalMs);
		}
	}

	/**
	 * Stop periodic cleanup timer
	 */
	stopPeriodicCleanup(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}
	}

	/**
	 * Clean old metrics to prevent memory leaks
	 */
	private cleanOldMetrics(): void {
		const cutoffTime = new Date(Date.now() - this.metricsRetentionMs);

		// Clean endpoint recent requests
		for (const endpoint of Object.values(this.metrics.endpoints)) {
			endpoint.recentRequests = endpoint.recentRequests.filter((req) => req.timestamp > cutoffTime);
		}

		// Clean stale circuit breaker entries (remove those that haven't been used recently)
		const staleCircuitBreakers: string[] = [];
		for (const [url, cb] of Object.entries(this.metrics.circuitBreakers)) {
			const lastActivity = Math.max(
				cb.lastFailureTime?.getTime() || 0,
				cb.lastSuccessTime?.getTime() || 0,
				cb.openedTime?.getTime() || 0
			);

			// Remove circuit breakers that haven't had activity for longer than retention period
			// But keep OPEN circuit breakers regardless of age
			if (cb.state !== 'OPEN' && Date.now() - lastActivity > this.metricsRetentionMs) {
				staleCircuitBreakers.push(url);
			}
		}

		// Remove stale circuit breakers
		for (const url of staleCircuitBreakers) {
			delete this.metrics.circuitBreakers[url];
		}

		// Clean stale endpoints (remove those with no recent requests)
		const staleEndpoints: string[] = [];
		for (const [key, endpoint] of Object.entries(this.metrics.endpoints)) {
			if (
				endpoint.recentRequests.length === 0 &&
				Date.now() - endpoint.lastRequestTime.getTime() > this.metricsRetentionMs
			) {
				staleEndpoints.push(key);
			}
		}

		// Remove stale endpoints
		for (const key of staleEndpoints) {
			delete this.metrics.endpoints[key];
		}
	}
}

/**
 * Default metrics collector instance
 */
export const apiMetrics = new ApiMetricsCollector();
