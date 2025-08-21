import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { siteService } from '$lib/server/services/siteService';
import { gameService } from '$lib/server/services/gameService';
import { userService } from '$lib/server/services/userService';

// GET /api/games/[id]/sites - Get all sites for a game
export const GET: RequestHandler = async ({ params }) => {
	try {
		const gameId = params.id;
		if (!gameId) {
			return json({ error: 'Game ID is required' }, { status: 400 });
		}

		// Verify game exists
		const game = await gameService.getById(gameId);
		if (!game) {
			return json({ error: 'Game not found' }, { status: 404 });
		}

		const sites = await siteService.getAllForGame(gameId);
		return json(sites);
	} catch (error) {
		console.error('Error fetching sites:', error);
		return json({ error: 'Failed to fetch sites' }, { status: 500 });
	}
};

// POST /api/games/[id]/sites - Create a new site
export const POST: RequestHandler = async ({ params, request, locals }) => {
	try {
		const gameId = params.id;
		if (!gameId) {
			return json({ error: 'Game ID is required' }, { status: 400 });
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

		// Verify game exists
		const game = await gameService.getById(gameId);
		if (!game) {
			return json({ error: 'Game not found' }, { status: 404 });
		}
		
		// Check user role in game (Contributor+ required for POST)
		const userDetail = await gameService.getUserDetailed(gameId, caller.id);
		if (!userDetail || 
			(userDetail.role !== 'Contributor' && 
			 userDetail.role !== 'Administrator' && 
			 userDetail.role !== 'Owner')) {
			return json({ error: 'Forbidden - Contributor role or higher required' }, { status: 403 });
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

		// Create the site
		const site = await siteService.create({
			name: siteName,
			gameId
		});

		return json(site, {
			status: 201,
			headers: { Location: `/api/games/${gameId}/sites/${site.id}` }
		});
	} catch (error) {
		console.error('Error creating site:', error);
		return json({ error: 'Failed to create site' }, { status: 500 });
	}
};