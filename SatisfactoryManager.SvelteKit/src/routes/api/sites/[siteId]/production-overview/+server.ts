import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { productionInstanceService } from '$lib/server/services/productionInstanceService';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { siteId } = params;
		const productionOverview = await productionInstanceService.calculateSiteProduction(siteId);
		
		return json({
			success: true,
			data: productionOverview
		});
	} catch (error) {
		console.error('Error calculating site production:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to calculate site production'
			},
			{ status: 500 }
		);
	}
};