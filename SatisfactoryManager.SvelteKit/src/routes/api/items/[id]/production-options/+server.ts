import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { itemService } from '$lib/server/services/itemService';

// GET /api/items/{id}/production-options?gameId=xxx - Get production options for an item in a specific game
export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const { id: itemId } = params;
		const gameId = url.searchParams.get('gameId');

		if (!gameId || !gameId.trim()) {
			return json(
				{ error: 'gameId parameter is required' },
				{ status: 400 }
			);
		}

		if (!itemId || !itemId.trim()) {
			return json(
				{ error: 'Item ID is required' },
				{ status: 400 }
			);
		}

		const productionOptions = await itemService.getItemProductionOptions(gameId.trim(), itemId.trim());

		return json({
			success: true,
			data: productionOptions
		});
	} catch (error) {
		console.error('Error fetching item production options:', error);
		return json(
			{ 
				success: false,
				error: 'Failed to fetch item production options' 
			}, 
			{ status: 500 }
		);
	}
};