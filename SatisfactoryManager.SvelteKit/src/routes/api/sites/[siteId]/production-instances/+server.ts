import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { productionInstanceService } from '$lib/server/services/productionInstanceService';

// GET method removed - use /production-summary endpoint instead for consolidated data

export const POST: RequestHandler = async ({ request, params }) => {
	try {
		const { siteId } = params;
		const data = await request.json();

		// Validate required fields
		// recipeVersionId is optional for extraction, but required for crafting
		// We'll let the service layer handle the validation based on building type

		if (!data.buildingVersionId) {
			return json(
				{
					success: false,
					error: 'Building version ID is required'
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
			buildingVersionId: data.buildingVersionId,
			extractedItemVersionId: data.extractedItemVersionId || null, // For extraction instances
			fuelItemVersionId: data.fuelItemVersionId || null, // For power generation instances
			extractorPurity: data.extractorPurity || 'Normal', // For extraction purity
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
