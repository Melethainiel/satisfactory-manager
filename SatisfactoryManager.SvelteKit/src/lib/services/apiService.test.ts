/**
 * Comprehensive API Service Test Suite
 *
 * Tests for enhanced API service including retry logic, circuit breaker,
 * error handling, metrics collection, and logging functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { apiService } from './apiService';
import { notificationService } from './notificationService.svelte';
import { apiMetrics } from './apiMetrics';
import { getApiLogger } from './apiLogger';
import {
	NetworkError,
	AuthenticationError,
	ValidationError,
	ServerError,
	TimeoutError,
	RateLimitError,
	CircuitBreakerError,
	ErrorCategory
} from '$lib/types/apiErrors';
import { TEST_API_CONFIG } from '$lib/config/apiConfig';

// Mock dependencies
vi.mock('./notificationService.svelte', () => ({
	notificationService: {
		error: vi.fn(),
		success: vi.fn(),
		warn: vi.fn(),
		info: vi.fn()
	}
}));

vi.mock('./apiLogger', () => ({
	getApiLogger: vi.fn(() => ({
		logRequestStart: vi.fn(),
		logRequestSuccess: vi.fn(),
		logRequestRetry: vi.fn(),
		logRequestFailure: vi.fn(),
		logCircuitBreakerStateChange: vi.fn(),
		updateConfig: vi.fn()
	})),
	initializeApiLogger: vi.fn()
}));

vi.mock('./apiMetrics', () => ({
	apiMetrics: {
		recordRequest: vi.fn(),
		recordCircuitBreakerStateChange: vi.fn(),
		recordCircuitBreakerRequest: vi.fn(),
		getOverallMetrics: vi.fn(() => ({
			totalRequests: 10,
			successfulRequests: 8,
			failedRequests: 2,
			averageResponseTime: 250
		})),
		getHealthCheck: vi.fn(() => ({
			status: 'healthy',
			checks: { successRate: { status: 'healthy', message: 'Success rate good: 95%' } }
		}))
	}
}));

// Mock fetch responses
interface MockResponse {
	ok: boolean;
	status: number;
	statusText: string;
	json: () => Promise<any>;
	text: () => Promise<string>;
	headers: Map<string, string>;
}

function createMockResponse(
	status: number,
	statusText: string,
	data?: any,
	headers?: Record<string, string>
): MockResponse {
	const headerMap = new Map();
	if (headers) {
		Object.entries(headers).forEach(([key, value]) => headerMap.set(key, value));
	}

	return {
		ok: status >= 200 && status < 300,
		status,
		statusText,
		json: vi.fn().mockResolvedValue(data),
		text: vi.fn().mockResolvedValue(data ? JSON.stringify(data) : ''),
		headers: {
			get: (key: string) => headerMap.get(key) || null
		} as any
	} as MockResponse;
}

describe('Enhanced API Service', () => {
	let mockApiFetch: MockedFunction<any>;
	let mockLogger: any;

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks();

		// Configure API service for testing
		apiService.configure(TEST_API_CONFIG);

		// Setup mock fetch function
		mockApiFetch = vi.fn();
		apiService.setApiFetch(mockApiFetch);

		// Setup mock logger
		mockLogger = {
			logRequestStart: vi.fn(),
			logRequestSuccess: vi.fn(),
			logRequestRetry: vi.fn(),
			logRequestFailure: vi.fn(),
			logCircuitBreakerStateChange: vi.fn(),
			updateConfig: vi.fn()
		};
		(getApiLogger as MockedFunction<any>).mockReturnValue(mockLogger);
	});

	afterEach(() => {
		// Reset metrics after each test
		vi.clearAllMocks();
	});

	describe('Basic API Operations', () => {
		it('should make successful GET request', async () => {
			const mockData = { id: 1, name: 'Test' };
			mockApiFetch.mockResolvedValue(createMockResponse(200, 'OK', mockData));

			const result = await apiService.get('/test');

			expect(result).toEqual(mockData);
			expect(mockApiFetch).toHaveBeenCalledWith(
				'/test',
				expect.objectContaining({
					method: 'GET',
					autoJson: false,
					signal: expect.any(AbortSignal)
				})
			);
			expect(mockLogger.logRequestStart).toHaveBeenCalledWith('/test', 'GET', expect.any(Object));
			expect(mockLogger.logRequestSuccess).toHaveBeenCalled();
		});

		it('should make successful POST request with data', async () => {
			const requestData = { name: 'New Item' };
			const responseData = { id: 2, ...requestData };
			mockApiFetch.mockResolvedValue(createMockResponse(201, 'Created', responseData));

			const result = await apiService.post('/items', requestData);

			expect(result).toEqual(responseData);
			expect(mockApiFetch).toHaveBeenCalledWith(
				'/items',
				expect.objectContaining({
					method: 'POST',
					body: JSON.stringify(requestData),
					headers: expect.objectContaining({
						'Content-Type': 'application/json'
					})
				})
			);
		});
	});

	describe('Error Handling', () => {
		it('should handle 404 Not Found error', async () => {
			mockApiFetch.mockResolvedValue(createMockResponse(404, 'Not Found'));

			await expect(apiService.get('/nonexistent')).rejects.toThrow();
			expect(mockLogger.logRequestFailure).toHaveBeenCalled();
			expect(notificationService.error).toHaveBeenCalled();
		});

		it('should handle 401 Authentication error', async () => {
			mockApiFetch.mockResolvedValue(createMockResponse(401, 'Unauthorized'));

			await expect(apiService.get('/protected')).rejects.toThrow(AuthenticationError);
		});

		it('should handle 500 Server error', async () => {
			mockApiFetch.mockResolvedValue(createMockResponse(500, 'Internal Server Error'));

			await expect(apiService.get('/server-error')).rejects.toThrow(ServerError);
		});

		it('should handle 429 Rate Limit error with Retry-After header', async () => {
			mockApiFetch.mockResolvedValue(
				createMockResponse(429, 'Too Many Requests', undefined, { 'Retry-After': '60' })
			);

			await expect(apiService.get('/rate-limited')).rejects.toThrow(RateLimitError);
		});

		it('should handle network errors', async () => {
			mockApiFetch.mockRejectedValue(new Error('Network error'));

			await expect(apiService.get('/network-fail')).rejects.toThrow(NetworkError);
		});

		it('should suppress error notifications when showErrorNotification is false', async () => {
			mockApiFetch.mockResolvedValue(createMockResponse(500, 'Server Error'));

			await expect(apiService.get('/error', { showErrorNotification: false })).rejects.toThrow();
			expect(notificationService.error).not.toHaveBeenCalled();
		});
	});

	describe('Retry Logic', () => {
		it('should retry on retryable errors', async () => {
			mockApiFetch
				.mockResolvedValueOnce(createMockResponse(502, 'Bad Gateway'))
				.mockResolvedValueOnce(createMockResponse(503, 'Service Unavailable'))
				.mockResolvedValue(createMockResponse(200, 'OK', { success: true }));

			const result = await apiService.get('/retry-test');

			expect(result).toEqual({ success: true });
			expect(mockApiFetch).toHaveBeenCalledTimes(3);
			expect(mockLogger.logRequestRetry).toHaveBeenCalledTimes(2);
		});

		it('should not retry on non-retryable errors', async () => {
			mockApiFetch.mockResolvedValue(createMockResponse(401, 'Unauthorized'));

			await expect(apiService.get('/no-retry')).rejects.toThrow();
			expect(mockApiFetch).toHaveBeenCalledTimes(1);
			expect(mockLogger.logRequestRetry).not.toHaveBeenCalled();
		});

		it('should fail after max retry attempts', async () => {
			mockApiFetch.mockResolvedValue(createMockResponse(502, 'Bad Gateway'));

			await expect(apiService.get('/max-retries')).rejects.toThrow();
			expect(mockApiFetch).toHaveBeenCalledTimes(TEST_API_CONFIG.retry.maxAttempts);
		});
	});

	describe('Metrics Collection', () => {
		it('should record successful request metrics', async () => {
			mockApiFetch.mockResolvedValue(createMockResponse(200, 'OK', { data: 'test' }));

			await apiService.get('/metrics-test');

			expect(apiMetrics.recordRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					url: '/metrics-test',
					method: 'GET',
					success: true,
					duration: expect.any(Number),
					timestamp: expect.any(Date),
					attempt: 1
				})
			);
		});

		it('should provide metrics endpoint', () => {
			const metrics = apiService.getMetrics();

			expect(metrics).toEqual({
				totalRequests: 10,
				successfulRequests: 8,
				failedRequests: 2,
				averageResponseTime: 250
			});
			expect(apiMetrics.getOverallMetrics).toHaveBeenCalled();
		});

		it('should provide health check endpoint', () => {
			const health = apiService.getHealth();

			expect(health).toEqual({
				status: 'healthy',
				checks: { successRate: { status: 'healthy', message: 'Success rate good: 95%' } }
			});
			expect(apiMetrics.getHealthCheck).toHaveBeenCalled();
		});
	});
});
