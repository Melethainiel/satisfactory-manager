/**
 * Authentication Monitoring Service
 *
 * This service provides comprehensive monitoring capabilities for Azure authentication,
 * including metrics collection, alerting, and health reporting.
 */

import {
	getAuthMetrics,
	getTokenHealth,
	logAuthStatus,
	getAuthHealthCheck,
	type AuthMetrics,
	type TokenHealth
} from '../db/auth-enhanced.js';

/**
 * Alert severity levels
 */
export enum AlertSeverity {
	INFO = 'info',
	WARNING = 'warning',
	ERROR = 'error',
	CRITICAL = 'critical'
}

/**
 * Alert interface
 */
export interface AuthAlert {
	id: string;
	timestamp: Date;
	severity: AlertSeverity;
	title: string;
	message: string;
	details?: any;
	resolved?: boolean;
	resolvedAt?: Date;
}

/**
 * Monitoring thresholds configuration
 */
export interface MonitoringThresholds {
	errorRateThreshold: number; // Percentage (0-100)
	cacheHitRateThreshold: number; // Percentage (0-100)
	averageResponseTimeThreshold: number; // Milliseconds
	tokenExpiryWarningThreshold: number; // Minutes
	consecutiveFailuresThreshold: number;
}

/**
 * Default monitoring thresholds
 */
export const DEFAULT_MONITORING_THRESHOLDS: MonitoringThresholds = {
	errorRateThreshold: 10, // Alert if error rate > 10%
	cacheHitRateThreshold: 80, // Alert if cache hit rate < 80%
	averageResponseTimeThreshold: 5000, // Alert if avg response time > 5 seconds
	tokenExpiryWarningThreshold: 15, // Warn when token expires in < 15 minutes
	consecutiveFailuresThreshold: 3 // Alert after 3 consecutive failures
};

/**
 * Monitoring state
 */
interface MonitoringState {
	alerts: AuthAlert[];
	lastHealthCheck: Date | null;
	consecutiveFailures: number;
	isMonitoring: boolean;
	monitoringInterval?: NodeJS.Timeout;
}

/**
 * Global monitoring state
 */
let monitoringState: MonitoringState = {
	alerts: [],
	lastHealthCheck: null,
	consecutiveFailures: 0,
	isMonitoring: false
};

/**
 * Generates a unique alert ID
 */
