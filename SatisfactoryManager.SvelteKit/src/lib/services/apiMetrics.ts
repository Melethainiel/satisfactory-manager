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
 * API Metrics Collector
 */
export class ApiMetricsCollector {
	private metrics: OverallMetrics;
	private readonly maxRecentRequests: number = 100; // Keep last 100 requests per endpoint
	private readonly metricsRetentionMs: number = 60 * 60 * 1000; // 1 hour

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

		// Clean old metrics periodically
		if (this.metrics.totalRequests % 100 === 0) {
			this.cleanOldMetrics();
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

		// Check circuit breaker states
		const openCircuits = Object.values(this.metrics.circuitBreakers).filter(
			(cb) => cb.state === 'OPEN'
		);

		if (openCircuits.length > 0) {
			if (overallStatus === 'healthy') overallStatus = 'degraded';
			checks.circuitBreakers = {
				status: 'degraded',
				message: `${openCircuits.length} circuit breaker(s) open`
			};
		} else {
			checks.circuitBreakers = {
				status: 'healthy',
				message: 'All circuit breakers closed'
			};
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
	 * Reset all metrics
	 */
	reset(): void {
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
	 * Clean old metrics to prevent memory leaks
	 */
	private cleanOldMetrics(): void {
		const cutoffTime = new Date(Date.now() - this.metricsRetentionMs);

		for (const endpoint of Object.values(this.metrics.endpoints)) {
			endpoint.recentRequests = endpoint.recentRequests.filter((req) => req.timestamp > cutoffTime);
		}
	}
}

/**
 * Default metrics collector instance
 */
export const apiMetrics = new ApiMetricsCollector();
