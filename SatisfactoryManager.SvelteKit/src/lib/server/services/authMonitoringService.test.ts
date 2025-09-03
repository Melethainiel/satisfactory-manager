/**
 * Authentication Monitoring Service Tests
 *
 * Test suite for the authentication monitoring service including
 * alerts, health checks, metrics collection, and Prometheus integration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	startMonitoring,
	stopMonitoring,
	performHealthCheck,
	getAlerts,
	resolveAlert,
	getMonitoringStats,
	logMonitoringStatus,
	exportMetricsForPrometheus,
	resetMonitoringState,
	AlertSeverity,
	DEFAULT_MONITORING_THRESHOLDS,
	type MonitoringThresholds
} from './authMonitoringService.js';

// Mock the auth-enhanced module
vi.mock('../db/auth-enhanced.js', () => ({
	getAuthMetrics: vi.fn(() => ({
		totalTokenRequests: 100,
		successfulTokenRequests: 90,
		failedTokenRequests: 10,
		cacheHits: 80,
		cacheMisses: 20,
		averageTokenRequestDuration: 1500,
		lastTokenRequestDuration: 1200,
		proactiveRefreshCount: 5,
		fallbackToRefreshCount: 2
	})),
	getTokenHealth: vi.fn(() => ({
		isHealthy: true,
		isExpired: false,
		isExpiringSoon: false,
		timeToExpiry: 30 * 60 * 1000, // 30 minutes
		lastRefreshTime: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
		refreshCount: 3,
		errorCount: 0,
		lastError: undefined
	})),
	getAuthHealthCheck: vi.fn(() => ({
		status: 'healthy',
		details: {
			tokenHealth: {
				isHealthy: true,
				isExpired: false,
				isExpiringSoon: false,
				timeToExpiry: 30 * 60 * 1000,
				lastRefreshTime: new Date(),
				refreshCount: 3,
				errorCount: 0
			},
			metrics: {
				totalTokenRequests: 100,
				successfulTokenRequests: 90,
				failedTokenRequests: 10,
				cacheHits: 80,
				cacheMisses: 20,
				averageTokenRequestDuration: 1500,
				lastTokenRequestDuration: 1200,
				proactiveRefreshCount: 5,
				fallbackToRefreshCount: 2
			},
			uptime: 3600
		}
	})),
	logAuthStatus: vi.fn()
}));

import {
	getAuthMetrics,
	getTokenHealth,
	getAuthHealthCheck,
	logAuthStatus
} from '../db/auth-enhanced.js';

describe('Authentication Monitoring Service', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetMonitoringState();
		vi.clearAllTimers();
		vi.useFakeTimers();
	});

	afterEach(() => {
		stopMonitoring();
		resetMonitoringState();
		vi.useRealTimers();
	});

	describe('Health Check', () => {
		it('should perform basic health check', () => {
			const result = performHealthCheck();

			expect(result.status).toBe('healthy');
			expect(result.timestamp).toBeInstanceOf(Date);
			expect(result.metrics).toBeDefined();
			expect(result.health).toBeDefined();
			expect(Array.isArray(result.alerts)).toBe(true);
		});

		it('should detect high error rate', () => {
			vi.mocked(getAuthMetrics).mockReturnValue({
				totalTokenRequests: 100,
				successfulTokenRequests: 50, // 50% error rate
				failedTokenRequests: 50,
				cacheHits: 40,
				cacheMisses: 60,
				averageTokenRequestDuration: 1500,
				lastTokenRequestDuration: 1200,
				proactiveRefreshCount: 0,
				fallbackToRefreshCount: 0
			});

			const result = performHealthCheck();
			const errorRateAlert = result.alerts.find((a) =>
				a.title.includes('High Authentication Error Rate')
			);

			expect(errorRateAlert).toBeDefined();
			expect(errorRateAlert!.severity).toBe(AlertSeverity.ERROR);
		});

		it('should detect low cache hit rate', () => {
			vi.mocked(getAuthMetrics).mockReturnValue({
				totalTokenRequests: 100,
				successfulTokenRequests: 95,
				failedTokenRequests: 5,
				cacheHits: 10, // Low cache hit rate
				cacheMisses: 90,
				averageTokenRequestDuration: 1500,
				lastTokenRequestDuration: 1200,
				proactiveRefreshCount: 0,
				fallbackToRefreshCount: 0
			});

			const result = performHealthCheck();
			const cacheAlert = result.alerts.find((a) => a.title.includes('Low Cache Hit Rate'));

			expect(cacheAlert).toBeDefined();
			expect(cacheAlert!.severity).toBe(AlertSeverity.WARNING);
		});

		it('should detect high response time', () => {
			vi.mocked(getAuthMetrics).mockReturnValue({
				totalTokenRequests: 100,
				successfulTokenRequests: 95,
				failedTokenRequests: 5,
				cacheHits: 80,
				cacheMisses: 20,
				averageTokenRequestDuration: 8000, // High response time
				lastTokenRequestDuration: 7500,
				proactiveRefreshCount: 0,
				fallbackToRefreshCount: 0
			});

			const result = performHealthCheck();
			const responseTimeAlert = result.alerts.find((a) =>
				a.title.includes('High Authentication Response Time')
			);

			expect(responseTimeAlert).toBeDefined();
			expect(responseTimeAlert!.severity).toBe(AlertSeverity.WARNING);
		});

		it('should detect token expiring soon', () => {
			vi.mocked(getTokenHealth).mockReturnValue({
				isHealthy: true,
				isExpired: false,
				isExpiringSoon: true,
				timeToExpiry: 5 * 60 * 1000, // 5 minutes - less than threshold
				lastRefreshTime: new Date(),
				refreshCount: 3,
				errorCount: 0,
				lastError: undefined
			});

			const result = performHealthCheck();
			const expiryAlert = result.alerts.find((a) => a.title.includes('Token Expiring Soon'));

			expect(expiryAlert).toBeDefined();
			expect(expiryAlert!.severity).toBe(AlertSeverity.WARNING);
		});

		it('should detect unhealthy token', () => {
			vi.mocked(getTokenHealth).mockReturnValue({
				isHealthy: false,
				isExpired: true,
				isExpiringSoon: true,
				timeToExpiry: -60000, // Expired
				lastRefreshTime: new Date(),
				refreshCount: 3,
				errorCount: 5,
				lastError: 'Token validation failed'
			});

			vi.mocked(getAuthHealthCheck).mockReturnValue({
				status: 'unhealthy',
				details: {
					tokenHealth: null,
					metrics: {} as any,
					uptime: 3600
				}
			});

			const result = performHealthCheck();
			const healthAlert = result.alerts.find((a) => a.title.includes('Token Health Degraded'));

			expect(healthAlert).toBeDefined();
			expect(healthAlert!.severity).toBe(AlertSeverity.CRITICAL);
		});

		it('should detect no token available', () => {
			vi.mocked(getTokenHealth).mockReturnValue(null);

			const result = performHealthCheck();
			const noTokenAlert = result.alerts.find((a) => a.title.includes('No Authentication Token'));

			expect(noTokenAlert).toBeDefined();
			expect(noTokenAlert!.severity).toBe(AlertSeverity.CRITICAL);
		});

		it('should use custom thresholds', () => {
			const customThresholds: MonitoringThresholds = {
				...DEFAULT_MONITORING_THRESHOLDS,
				errorRateThreshold: 5 // Lower threshold
			};

			vi.mocked(getAuthMetrics).mockReturnValue({
				totalTokenRequests: 100,
				successfulTokenRequests: 92, // 8% error rate - above custom threshold
				failedTokenRequests: 8,
				cacheHits: 80,
				cacheMisses: 20,
				averageTokenRequestDuration: 1500,
				lastTokenRequestDuration: 1200,
				proactiveRefreshCount: 0,
				fallbackToRefreshCount: 0
			});

			const result = performHealthCheck(customThresholds);
			const errorRateAlert = result.alerts.find((a) =>
				a.title.includes('High Authentication Error Rate')
			);

			expect(errorRateAlert).toBeDefined();
		});
	});

	describe('Continuous Monitoring', () => {
		it('should start monitoring', () => {
			startMonitoring(1000); // 1 second interval

			const stats = getMonitoringStats();
			expect(stats.isMonitoring).toBe(true);
		});

		it('should stop monitoring', () => {
			startMonitoring(1000);
			expect(getMonitoringStats().isMonitoring).toBe(true);

			stopMonitoring();
			expect(getMonitoringStats().isMonitoring).toBe(false);
		});

		it('should not start monitoring twice', () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

			startMonitoring(1000);
			startMonitoring(1000); // Second call should be ignored

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('already running'));
			consoleSpy.mockRestore();
		});

		it('should perform periodic health checks', () => {
			startMonitoring(100); // 100ms interval

			// Fast-forward time
			vi.advanceTimersByTime(200);

			// Should have performed at least one health check
			const stats = getMonitoringStats();
			expect(stats.lastHealthCheck).not.toBeNull();
		});

		it('should handle monitoring errors gracefully', () => {
			vi.mocked(getAuthMetrics).mockImplementation(() => {
				throw new Error('Metrics error');
			});

			startMonitoring(100);
			vi.advanceTimersByTime(200);

			const alerts = getAlerts({ severity: AlertSeverity.ERROR });
			const errorAlert = alerts.find((a) => a.title.includes('Monitoring Error'));
			expect(errorAlert).toBeDefined();
		});
	});

	describe('Alert Management', () => {
		it('should create and retrieve alerts', () => {
			// Trigger a condition that creates alerts
			vi.mocked(getTokenHealth).mockReturnValue(null);
			performHealthCheck();

			const alerts = getAlerts();
			expect(alerts.length).toBeGreaterThan(0);

			const criticalAlert = alerts.find((a) => a.severity === AlertSeverity.CRITICAL);
			expect(criticalAlert).toBeDefined();
		});

		it('should filter alerts by severity', () => {
			performHealthCheck(); // Create some alerts

			const criticalAlerts = getAlerts({ severity: AlertSeverity.CRITICAL });
			const infoAlerts = getAlerts({ severity: AlertSeverity.INFO });

			expect(Array.isArray(criticalAlerts)).toBe(true);
			expect(Array.isArray(infoAlerts)).toBe(true);
		});

		it('should filter alerts by resolution status', () => {
			performHealthCheck();

			const unresolvedAlerts = getAlerts({ resolved: false });
			const resolvedAlerts = getAlerts({ resolved: true });

			expect(unresolvedAlerts.length).toBeGreaterThan(0);
			expect(resolvedAlerts.length).toBe(0); // No resolved alerts initially
		});

		it('should resolve alerts', () => {
			performHealthCheck();

			const alerts = getAlerts({ resolved: false });
			expect(alerts.length).toBeGreaterThan(0);

			const alertId = alerts[0].id;
			const resolved = resolveAlert(alertId);

			expect(resolved).toBe(true);

			const resolvedAlerts = getAlerts({ resolved: true });
			expect(resolvedAlerts.some((a) => a.id === alertId)).toBe(true);
		});

		it('should limit alert results', () => {
			performHealthCheck();

			const limitedAlerts = getAlerts({ limit: 2 });
			expect(limitedAlerts.length).toBeLessThanOrEqual(2);
		});

		it('should filter alerts by date', () => {
			const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

			performHealthCheck();

			const recentAlerts = getAlerts({ since: yesterday });
			expect(recentAlerts.length).toBeGreaterThan(0);

			const futureAlerts = getAlerts({ since: new Date(Date.now() + 60000) });
			expect(futureAlerts.length).toBe(0);
		});
	});

	describe('Monitoring Statistics', () => {
		it('should provide monitoring statistics', () => {
			startMonitoring(1000);
			performHealthCheck();

			const stats = getMonitoringStats();

			expect(stats.isMonitoring).toBe(true);
			expect(stats.totalAlerts).toBeGreaterThan(0);
			expect(stats.unresolvedAlerts).toBeGreaterThan(0);
			expect(stats.alertsBySeverity).toBeDefined();
			expect(stats.uptime).toBeGreaterThan(0);
		});

		it('should track alert counts by severity', () => {
			// Create alerts of different severities
			vi.mocked(getTokenHealth).mockReturnValue(null); // Critical alert
			performHealthCheck();

			const stats = getMonitoringStats();

			expect(stats.alertsBySeverity.critical).toBeGreaterThan(0);
			expect(stats.alertsBySeverity.info).toBeGreaterThan(0); // Monitoring started alert
		});
	});

	describe('Prometheus Metrics Export', () => {
		it('should export metrics in Prometheus format', () => {
			performHealthCheck(); // Generate some data

			const prometheusMetrics = exportMetricsForPrometheus();

			expect(prometheusMetrics).toContain('auth_token_requests_total');
			expect(prometheusMetrics).toContain('auth_token_requests_successful_total');
			expect(prometheusMetrics).toContain('auth_cache_hits_total');
			expect(prometheusMetrics).toContain('auth_token_healthy');
			expect(prometheusMetrics).toContain('auth_alerts_total');
		});

		it('should include token health metrics when available', () => {
			performHealthCheck();

			const prometheusMetrics = exportMetricsForPrometheus();

			expect(prometheusMetrics).toContain('auth_token_healthy 1'); // Healthy token
			expect(prometheusMetrics).toContain('auth_token_expired 0'); // Not expired
			expect(prometheusMetrics).toContain('auth_token_time_to_expiry_seconds');
		});

		it('should handle missing token health gracefully', () => {
			vi.mocked(getTokenHealth).mockReturnValue(null);
			performHealthCheck();

			const prometheusMetrics = exportMetricsForPrometheus();

			// Should not include token health metrics
			expect(prometheusMetrics).not.toContain('auth_token_healthy');
			expect(prometheusMetrics).toContain('auth_token_requests_total'); // But should include other metrics
		});

		it('should format metrics correctly', () => {
			performHealthCheck();

			const prometheusMetrics = exportMetricsForPrometheus();
			const lines = prometheusMetrics.split('\n');

			// Check for proper Prometheus format
			const helpLines = lines.filter((line) => line.startsWith('# HELP'));
			const typeLines = lines.filter((line) => line.startsWith('# TYPE'));
			const metricLines = lines.filter((line) => line && !line.startsWith('#'));

			expect(helpLines.length).toBeGreaterThan(0);
			expect(typeLines.length).toBeGreaterThan(0);
			expect(metricLines.length).toBeGreaterThan(0);
		});
	});

	describe('Logging and Status', () => {
		it('should log monitoring status without errors', () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

			startMonitoring(1000);
			performHealthCheck();
			logMonitoringStatus();

			expect(consoleSpy).toHaveBeenCalled();
			expect(logAuthStatus).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});
	});

	describe('State Management', () => {
		it('should reset monitoring state', () => {
			startMonitoring(1000);
			performHealthCheck(); // Create some alerts

			expect(getMonitoringStats().isMonitoring).toBe(true);
			expect(getMonitoringStats().totalAlerts).toBeGreaterThan(0);

			resetMonitoringState();

			const stats = getMonitoringStats();
			expect(stats.isMonitoring).toBe(false);
			expect(stats.totalAlerts).toBe(0);
			expect(stats.lastHealthCheck).toBeNull();
		});

		it('should maintain alert history limit', () => {
			// Create more than 100 alerts to test limit
			for (let i = 0; i < 105; i++) {
				performHealthCheck();
			}

			const stats = getMonitoringStats();
			expect(stats.totalAlerts).toBeLessThanOrEqual(100);
		});
	});

	describe('Alert Severity Handling', () => {
		it('should create different severity levels appropriately', () => {
			// Setup different conditions
			vi.mocked(getTokenHealth).mockReturnValue({
				isHealthy: false,
				isExpired: true,
				isExpiringSoon: true,
				timeToExpiry: -60000,
				lastRefreshTime: new Date(),
				refreshCount: 3,
				errorCount: 5,
				lastError: 'Multiple failures'
			});

			vi.mocked(getAuthMetrics).mockReturnValue({
				totalTokenRequests: 100,
				successfulTokenRequests: 50, // High error rate
				failedTokenRequests: 50,
				cacheHits: 10, // Low cache hit rate
				cacheMisses: 90,
				averageTokenRequestDuration: 8000, // High response time
				lastTokenRequestDuration: 7500,
				proactiveRefreshCount: 0,
				fallbackToRefreshCount: 0
			});

			performHealthCheck();

			const alerts = getAlerts();

			const criticalAlerts = alerts.filter((a) => a.severity === AlertSeverity.CRITICAL);
			const errorAlerts = alerts.filter((a) => a.severity === AlertSeverity.ERROR);
			const warningAlerts = alerts.filter((a) => a.severity === AlertSeverity.WARNING);

			expect(criticalAlerts.length).toBeGreaterThan(0);
			expect(errorAlerts.length).toBeGreaterThan(0);
			expect(warningAlerts.length).toBeGreaterThan(0);
		});
	});
});
