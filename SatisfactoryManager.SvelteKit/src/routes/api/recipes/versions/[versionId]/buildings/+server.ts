import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { buildings, recipeBuildings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/recipes/versions/:versionId/buildings - Get buildings compatible with a recipe version
export const GET: RequestHandler = async ({ params }) => {
	try {
		const { versionId } = params;

		if (!versionId) {
			return json({ error: 'Recipe version ID is required' }, { status: 400 });
		}

		// Get buildings that are compatible with this recipe version
		const compatibleBuildings = await db
			.select({
				id: buildings.id,
				name: buildings.name,
				type: buildings.type,
				className: buildings.className
			})
			.from(buildings)
			.innerJoin(recipeBuildings, eq(buildings.id, recipeBuildings.buildingId))
			.where(eq(recipeBuildings.recipeVersionId, versionId));

		return json(compatibleBuildings);
	} catch (error) {
		console.error('Error fetching compatible buildings:', error);
		return json({ error: 'Failed to fetch compatible buildings' }, { status: 500 });
	}
};