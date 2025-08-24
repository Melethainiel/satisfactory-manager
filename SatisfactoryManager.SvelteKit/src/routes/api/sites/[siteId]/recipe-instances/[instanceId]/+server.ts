import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { recipeInstanceService } from '$lib/server/services/recipeInstanceService';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { instanceId } = params;
		const instance = await recipeInstanceService.getRecipeInstanceById(instanceId);
		
		if (!instance) {
			return json(
				{
					success: false,
					error: 'Recipe instance not found'
				},
				{ status: 404 }
			);
		}

		return json({
			success: true,
			data: instance
		});
	} catch (error) {
		console.error('Error fetching recipe instance:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch recipe instance'
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
		if (data.buildingId) updateData.buildingId = data.buildingId;
		if (data.buildingCount !== undefined) updateData.buildingCount = data.buildingCount.toString();
		if (data.efficiencyRatio !== undefined) updateData.efficiencyRatio = data.efficiencyRatio.toString();
		if (data.notes !== undefined) updateData.notes = data.notes || null;

		const instance = await recipeInstanceService.updateRecipeInstance(instanceId, updateData);
		
		if (!instance) {
			return json(
				{
					success: false,
					error: 'Recipe instance not found'
				},
				{ status: 404 }
			);
		}

		return json({
			success: true,
			data: instance
		});
	} catch (error) {
		console.error('Error updating recipe instance:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to update recipe instance'
			},
			{ status: 500 }
		);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const { instanceId } = params;
		const success = await recipeInstanceService.deleteRecipeInstance(instanceId);
		
		if (!success) {
			return json(
				{
					success: false,
					error: 'Recipe instance not found'
				},
				{ status: 404 }
			);
		}

		return json({
			success: true,
			message: 'Recipe instance deleted successfully'
		});
	} catch (error) {
		console.error('Error deleting recipe instance:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to delete recipe instance'
			},
			{ status: 500 }
		);
	}
};