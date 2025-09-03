import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import {
	buildingVersions,
	buildings,
	moduleVersions,
	recipeBuildings,
	recipeVersions
} from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';

// GET /api/recipes/versions/:versionId/buildings - Get buildings compatible with a recipe version
export const GET: RequestHandler = async ({ params }) => {
	try {
		const { versionId } = params;

		if (!versionId) {
			return json({ error: 'Recipe version ID is required' }, { status: 400 });
		}

		// Get building versions that are compatible with this recipe version
		// We need to get the moduleVersionId from the recipeVersion to match buildingVersions
		const compatibleBuildingVersions = await db
			.select({
				id: buildingVersions.id, // This is now buildingVersionId
				name: buildings.name,
				type: buildings.type,
				className: buildings.className
			})
			.from(buildingVersions)
			.innerJoin(buildings, eq(buildingVersions.buildingId, buildings.id))
			.innerJoin(recipeBuildings, eq(buildings.id, recipeBuildings.buildingId))
			.innerJoin(recipeVersions, eq(recipeBuildings.recipeVersionId, recipeVersions.id))
			.where(
				and(
					eq(recipeVersions.id, versionId),
					eq(buildingVersions.moduleVersionId, recipeVersions.moduleVersionId)
				)
			);

		return json(compatibleBuildingVersions || []); // Ensure we always return an array
	} catch (error) {
		console.error('Error fetching compatible buildings:', error);

		// For empty database or missing data, return empty array instead of error
		return json([]);
	}
};
