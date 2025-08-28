import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { gameDashboardService } from '$lib/server/services/gameDashboardService';
import { authenticateUser, isValidUUID } from '$lib/server/auth/authUtils';

// GET /api/games/[id]/dashboard - Get game dashboard data
export const GET: RequestHandler = async ({ params, request, url }) => {
	try {
		const gameId = params.id;
		if (!gameId) {
			return json({ error: 'Game ID is required' }, { status: 400 });
		}

		// Validate UUID format
		if (!isValidUUID(gameId)) {
			return json({ error: 'Invalid game ID format' }, { status: 400 });
		}

		// Authenticate user
		const authResult = await authenticateUser(request);
		if (!authResult.success || !authResult.user) {
			return json({ error: authResult.error || 'Authentication failed' }, { status: 401 });
		}

		// Check for cache control
		const useCache = url.searchParams.get('cache') !== 'false';

		// Get dashboard data
		const dashboardData = await gameDashboardService.getGameDashboard(
			gameId,
			authResult.user.email,
			useCache
		);

		if (!dashboardData) {
			return json({ error: 'Game not found or access denied' }, { status: 404 });
		}

		// Set cache headers
		const response = json(dashboardData);
		if (useCache) {
			// Cache for 5 minutes in the browser, but allow stale for 10 minutes
			response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
			response.headers.set('ETag', `"${gameId}-${dashboardData.lastUpdated.getTime()}"`);
		}

		return response;
	} catch (error) {
		console.error('Error fetching game dashboard:', error);
		return json({ error: 'Failed to fetch game dashboard' }, { status: 500 });
	}
};

// POST /api/games/[id]/dashboard - Force refresh dashboard data
export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const gameId = params.id;
		if (!gameId) {
			return json({ error: 'Game ID is required' }, { status: 400 });
		}

		// Validate UUID format
		if (!isValidUUID(gameId)) {
			return json({ error: 'Invalid game ID format' }, { status: 400 });
		}

		// Authenticate user
		const authResult = await authenticateUser(request);
		if (!authResult.success || !authResult.user) {
			return json({ error: authResult.error || 'Authentication failed' }, { status: 401 });
		}

		// Force refresh dashboard data
		const dashboardData = await gameDashboardService.refreshGameDashboard(
			gameId,
			authResult.user.email
		);

		if (!dashboardData) {
			return json({ error: 'Game not found or access denied' }, { status: 404 });
		}

		// Return fresh data without cache headers
		return json(dashboardData);
	} catch (error) {
		console.error('Error refreshing game dashboard:', error);
		return json({ error: 'Failed to refresh game dashboard' }, { status: 500 });
	}
};