function generateAlertId(): string {
	return `auth_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Creates a new alert
 */
function createAlert(
	severity: AlertSeverity,
	title: string,
	message: string,
	details?: any
): AuthAlert {
	const alert: AuthAlert = {
		id: generateAlertId(),
		timestamp: new Date(),
		severity,
		title,
		message,
		details,
		resolved: false
	};

	monitoringState.alerts.push(alert);

	// Keep only the last 100 alerts to prevent memory growth
	if (monitoringState.alerts.length > 100) {
		monitoringState.alerts = monitoringState.alerts.slice(-100);
	}

	// Log alert
	const severityEmoji = {
		[AlertSeverity.INFO]: 'ℹ️',
		[AlertSeverity.WARNING]: '⚠️',
		[AlertSeverity.ERROR]: '❌',
		[AlertSeverity.CRITICAL]: '🚨'
	};

	console.log(
		`${severityEmoji[severity]} Auth Alert [${severity.toUpperCase()}]: ${title} - ${message}`
	);

	if (details) {
		console.log('   Details:', JSON.stringify(details, null, 2));
	}

	return alert;
}

/**
 * Resolves an alert
 */
export function resolveAlert(alertId: string): boolean {
	const alert = monitoringState.alerts.find((a) => a.id === alertId);
	if (alert && !alert.resolved) {
		alert.resolved = true;
		alert.resolvedAt = new Date();
		console.log(`✅ Auth alert resolved: ${alert.title}`);
		return true;
	}
	return false;
}

/**
 * Analyzes authentication metrics and generates alerts
 */
function analyzeMetrics(
	metrics: AuthMetrics,
	health: TokenHealth | null,
	thresholds: MonitoringThresholds = DEFAULT_MONITORING_THRESHOLDS
): void {
	// Check error rate
	if (metrics.totalTokenRequests > 0) {
		const errorRate = (metrics.failedTokenRequests / metrics.totalTokenRequests) * 100;
		if (errorRate > thresholds.errorRateThreshold) {
			createAlert(
				AlertSeverity.ERROR,
				'High Authentication Error Rate',
				`Authentication error rate is ${errorRate.toFixed(1)}% (threshold: ${thresholds.errorRateThreshold}%)`,
				{ errorRate, threshold: thresholds.errorRateThreshold, metrics }
			);
		}
	}

	// Check cache hit rate
	const totalCacheRequests = metrics.cacheHits + metrics.cacheMisses;
	if (totalCacheRequests > 0) {
		const cacheHitRate = (metrics.cacheHits / totalCacheRequests) * 100;
		if (cacheHitRate < thresholds.cacheHitRateThreshold) {
			createAlert(
				AlertSeverity.WARNING,
				'Low Cache Hit Rate',
				`Token cache hit rate is ${cacheHitRate.toFixed(1)}% (threshold: ${thresholds.cacheHitRateThreshold}%)`,
				{ cacheHitRate, threshold: thresholds.cacheHitRateThreshold, metrics }
			);
		}
	}

	// Check average response time
	if (metrics.averageTokenRequestDuration > thresholds.averageResponseTimeThreshold) {
		createAlert(
			AlertSeverity.WARNING,
			'High Authentication Response Time',
			`Average token request duration is ${metrics.averageTokenRequestDuration}ms (threshold: ${thresholds.averageResponseTimeThreshold}ms)`,
			{
				averageResponseTime: metrics.averageTokenRequestDuration,
				threshold: thresholds.averageResponseTimeThreshold
			}
		);
	}

	// Check token health
	if (health) {
		// Token expiry warning
		const timeToExpiryMinutes = health.timeToExpiry / (60 * 1000);
		if (timeToExpiryMinutes > 0 && timeToExpiryMinutes < thresholds.tokenExpiryWarningThreshold) {
			createAlert(
				AlertSeverity.WARNING,
				'Token Expiring Soon',
				`Authentication token expires in ${Math.round(timeToExpiryMinutes)} minutes (threshold: ${thresholds.tokenExpiryWarningThreshold} minutes)`,
				{ timeToExpiryMinutes, threshold: thresholds.tokenExpiryWarningThreshold, health }
			);
		}

		// Token health degradation
		if (!health.isHealthy) {
			const severity = health.isExpired ? AlertSeverity.CRITICAL : AlertSeverity.ERROR;
			createAlert(
				severity,
				'Token Health Degraded',
				`Authentication token health is degraded (expired: ${health.isExpired}, errors: ${health.errorCount})`,
				{ health }
			);
		}

		// Consecutive errors
		if (health.errorCount >= thresholds.consecutiveFailuresThreshold) {
			createAlert(
				AlertSeverity.ERROR,
				'Consecutive Authentication Failures',
				`Token has ${health.errorCount} consecutive errors (threshold: ${thresholds.consecutiveFailuresThreshold})`,
				{
					errorCount: health.errorCount,
					threshold: thresholds.consecutiveFailuresThreshold,
					health
				}
			);
		}
	} else {
		// No token available
		createAlert(
			AlertSeverity.CRITICAL,
			'No Authentication Token',
			'No authentication token is available',
			null
		);
	}
}

/**
 * Performs a comprehensive health check
 */
export function performHealthCheck(
	thresholds: MonitoringThresholds = DEFAULT_MONITORING_THRESHOLDS
): {
	status: 'healthy' | 'degraded' | 'unhealthy';
	timestamp: Date;
	metrics: AuthMetrics;
	health: TokenHealth | null;
	alerts: AuthAlert[];
} {
	const timestamp = new Date();
	const metrics = getAuthMetrics();
	const health = getTokenHealth();

	// Update monitoring state
	monitoringState.lastHealthCheck = timestamp;

	// Analyze metrics and generate alerts
	analyzeMetrics(metrics, health, thresholds);

	// Get current health status
	const healthCheck = getAuthHealthCheck();

	// Reset consecutive failures if we're healthy
	if (healthCheck.status === 'healthy') {
		monitoringState.consecutiveFailures = 0;
	} else {
		monitoringState.consecutiveFailures++;
	}

	// Get recent unresolved alerts
	const recentAlerts = monitoringState.alerts.filter((alert) => !alert.resolved).slice(-10); // Last 10 unresolved alerts

	return {
		status: healthCheck.status,
		timestamp,
		metrics,
		health,
		alerts: recentAlerts
	};
}

/**
 * Starts continuous monitoring
 */
export function startMonitoring(
	intervalMs: number = 5 * 60 * 1000, // 5 minutes
	thresholds: MonitoringThresholds = DEFAULT_MONITORING_THRESHOLDS
): void {
	if (monitoringState.isMonitoring) {
		console.log('🔍 Authentication monitoring is already running');
		return;
	}

	console.log(`🔍 Starting authentication monitoring (interval: ${intervalMs / 1000}s)`);

	monitoringState.isMonitoring = true;

	// Perform initial health check
	performHealthCheck(thresholds);

	// Set up periodic monitoring
	monitoringState.monitoringInterval = setInterval(() => {
		try {
			const healthCheckResult = performHealthCheck(thresholds);

			// Log summary every monitoring cycle
			console.log(
				`🔍 Auth monitoring check: ${healthCheckResult.status} (alerts: ${healthCheckResult.alerts.length})`
			);
		} catch (error) {
			console.error('❌ Error during authentication monitoring:', error);
			createAlert(
				AlertSeverity.ERROR,
				'Monitoring Error',
				`Error occurred during monitoring: ${error instanceof Error ? error.message : 'Unknown error'}`,
				{ error: error instanceof Error ? error.stack : error }
			);
		}
	}, intervalMs);

	createAlert(
		AlertSeverity.INFO,
		'Monitoring Started',
		`Authentication monitoring started with ${intervalMs / 1000}s interval`,
		{ intervalMs, thresholds }
	);
}

/**
 * Stops continuous monitoring
 */
export function stopMonitoring(): void {
	if (!monitoringState.isMonitoring) {
		console.log('🔍 Authentication monitoring is not running');
		return;
	}

	console.log('🔍 Stopping authentication monitoring');

	if (monitoringState.monitoringInterval) {
		clearInterval(monitoringState.monitoringInterval);
		monitoringState.monitoringInterval = undefined;
	}

	monitoringState.isMonitoring = false;

	createAlert(
		AlertSeverity.INFO,
		'Monitoring Stopped',
		'Authentication monitoring has been stopped',
		null
	);
}

/**
 * Gets all alerts with optional filtering
 */
export function getAlerts(
	filter: {
		severity?: AlertSeverity;
		resolved?: boolean;
		since?: Date;
		limit?: number;
	} = {}
): AuthAlert[] {
	let alerts = [...monitoringState.alerts];

	if (filter.severity) {
		alerts = alerts.filter((alert) => alert.severity === filter.severity);
	}

	if (filter.resolved !== undefined) {
		alerts = alerts.filter((alert) => alert.resolved === filter.resolved);
	}

	if (filter.since) {
		alerts = alerts.filter((alert) => alert.timestamp >= filter.since!);
	}

	// Sort by timestamp (newest first)
	alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

	if (filter.limit) {
		alerts = alerts.slice(0, filter.limit);
	}

	return alerts;
}

/**
 * Gets monitoring statistics
 */
export function getMonitoringStats(): {
	isMonitoring: boolean;
	lastHealthCheck: Date | null;
	consecutiveFailures: number;
	totalAlerts: number;
	unresolvedAlerts: number;
	alertsBySeverity: Record<AlertSeverity, number>;
	uptime: number;
} {
	const alertsBySeverity = {
		[AlertSeverity.INFO]: 0,
		[AlertSeverity.WARNING]: 0,
		[AlertSeverity.ERROR]: 0,
		[AlertSeverity.CRITICAL]: 0
	};

	monitoringState.alerts.forEach((alert) => {
		alertsBySeverity[alert.severity]++;
	});

	return {
		isMonitoring: monitoringState.isMonitoring,
		lastHealthCheck: monitoringState.lastHealthCheck,
		consecutiveFailures: monitoringState.consecutiveFailures,
		totalAlerts: monitoringState.alerts.length,
		unresolvedAlerts: monitoringState.alerts.filter((a) => !a.resolved).length,
		alertsBySeverity,
		uptime: process.uptime()
	};
}

/**
 * Logs comprehensive monitoring status
 */
export function logMonitoringStatus(): void {
	const stats = getMonitoringStats();
	const healthCheck = performHealthCheck();

	console.log('\n📊 === Authentication Monitoring Status ===');
	console.log(`Status: ${monitoringState.isMonitoring ? '✅ Active' : '❌ Inactive'}`);
	console.log(`Last Health Check: ${stats.lastHealthCheck?.toISOString() || 'Never'}`);
	console.log(`Auth Health: ${healthCheck.status}`);
	console.log(`Consecutive Failures: ${stats.consecutiveFailures}`);
	console.log(`Uptime: ${Math.round(stats.uptime / 3600)} hours`);

	console.log('\n📈 Alerts Summary:');
	console.log(`  Total: ${stats.totalAlerts}`);
	console.log(`  Unresolved: ${stats.unresolvedAlerts}`);
	console.log(`  By Severity:`);
	console.log(`    🚨 Critical: ${stats.alertsBySeverity.critical}`);
	console.log(`    ❌ Error: ${stats.alertsBySeverity.error}`);
	console.log(`    ⚠️  Warning: ${stats.alertsBySeverity.warning}`);
	console.log(`    ℹ️  Info: ${stats.alertsBySeverity.info}`);

	// Show token status
	logAuthStatus();

	console.log('============================================\n');
}

/**
 * Exports monitoring data for external systems (Prometheus, etc.)
 */
export function exportMetricsForPrometheus(): string {
	const metrics = getAuthMetrics();
	const health = getTokenHealth();
	const stats = getMonitoringStats();

	const lines: string[] = [];

	// Authentication metrics
	lines.push(`# HELP auth_token_requests_total Total number of token requests`);
	lines.push(`# TYPE auth_token_requests_total counter`);
	lines.push(`auth_token_requests_total ${metrics.totalTokenRequests}`);

	lines.push(`# HELP auth_token_requests_successful_total Successful token requests`);
	lines.push(`# TYPE auth_token_requests_successful_total counter`);
	lines.push(`auth_token_requests_successful_total ${metrics.successfulTokenRequests}`);

	lines.push(`# HELP auth_token_requests_failed_total Failed token requests`);
	lines.push(`# TYPE auth_token_requests_failed_total counter`);
	lines.push(`auth_token_requests_failed_total ${metrics.failedTokenRequests}`);

	lines.push(`# HELP auth_cache_hits_total Cache hit count`);
	lines.push(`# TYPE auth_cache_hits_total counter`);
	lines.push(`auth_cache_hits_total ${metrics.cacheHits}`);

	lines.push(`# HELP auth_cache_misses_total Cache miss count`);
	lines.push(`# TYPE auth_cache_misses_total counter`);
	lines.push(`auth_cache_misses_total ${metrics.cacheMisses}`);

	lines.push(`# HELP auth_request_duration_average_ms Average request duration in milliseconds`);
	lines.push(`# TYPE auth_request_duration_average_ms gauge`);
	lines.push(`auth_request_duration_average_ms ${metrics.averageTokenRequestDuration}`);

	// Token health metrics
	if (health) {
		lines.push(`# HELP auth_token_healthy Token health status (1 = healthy, 0 = unhealthy)`);
		lines.push(`# TYPE auth_token_healthy gauge`);
		lines.push(`auth_token_healthy ${health.isHealthy ? 1 : 0}`);

		lines.push(`# HELP auth_token_expired Token expiration status (1 = expired, 0 = valid)`);
		lines.push(`# TYPE auth_token_expired gauge`);
		lines.push(`auth_token_expired ${health.isExpired ? 1 : 0}`);

		lines.push(`# HELP auth_token_time_to_expiry_seconds Time until token expires in seconds`);
		lines.push(`# TYPE auth_token_time_to_expiry_seconds gauge`);
		lines.push(
			`auth_token_time_to_expiry_seconds ${Math.max(0, Math.round(health.timeToExpiry / 1000))}`
		);
	}

	// Alert metrics
	lines.push(`# HELP auth_alerts_total Total number of alerts`);
	lines.push(`# TYPE auth_alerts_total counter`);
	lines.push(`auth_alerts_total ${stats.totalAlerts}`);

	lines.push(`# HELP auth_alerts_unresolved Current unresolved alerts`);
	lines.push(`# TYPE auth_alerts_unresolved gauge`);
	lines.push(`auth_alerts_unresolved ${stats.unresolvedAlerts}`);

	return lines.join('\n') + '\n';
}

/**
 * Resets monitoring state (useful for testing)
 */
export function resetMonitoringState(): void {
	stopMonitoring();
	monitoringState = {
		alerts: [],
		lastHealthCheck: null,
		consecutiveFailures: 0,
		isMonitoring: false
	};
	console.log('🧹 Monitoring state reset');
}
