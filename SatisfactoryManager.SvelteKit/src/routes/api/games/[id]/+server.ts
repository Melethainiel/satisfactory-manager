import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { gameService } from '$lib/server/services/gameService';

// PATCH /api/games/[id]  body: { name?: string }
export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const id = params.id;
		if (!id) {
			return json({ error: 'Game ID is required' }, { status: 400 });
		}
		let body: { name?: string };
		try {
			body = await request.json();
		} catch {
			return json({ error: 'invalid json body' }, { status: 400 });
		}
		if (!body.name || !body.name.trim()) {
			return json({ error: 'name required' }, { status: 400 });
		}
		const updated = await gameService.update(id, { name: body.name.trim() });
		if (!updated) {
			return json({ error: 'Game not found' }, { status: 404 });
		}
		return json(updated);
	} catch (error) {
		console.error('Error updating game:', error);
		return json({ error: 'Failed to update game' }, { status: 500 });
	}
};

// DELETE /api/games/[id]
export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const id = params.id;
		if (!id) {
			return json({ error: 'Game ID is required' }, { status: 400 });
		}
		const deleted = await gameService.delete(id);
		if (!deleted) {
			return json({ error: 'Game not found' }, { status: 404 });
		}
		return new Response(null, { status: 204 });
	} catch (error) {
		console.error('Error deleting game:', error);
		return json({ error: 'Failed to delete game' }, { status: 500 });
	}
};
