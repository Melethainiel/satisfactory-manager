import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { productionInstanceService } from '$lib/server/services/productionInstanceService';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { instanceId } = params;
		const instance = await productionInstanceService.getProductionInstanceById(instanceId);

		if (!instance) {
			return json(
				{
					success: false,
					error: 'Production instance not found'
				},
				{ status: 404 }
			);
		}

		return json({
			success: true,
			data: instance
		});
	} catch (error) {
		console.error('Error fetching production instance:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch production instance'
			},
			{ status: 500 }
		);
	}
};

export const PATCH: RequestHandler = async ({ request, params }) => {
	try {
		const { instanceId } = params;
		const data = await request.json();

		// Validate numeric fields if provided
		if (data.buildingCount !== undefined && parseFloat(data.buildingCount) <= 0) {
			return json(
				{
					success: false,
					error: 'Building count must be greater than 0'
				},
				{ status: 400 }
			);
		}

		if (data.efficiencyRatio !== undefined) {
			const ratio = parseFloat(data.efficiencyRatio);
			if (ratio <= 0 || ratio > 2.5) {
				return json(
					{
						success: false,
						error: 'Efficiency ratio must be between 0 and 2.5'
					},
					{ status: 400 }
				);
			}
		}

		const updateData: any = {};

		if (data.recipeVersionId) updateData.recipeVersionId = data.recipeVersionId;
		if (data.buildingVersionId) updateData.buildingVersionId = data.buildingVersionId;
		if (data.buildingCount !== undefined) updateData.buildingCount = data.buildingCount.toString();
		if (data.efficiencyRatio !== undefined)
			updateData.efficiencyRatio = data.efficiencyRatio.toString();
		if (data.extractorPurity !== undefined) updateData.extractorPurity = data.extractorPurity;
		if (data.isBuilt !== undefined) updateData.isBuilt = data.isBuilt;
		if (data.notes !== undefined) updateData.notes = data.notes || null;

		const instance = await productionInstanceService.updateProductionInstance(
			instanceId,
			updateData
		);

		if (!instance) {
			return json(
				{
					success: false,
					error: 'Production instance not found'
				},
				{ status: 404 }
			);
		}

		return json({
			success: true,
			data: instance
		});
	} catch (error) {
		console.error('Error updating production instance:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to update production instance'
			},
			{ status: 500 }
		);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const { instanceId } = params;
		const success = await productionInstanceService.deleteProductionInstance(instanceId);

		if (!success) {
			return json(
				{
					success: false,
					error: 'Production instance not found'
				},
				{ status: 404 }
			);
		}

		return json({
			success: true,
			message: 'Production instance deleted successfully'
		});
	} catch (error) {
		console.error('Error deleting production instance:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to delete production instance'
			},
			{ status: 500 }
		);
	}
};
