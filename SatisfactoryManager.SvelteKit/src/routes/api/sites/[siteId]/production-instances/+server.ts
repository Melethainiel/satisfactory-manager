import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { productionInstanceService } from '$lib/server/services/productionInstanceService';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { siteId } = params;
		const instances = await productionInstanceService.getProductionInstancesBySite(siteId);

		return json({
			success: true,
			data: instances
		});
	} catch (error) {
		console.error('Error fetching production instances:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch production instances'
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
		// recipeVersionId is optional for extraction, but required for crafting
		// We'll let the service layer handle the validation based on building type

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
			recipeVersionId: data.recipeVersionId || null, // Allow null for extraction
			buildingId: data.buildingId,
			extractedItemId: data.extractedItemId || null, // For extraction instances
			buildingCount: data.buildingCount.toString(),
			efficiencyRatio: data.efficiencyRatio?.toString() || '1.000',
			notes: data.notes || null
		};

		const instance = await productionInstanceService.createProductionInstance(instanceData);

		return json(
			{
				success: true,
				data: instance
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Error creating production instance:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create production instance'
			},
			{ status: 500 }
		);
	}
};
