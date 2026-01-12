import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { itemService } from '$lib/server/services/itemService';

// GET /api/items/{id}/extractors?gameId=xxx - Get extractors that can extract this item
export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const { id: itemId } = params;
		const gameId = url.searchParams.get('gameId');

		if (!gameId || !gameId.trim()) {
			return json({ error: 'gameId parameter is required' }, { status: 400 });
		}

		if (!itemId || !itemId.trim()) {
			return json({ error: 'Item ID is required' }, { status: 400 });
		}

		const extractors = await itemService.getExtractorsForItem(gameId.trim(), itemId.trim());

		return json({
			success: true,
			data: extractors || [] // Ensure we always return an array
		});
	} catch (error) {
		console.error('Error fetching extractors for item:', error);

		// For empty database or missing data, return empty array instead of error
		return json({
			success: true,
			data: []
		});
	}
};
