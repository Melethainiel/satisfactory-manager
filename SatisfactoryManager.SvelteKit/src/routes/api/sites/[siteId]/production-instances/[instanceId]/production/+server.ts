import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { productionInstanceService } from '$lib/server/services/productionInstanceService';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { instanceId } = params;
		const production = await productionInstanceService.calculateInstanceProduction(instanceId);

		if (!production) {
			return json(
				{
					success: false,
					error: 'Production instance not found or production could not be calculated'
				},
				{ status: 404 }
			);
		}

		return json({
			success: true,
			data: production
		});
	} catch (error) {
		console.error('Error calculating instance production:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to calculate production'
			},
			{ status: 500 }
		);
	}
};
