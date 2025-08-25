import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { itemService } from '$lib/server/services/itemService';

// GET /api/items/{id}/extractors?gameId=xxx - Get extractors that can extract this item
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

		const extractors = await itemService.getExtractorsForItem(gameId.trim(), itemId.trim());

		return json({
			success: true,
			data: extractors
		});
	} catch (error) {
		console.error('Error fetching extractors for item:', error);
		return json(
			{ 
				success: false,
				error: 'Failed to fetch extractors for item' 
			}, 
			{ status: 500 }
		);
	}
};