/**
 * Enhanced Azure Authentication Tests
 *
 * Comprehensive test suite for the enhanced Azure authentication system
 * including token management, caching, monitoring, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { DefaultAzureCredential } from '@azure/identity';
import {
	getEnhancedAzurePostgreSQLToken,
	getEnhancedCachedAzureToken,
	createEnhancedAzureTokenProvider,
	getAuthMetrics,
	getTokenHealth,
	resetAuthMetrics,
	clearEnhancedTokenCache,
	logAuthStatus,
	getAuthHealthCheck,
	DEFAULT_ENHANCED_AUTH_CONFIG,
	type EnhancedPostgreSQLAuthConfig
} from './auth-enhanced.js';

// Mock Azure Identity
vi.mock('@azure/identity');

const mockDefaultAzureCredential = vi.mocked(DefaultAzureCredential);
const mockGetToken = vi.fn();

describe('Enhanced Azure Authentication', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetAuthMetrics();
		clearEnhancedTokenCache();

		// Setup default mock implementation
		mockDefaultAzureCredential.mockImplementation(
			() =>
				({
					getToken: mockGetToken
				}) as any
		);

		// Default successful token response
		mockGetToken.mockResolvedValue({
			token: 'mock-azure-token-12345',
			expiresOnTimestamp: Date.now() + 3600000 // 1 hour from now
		});
	});

	afterEach(() => {
		clearEnhancedTokenCache();
		resetAuthMetrics();
	});

	describe('Token Retrieval', () => {
		it('should successfully retrieve a new token', async () => {
			const token = await getEnhancedAzurePostgreSQLToken();

			expect(token).toBe('mock-azure-token-12345');
			expect(mockGetToken).toHaveBeenCalledWith([DEFAULT_ENHANCED_AUTH_CONFIG.scope]);
		});

		it('should use custom configuration', async () => {
			const customConfig: EnhancedPostgreSQLAuthConfig = {
				...DEFAULT_ENHANCED_AUTH_CONFIG,
				scope: 'custom-scope',
				tokenRefreshBufferMs: 10000
			};

			await getEnhancedAzurePostgreSQLToken(customConfig);

			expect(mockGetToken).toHaveBeenCalledWith(['custom-scope']);
		});

		it('should handle token request failures with retry', async () => {
			mockGetToken.mockRejectedValueOnce(new Error('Azure service unavailable'));
			mockGetToken.mockResolvedValueOnce({
				token: 'retry-success-token',
				expiresOnTimestamp: Date.now() + 3600000
			});

			const token = await getEnhancedAzurePostgreSQLToken();

			expect(token).toBe('retry-success-token');
			expect(mockGetToken).toHaveBeenCalledTimes(2);
		});

		it('should fail after max retry attempts', async () => {
			const error = new Error('Persistent Azure failure');
			mockGetToken.mockRejectedValue(error);

			await expect(getEnhancedAzurePostgreSQLToken()).rejects.toThrow(
				/Enhanced Azure authentication failed/
			);

			expect(mockGetToken).toHaveBeenCalledTimes(DEFAULT_ENHANCED_AUTH_CONFIG.maxRetryAttempts);
		});
	});

	describe('Token Caching', () => {
		it('should cache tokens and reuse them', async () => {
			// First request - should call Azure
			const token1 = await getEnhancedAzurePostgreSQLToken();
			expect(mockGetToken).toHaveBeenCalledTimes(1);

			// Second request - should use cache
			const token2 = await getEnhancedAzurePostgreSQLToken();
			expect(token2).toBe(token1);
			expect(mockGetToken).toHaveBeenCalledTimes(1);

			const metrics = getAuthMetrics();
			expect(metrics.cacheHits).toBe(1);
			expect(metrics.cacheMisses).toBe(1);
		});

		it('should refresh expired tokens', async () => {
			// Mock token that expires soon
			mockGetToken.mockResolvedValueOnce({
				token: 'expiring-token',
				expiresOnTimestamp: Date.now() + 1000 // Expires in 1 second
			});

			const token1 = await getEnhancedAzurePostgreSQLToken();
			expect(token1).toBe('expiring-token');

			// Wait for token to be considered "expiring soon"
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Mock new token
			mockGetToken.mockResolvedValueOnce({
				token: 'refreshed-token',
				expiresOnTimestamp: Date.now() + 3600000
			});

			const token2 = await getEnhancedAzurePostgreSQLToken();
			expect(token2).toBe('refreshed-token');
			expect(mockGetToken).toHaveBeenCalledTimes(2);
		});

		it('should force refresh when requested', async () => {
			const token1 = await getEnhancedAzurePostgreSQLToken();
			expect(mockGetToken).toHaveBeenCalledTimes(1);

			// Mock new token for force refresh
			mockGetToken.mockResolvedValueOnce({
				token: 'force-refreshed-token',
				expiresOnTimestamp: Date.now() + 3600000
			});

			const token2 = await getEnhancedAzurePostgreSQLToken(undefined, true);
			expect(token2).toBe('force-refreshed-token');
			expect(mockGetToken).toHaveBeenCalledTimes(2);
		});
	});

	describe('Token Health Validation', () => {
		it('should validate healthy tokens', async () => {
			await getEnhancedAzurePostgreSQLToken();

			const health = getTokenHealth();
			expect(health).not.toBeNull();
			expect(health!.isHealthy).toBe(true);
			expect(health!.isExpired).toBe(false);
			expect(health!.timeToExpiry).toBeGreaterThan(0);
		});

		it('should detect expired tokens', async () => {
			// Mock expired token
			mockGetToken.mockResolvedValueOnce({
				token: 'expired-token',
				expiresOnTimestamp: Date.now() - 1000 // Expired 1 second ago
			});

			await getEnhancedAzurePostgreSQLToken();

			const health = getTokenHealth();
			expect(health!.isExpired).toBe(true);
			expect(health!.isHealthy).toBe(false);
		});

		it('should track token errors', async () => {
			await getEnhancedAzurePostgreSQLToken();

			// Simulate token validation failure
			const health = getTokenHealth();
			const cache = health as any; // Access internal cache for testing

			// Force an error condition
			mockGetToken.mockRejectedValueOnce(new Error('Token validation failed'));

			try {
				await getEnhancedAzurePostgreSQLToken();
			} catch {
				// Expected to fail
			}

			const updatedHealth = getTokenHealth();
			expect(updatedHealth!.errorCount).toBeGreaterThan(0);
		});
	});

	describe('Cached Token Provider', () => {
		it('should provide cached tokens', async () => {
			const token = await getEnhancedCachedAzureToken();
			expect(token).toBe('mock-azure-token-12345');
		});

		it('should fall back to force refresh on cache failure', async () => {
			// First call succeeds
			await getEnhancedAzurePostgreSQLToken();

			// Mock cache failure followed by successful refresh
			mockGetToken.mockRejectedValueOnce(new Error('Cache token invalid'));
			mockGetToken.mockResolvedValueOnce({
				token: 'fallback-token',
				expiresOnTimestamp: Date.now() + 3600000
			});

			const token = await getEnhancedCachedAzureToken();
			expect(token).toBe('fallback-token');
		});

		it('should use recently expired token as last resort', async () => {
			// Create an expired but recent token
			mockGetToken.mockResolvedValueOnce({
				token: 'recently-expired-token',
				expiresOnTimestamp: Date.now() - 60000 // Expired 1 minute ago
			});

			await getEnhancedAzurePostgreSQLToken();

			// Mock all subsequent calls to fail
			mockGetToken.mockRejectedValue(new Error('Azure unavailable'));

			const token = await getEnhancedCachedAzureToken();
			expect(token).toBe('recently-expired-token');
		});
	});

	describe('Token Provider Function', () => {
		it('should create a working token provider', async () => {
			const provider = createEnhancedAzureTokenProvider();

			const token = await provider();
			expect(token).toBe('mock-azure-token-12345');
		});

		it('should use custom config in provider', async () => {
			const customConfig: EnhancedPostgreSQLAuthConfig = {
				...DEFAULT_ENHANCED_AUTH_CONFIG,
				scope: 'provider-custom-scope'
			};

			const provider = createEnhancedAzureTokenProvider(customConfig);
			await provider();

			expect(mockGetToken).toHaveBeenCalledWith(['provider-custom-scope']);
		});
	});

	describe('Metrics and Monitoring', () => {
		it('should track successful requests', async () => {
			await getEnhancedAzurePostgreSQLToken();
			await getEnhancedAzurePostgreSQLToken(); // Cache hit

			const metrics = getAuthMetrics();
			expect(metrics.totalTokenRequests).toBe(1); // Only one actual request to Azure
			expect(metrics.successfulTokenRequests).toBe(1);
			expect(metrics.failedTokenRequests).toBe(0);
			expect(metrics.cacheHits).toBe(1);
			expect(metrics.cacheMisses).toBe(1);
		});

		it('should track failed requests', async () => {
			mockGetToken.mockRejectedValue(new Error('Azure failure'));

			try {
				await getEnhancedAzurePostgreSQLToken();
			} catch {
				// Expected to fail
			}

			const metrics = getAuthMetrics();
			expect(metrics.failedTokenRequests).toBe(DEFAULT_ENHANCED_AUTH_CONFIG.maxRetryAttempts);
		});

		it('should track request durations', async () => {
			// Mock a slow request
			mockGetToken.mockImplementation(
				() =>
					new Promise((resolve) =>
						setTimeout(
							() =>
								resolve({
									token: 'slow-token',
									expiresOnTimestamp: Date.now() + 3600000
								}),
							100
						)
					)
			);

			await getEnhancedAzurePostgreSQLToken();

			const metrics = getAuthMetrics();
			expect(metrics.lastTokenRequestDuration).toBeGreaterThan(90);
			expect(metrics.averageTokenRequestDuration).toBeGreaterThan(90);
		});

		it('should reset metrics', () => {
			// Generate some metrics
			getAuthMetrics();

			resetAuthMetrics();

			const metrics = getAuthMetrics();
			expect(metrics.totalTokenRequests).toBe(0);
			expect(metrics.cacheHits).toBe(0);
		});
	});

	describe('Health Check', () => {
		it('should provide comprehensive health status', async () => {
			await getEnhancedAzurePostgreSQLToken();

			const healthCheck = getAuthHealthCheck();

			expect(healthCheck.status).toBe('healthy');
			expect(healthCheck.details.tokenHealth).not.toBeNull();
			expect(healthCheck.details.metrics).toBeDefined();
			expect(healthCheck.details.uptime).toBeGreaterThan(0);
		});

		it('should detect unhealthy state', async () => {
			// Mock expired token
			mockGetToken.mockResolvedValueOnce({
				token: 'expired-token',
				expiresOnTimestamp: Date.now() - 1000
			});

			await getEnhancedAzurePostgreSQLToken();

			const healthCheck = getAuthHealthCheck();
			expect(healthCheck.status).toBe('unhealthy');
		});

		it('should detect degraded state', async () => {
			await getEnhancedAzurePostgreSQLToken();

			// Simulate some errors without making token completely unhealthy
			const health = getTokenHealth();
			if (health) {
				(health as any).errorCount = 1; // Simulate some errors
			}

			const healthCheck = getAuthHealthCheck();
			expect(healthCheck.status).toBe('degraded');
		});
	});

	describe('Logging and Status', () => {
		it('should log auth status without errors', async () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

			await getEnhancedAzurePostgreSQLToken();
			logAuthStatus();

			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});

	describe('Error Handling', () => {
		it('should handle invalid token responses', async () => {
			mockGetToken.mockResolvedValue(null as any);

			await expect(getEnhancedAzurePostgreSQLToken()).rejects.toThrow();
		});

		it('should handle empty token responses', async () => {
			mockGetToken.mockResolvedValue({
				token: '',
				expiresOnTimestamp: Date.now() + 3600000
			});

			await expect(getEnhancedAzurePostgreSQLToken()).rejects.toThrow();
		});

		it('should handle credential instantiation failures', async () => {
			mockDefaultAzureCredential.mockImplementation(() => {
				throw new Error('Credential creation failed');
			});

			await expect(getEnhancedAzurePostgreSQLToken()).rejects.toThrow(
				/Enhanced Azure authentication failed/
			);
		});
	});

	describe('Configuration Validation', () => {
		it('should work with minimal config', async () => {
			const minimalConfig: Partial<EnhancedPostgreSQLAuthConfig> = {
				scope: 'minimal-scope'
			};

			await getEnhancedAzurePostgreSQLToken({
				...DEFAULT_ENHANCED_AUTH_CONFIG,
				...minimalConfig
			});

			expect(mockGetToken).toHaveBeenCalledWith(['minimal-scope']);
		});

		it('should respect retry configuration', async () => {
			const customConfig: EnhancedPostgreSQLAuthConfig = {
				...DEFAULT_ENHANCED_AUTH_CONFIG,
				maxRetryAttempts: 1
			};

			mockGetToken.mockRejectedValue(new Error('Always fails'));

			await expect(getEnhancedAzurePostgreSQLToken(customConfig)).rejects.toThrow();

			expect(mockGetToken).toHaveBeenCalledTimes(1);
		});
	});

	describe('Cache Management', () => {
		it('should clear cache properly', async () => {
			await getEnhancedAzurePostgreSQLToken();
			expect(getTokenHealth()).not.toBeNull();

			clearEnhancedTokenCache();
			expect(getTokenHealth()).toBeNull();
		});

		it('should handle concurrent token requests', async () => {
			// Start multiple concurrent requests
			const promises = [
				getEnhancedAzurePostgreSQLToken(),
				getEnhancedAzurePostgreSQLToken(),
				getEnhancedAzurePostgreSQLToken()
			];

			const tokens = await Promise.all(promises);

			// All should return the same token
			expect(tokens[0]).toBe(tokens[1]);
			expect(tokens[1]).toBe(tokens[2]);

			// But only one should have hit Azure (others should be cache hits)
			const metrics = getAuthMetrics();
			expect(metrics.cacheHits).toBeGreaterThan(0);
		});
	});
});
