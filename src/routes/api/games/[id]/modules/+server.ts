import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { gameService } from '$lib/server/services/gameService';

// GET /api/games/[id]/modules - Get all modules for a game
export const GET: RequestHandler = async ({ params }) => {
	try {
		const gameId = params.id;
		if (!gameId) {
			return json({ error: 'Game ID is required' }, { status: 400 });
		}

		const gameModules = await gameService.getGameModules(gameId);
		return json(gameModules);
	} catch (error) {
		console.error('Error loading game modules:', error);
		return json({ error: 'Failed to load game modules' }, { status: 500 });
	}
};

// POST /api/games/[id]/modules - Add module to game
export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const gameId = params.id;
		if (!gameId) {
			return json({ error: 'Game ID is required' }, { status: 400 });
		}

		const { moduleId, selectedVersionId } = await request.json();
		if (!moduleId) {
			return json({ error: 'Module ID is required' }, { status: 400 });
		}

		const gameModules = await gameService.addModuleToGame(gameId, moduleId, selectedVersionId);
		return json(gameModules);
	} catch (error) {
		console.error('Error adding module to game:', error);
		return json({ error: 'Failed to add module to game' }, { status: 500 });
	}
};

// DELETE /api/games/[id]/modules - Remove module from game
export const DELETE: RequestHandler = async ({ params, request }) => {
	try {
		const gameId = params.id;
		if (!gameId) {
			return json({ error: 'Game ID is required' }, { status: 400 });
		}

		const { moduleId } = await request.json();
		if (!moduleId) {
			return json({ error: 'Module ID is required' }, { status: 400 });
		}

		const success = await gameService.removeModuleFromGame(gameId, moduleId);
		return json({ success });
	} catch (error) {
		console.error('Error removing module from game:', error);
		return json({ error: 'Failed to remove module from game' }, { status: 500 });
	}
};
