/**
 * Authentication Health Check API Endpoint
 *
 * Provides health status and metrics for the Azure authentication system.
 * Useful for monitoring systems, health checks, and debugging.
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import {
	performHealthCheck,
	getAlerts,
	getMonitoringStats,
	exportMetricsForPrometheus,
	AlertSeverity,
	type AuthAlert
} from '$lib/server/services/authMonitoringService.js';
import {
	getAuthHealthCheck,
	getAuthMetrics,
	getTokenHealth
} from '$lib/server/db/auth-enhanced.js';

/**
 * GET /api/auth/health
 *
 * Returns comprehensive authentication health information
 * Query parameters:
 * - format: 'json' (default) | 'prometheus' - Response format
 * - alerts: 'true' | 'false' (default) - Include recent alerts
 * - detailed: 'true' | 'false' (default) - Include detailed metrics
 */
export const GET: RequestHandler = async ({ url }) => {
	try {
		const format = url.searchParams.get('format') || 'json';
		const includeAlerts = url.searchParams.get('alerts') === 'true';
		const detailed = url.searchParams.get('detailed') === 'true';

		// Handle Prometheus metrics export
		if (format === 'prometheus') {
			const prometheusMetrics = exportMetricsForPrometheus();

			return new Response(prometheusMetrics, {
				headers: {
					'Content-Type': 'text/plain; version=0.0.4',
					'Cache-Control': 'no-cache, no-store, must-revalidate'
				}
			});
		}

		// Perform health check
		const healthCheck = performHealthCheck();
		const authHealthCheck = getAuthHealthCheck();
		const monitoringStats = getMonitoringStats();

		// Build response
		const response: any = {
			status: healthCheck.status,
			timestamp: healthCheck.timestamp,
			summary: {
				overall: authHealthCheck.status,
				tokenHealthy: healthCheck.health?.isHealthy || false,
				monitoring: monitoringStats.isMonitoring,
				uptime: authHealthCheck.details.uptime
			}
		};

		// Add detailed metrics if requested
		if (detailed) {
			response.metrics = {
				authentication: healthCheck.metrics,
				token: healthCheck.health,
				monitoring: monitoringStats
			};
		}

		// Add recent alerts if requested
		if (includeAlerts) {
			const recentAlerts = getAlerts({
				resolved: false,
				limit: 10
			});

			response.alerts = {
				recent: recentAlerts,
				summary: {
					total: monitoringStats.totalAlerts,
					unresolved: monitoringStats.unresolvedAlerts,
					bySeverity: monitoringStats.alertsBySeverity
				}
			};
		}

		// Set appropriate cache headers
		const headers: Record<string, string> = {
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Expires: '0'
		};

		// Add health status header for load balancers
		if (healthCheck.status === 'healthy') {
			headers['X-Health-Status'] = 'healthy';
		} else {
			headers['X-Health-Status'] = healthCheck.status;
		}

		return json(response, {
			status: healthCheck.status === 'unhealthy' ? 503 : 200,
			headers
		});
	} catch (error) {
		console.error('❌ Error in authentication health check endpoint:', error);

		return json(
			{
				status: 'error',
				timestamp: new Date(),
				error: {
					message: 'Health check failed',
					details: error instanceof Error ? error.message : 'Unknown error'
				}
			},
			{
				status: 500,
				headers: {
					'Cache-Control': 'no-cache, no-store, must-revalidate'
				}
			}
		);
	}
};

/**
 * POST /api/auth/health/alerts/:alertId/resolve
 *
 * Resolves a specific alert by ID
 */
export const POST: RequestHandler = async ({ request, url }) => {
	try {
		const body = await request.json();
		const action = body.action;

		if (action === 'resolve_alert' && body.alertId) {
			const { resolveAlert } = await import('$lib/server/services/authMonitoringService.js');
			const success = resolveAlert(body.alertId);

			if (success) {
				return json({
					success: true,
					message: 'Alert resolved successfully',
					alertId: body.alertId
				});
			} else {
				return json(
					{
						success: false,
						message: 'Alert not found or already resolved',
						alertId: body.alertId
					},
					{ status: 404 }
				);
			}
		}

		return json(
			{
				success: false,
				message: 'Invalid action or missing parameters'
			},
			{ status: 400 }
		);
	} catch (error) {
		console.error('❌ Error in authentication health check POST:', error);

		return json(
			{
				success: false,
				message: 'Failed to process request',
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
