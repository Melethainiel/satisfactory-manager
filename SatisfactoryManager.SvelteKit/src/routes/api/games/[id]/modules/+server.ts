import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { moduleGames, modules } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const gameId = params.id;
		if (!gameId) {
			return json({ error: 'Game ID is required' }, { status: 400 });
		}

		const gameModules = await db
			.select({
				id: modules.id,
				name: modules.name,
				url: modules.url
			})
			.from(modules)
			.innerJoin(moduleGames, eq(modules.id, moduleGames.moduleId))
			.where(eq(moduleGames.gameId, gameId))
			.orderBy(modules.name);

		return json(gameModules);
	} catch (error) {
		console.error('Error loading game modules:', error);
		return json({ error: 'Failed to load game modules' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const gameId = params.id;
		if (!gameId) {
			return json({ error: 'Game ID is required' }, { status: 400 });
		}

		const { moduleId } = await request.json();
		if (!moduleId) {
			return json({ error: 'Module ID is required' }, { status: 400 });
		}

		await db
			.insert(moduleGames)
			.values({
				gameId,
				moduleId
			})
			.onConflictDoNothing();

		return json({ success: true });
	} catch (error) {
		console.error('Error adding module to game:', error);
		return json({ error: 'Failed to add module to game' }, { status: 500 });
	}
};

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

		await db
			.delete(moduleGames)
			.where(and(eq(moduleGames.gameId, gameId), eq(moduleGames.moduleId, moduleId)));

		return json({ success: true });
	} catch (error) {
		console.error('Error removing module from game:', error);
		return json({ error: 'Failed to remove module from game' }, { status: 500 });
	}
};
