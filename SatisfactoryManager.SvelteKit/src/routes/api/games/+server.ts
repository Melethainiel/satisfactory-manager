import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { gameService } from '$lib/server/services/gameService';
import { userService } from '$lib/server/services/userService';

// GET /api/games?email=user@example.com
export const GET: RequestHandler = async ({ url }) => {
	try {
		const email = url.searchParams.get('email');
		if (!email) {
			return json({ error: 'Email query parameter is required' }, { status: 400 });
		}
		const games = await gameService.getForUserEmail(email);
		return json(games);
	} catch (error) {
		console.error('Error fetching games:', error);
		return json({ error: 'Failed to fetch games' }, { status: 500 });
	}
};

// POST /api/games  body: { email: string, name: string }
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as { email?: string; name?: string };
		if (!body.email || !body.name) {
			return json({ error: 'Email and name are required' }, { status: 400 });
		}
		const user = await userService.getByEmail(body.email);
		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}
		const game = await gameService.create({ name: body.name });
		await gameService.addUser(game.id, user.id, 'Owner');
		return json(game, {
			status: 201,
			headers: { Location: `/api/games/${game.id}` }
		});
	} catch (error) {
		console.error('Error creating game:', error);
		return json({ error: 'Failed to create game' }, { status: 500 });
	}
};
