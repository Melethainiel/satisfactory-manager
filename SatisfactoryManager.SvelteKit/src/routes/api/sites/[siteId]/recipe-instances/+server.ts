import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { recipeInstanceService } from '$lib/server/services/recipeInstanceService';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { siteId } = params;
		const instances = await recipeInstanceService.getRecipeInstancesBySite(siteId);
		
		return json({
			success: true,
			data: instances
		});
	} catch (error) {
		console.error('Error fetching recipe instances:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch recipe instances'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, params }) => {
	try {
		const { siteId } = params;
		const data = await request.json();
		
		// Validate required fields
		if (!data.recipeVersionId) {
			return json(
				{
					success: false,
					error: 'Recipe version ID is required'
				},
				{ status: 400 }
			);
		}
		
		if (!data.buildingId) {
			return json(
				{
					success: false,
					error: 'Building ID is required'
				},
				{ status: 400 }
			);
		}
		
		if (!data.buildingCount || parseFloat(data.buildingCount) <= 0) {
			return json(
				{
					success: false,
					error: 'Building count must be greater than 0'
				},
				{ status: 400 }
			);
		}

		const instanceData = {
			siteId,
			recipeVersionId: data.recipeVersionId,
			buildingId: data.buildingId,
			buildingCount: data.buildingCount.toString(),
			efficiencyRatio: data.efficiencyRatio?.toString() || '1.000',
			notes: data.notes || null
		};

		const instance = await recipeInstanceService.createRecipeInstance(instanceData);
		
		return json({
			success: true,
			data: instance
		}, { status: 201 });
	} catch (error) {
		console.error('Error creating recipe instance:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create recipe instance'
			},
			{ status: 500 }
		);
	}
};