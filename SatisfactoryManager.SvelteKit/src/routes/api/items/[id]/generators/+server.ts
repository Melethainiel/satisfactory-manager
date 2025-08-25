import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { itemService } from '$lib/server/services/itemService';

// GET /api/items/{id}/generators?gameId=xxx - Get generators that can use this item as fuel
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

		const generators = await itemService.getGeneratorsForItem(gameId.trim(), itemId.trim());

		return json({
			success: true,
			data: generators
		});
	} catch (error) {
		console.error('Error fetching generators for item:', error);
		return json(
			{
				success: false,
				error: 'Failed to fetch generators for item'
			},
			{ status: 500 }
		);
	}
};
