import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { productionInstanceService } from '$lib/server/services/productionInstanceService';
import { requireSiteAccess, isValidUUID } from '$lib/server/auth/authUtils';

// GET method removed - use /production-summary endpoint instead for consolidated data

export const POST: RequestHandler = requireSiteAccess('Contributor')(async ({
	request,
	params,
	user
}) => {
	try {
		const { siteId } = params;
		const data = await request.json();

		// Additional UUID validation (already checked by requireSiteAccess but good practice)
		if (!isValidUUID(siteId)) {
			return json(
				{
					success: false,
					error: 'Invalid site ID format'
				},
				{ status: 400 }
			);
		}

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

		if (!isValidUUID(data.buildingVersionId)) {
			return json(
				{
					success: false,
					error: 'Building version ID must be a valid UUID'
				},
				{ status: 400 }
			);
		}

		// Validate optional UUID fields
		if (data.recipeVersionId && !isValidUUID(data.recipeVersionId)) {
			return json(
				{
					success: false,
					error: 'Recipe version ID must be a valid UUID'
				},
				{ status: 400 }
			);
		}

		if (data.extractedItemVersionId && !isValidUUID(data.extractedItemVersionId)) {
			return json(
				{
					success: false,
					error: 'Extracted item version ID must be a valid UUID'
				},
				{ status: 400 }
			);
		}

		if (data.fuelItemVersionId && !isValidUUID(data.fuelItemVersionId)) {
			return json(
				{
					success: false,
					error: 'Fuel item version ID must be a valid UUID'
				},
				{ status: 400 }
			);
		}

		// Validate numeric fields
		if (
			!data.buildingCount ||
			isNaN(parseFloat(data.buildingCount)) ||
			parseFloat(data.buildingCount) <= 0
		) {
			return json(
				{
					success: false,
					error: 'Building count must be greater than 0'
				},
				{ status: 400 }
			);
		}

		if (
			data.efficiencyRatio &&
			(isNaN(parseFloat(data.efficiencyRatio)) ||
				parseFloat(data.efficiencyRatio) <= 0 ||
				parseFloat(data.efficiencyRatio) > 2.5)
		) {
			return json(
				{
					success: false,
					error: 'Efficiency ratio must be between 0 and 2.5'
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
			isBuilt: data.isBuilt || false, // Default to not built
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
});
