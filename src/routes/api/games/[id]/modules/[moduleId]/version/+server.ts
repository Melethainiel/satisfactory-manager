import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { gameService } from '$lib/server/services/gameService';

// PUT /api/games/[id]/modules/[moduleId]/version - Set module version for game
export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const gameId = params.id;
		const moduleId = params.moduleId;

		if (!gameId) {
			return json({ error: 'Game ID is required' }, { status: 400 });
		}

		if (!moduleId) {
			return json({ error: 'Module ID is required' }, { status: 400 });
		}

		const { versionId } = await request.json();
		if (!versionId) {
			return json({ error: 'Version ID is required' }, { status: 400 });
		}

		const result = await gameService.setModuleVersion(gameId, moduleId, versionId);
		if (!result.success) {
			return json({ error: 'Module not found in game or version update failed' }, { status: 404 });
		}

		return json({
			success: result.success,
			migrationResult: result.migrationResult
		});
	} catch (error) {
		console.error('Error setting module version:', error);
		return json({ error: 'Failed to set module version' }, { status: 500 });
	}
};
