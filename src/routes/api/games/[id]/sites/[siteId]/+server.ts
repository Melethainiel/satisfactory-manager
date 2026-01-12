import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { siteService } from '$lib/server/services/siteService';
import { gameService } from '$lib/server/services/gameService';
import { userService } from '$lib/server/services/userService';

// GET /api/games/[id]/sites/[siteId] - Get a specific site
export const GET: RequestHandler = async ({ params }) => {
	try {
		const { id: gameId, siteId } = params;
		if (!gameId || !siteId) {
			return json({ error: 'Game ID and Site ID are required' }, { status: 400 });
		}

		// Verify game exists
		const game = await gameService.getById(gameId);
		if (!game) {
			return json({ error: 'Game not found' }, { status: 404 });
		}

		const site = await siteService.getById(siteId);
		if (!site) {
			return json({ error: 'Site not found' }, { status: 404 });
		}

		// Verify site belongs to the specified game
		if (site.gameId !== gameId) {
			return json({ error: 'Site not found in this game' }, { status: 404 });
		}

		return json(site);
	} catch (error) {
		console.error('Error fetching site:', error);
		return json({ error: 'Failed to fetch site' }, { status: 500 });
	}
};

// PATCH /api/games/[id]/sites/[siteId] - Update a site
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	try {
		const { id: gameId, siteId } = params;
		if (!gameId || !siteId) {
			return json({ error: 'Game ID and Site ID are required' }, { status: 400 });
		}

		// Authentication is already enforced by hooks.server.ts
		const callerEmail = locals.user?.email?.toLowerCase();
		if (!callerEmail) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Verify user exists and has appropriate permissions
		const caller = await userService.getByEmail(callerEmail);
		if (!caller) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Check user role in game (Contributor+ required for PATCH)
		const userDetail = await gameService.getUserDetailed(gameId, caller.id);
		if (
			!userDetail ||
			(userDetail.role !== 'Contributor' &&
				userDetail.role !== 'Administrator' &&
				userDetail.role !== 'Owner')
		) {
			return json({ error: 'Forbidden - Contributor role or higher required' }, { status: 403 });
		}

		// Verify game exists
		const game = await gameService.getById(gameId);
		if (!game) {
			return json({ error: 'Game not found' }, { status: 404 });
		}

		// Verify site exists and belongs to the game
		const existingSite = await siteService.getById(siteId);
		if (!existingSite) {
			return json({ error: 'Site not found' }, { status: 404 });
		}

		if (existingSite.gameId !== gameId) {
			return json({ error: 'Site not found in this game' }, { status: 404 });
		}

		// Parse and validate request body
		let body: { name?: string };
		try {
			body = await request.json();
		} catch {
			return json({ error: 'Invalid JSON body' }, { status: 400 });
		}

		if (!body.name || !body.name.trim()) {
			return json({ error: 'Site name is required' }, { status: 400 });
		}

		// Validate site name length (matches database constraint)
		const siteName = body.name.trim();
		if (siteName.length > 200) {
			return json({ error: 'Site name cannot exceed 200 characters' }, { status: 400 });
		}

		// Update the site
		const updatedSite = await siteService.update(siteId, { name: siteName });
		if (!updatedSite) {
			return json({ error: 'Site not found' }, { status: 404 });
		}

		return json(updatedSite);
	} catch (error) {
		console.error('Error updating site:', error);
		return json({ error: 'Failed to update site' }, { status: 500 });
	}
};

// DELETE /api/games/[id]/sites/[siteId] - Delete a site
export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		const { id: gameId, siteId } = params;
		if (!gameId || !siteId) {
			return json({ error: 'Game ID and Site ID are required' }, { status: 400 });
		}

		// Authentication is already enforced by hooks.server.ts
		const callerEmail = locals.user?.email?.toLowerCase();
		if (!callerEmail) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Verify user exists and has appropriate permissions
		const caller = await userService.getByEmail(callerEmail);
		if (!caller) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Check user role in game (Contributor+ required for DELETE)
		const userDetail = await gameService.getUserDetailed(gameId, caller.id);
		if (
			!userDetail ||
			(userDetail.role !== 'Contributor' &&
				userDetail.role !== 'Administrator' &&
				userDetail.role !== 'Owner')
		) {
			return json({ error: 'Forbidden - Contributor role or higher required' }, { status: 403 });
		}

		// Verify game exists
		const game = await gameService.getById(gameId);
		if (!game) {
			return json({ error: 'Game not found' }, { status: 404 });
		}

		// Verify site exists and belongs to the game
		const existingSite = await siteService.getById(siteId);
		if (!existingSite) {
			return json({ error: 'Site not found' }, { status: 404 });
		}

		if (existingSite.gameId !== gameId) {
			return json({ error: 'Site not found in this game' }, { status: 404 });
		}

		// Delete the site
		const deleted = await siteService.delete(siteId);
		if (!deleted) {
			return json({ error: 'Site not found' }, { status: 404 });
		}

		return new Response(null, { status: 204 });
	} catch (error) {
		console.error('Error deleting site:', error);
		return json({ error: 'Failed to delete site' }, { status: 500 });
	}
};
