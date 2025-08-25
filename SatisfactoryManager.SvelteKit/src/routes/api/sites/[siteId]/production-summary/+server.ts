import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { productionCalculationService } from '$lib/server/services/productionCalculationService';

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const { siteId } = params;

		// Check if cache should be bypassed
		const bypassCache = url.searchParams.get('fresh') === 'true';
		const useCache = !bypassCache;

		const productionSummary = await productionCalculationService.getProductionSummary(
			siteId,
			useCache
		);

		return json({
			success: true,
			data: productionSummary,
			cached: useCache,
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error('Error fetching production summary:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch production summary',
				timestamp: new Date().toISOString()
			},
			{ status: 500 }
		);
	}
};
