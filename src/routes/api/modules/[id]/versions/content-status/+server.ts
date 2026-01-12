import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { moduleService } from '$lib/server/services/moduleService';

// GET /api/modules/[id]/versions/content-status - Batch check content status for all versions
export const GET: RequestHandler = async ({ params }) => {
	try {
		const moduleId = params.id;

		if (!moduleId) {
			return json({ error: 'Module ID is required' }, { status: 400 });
		}

		// Validate module exists
		const module = await moduleService.getById(moduleId);
		if (!module) {
			return json({ error: 'Module not found' }, { status: 404 });
		}

		// Get all versions for the module
		const versions = await moduleService.getVersions(moduleId);

		// Batch check content status for all versions in parallel
		const statusPromises = versions.map(async (version) => {
			try {
				const hasContent = await moduleService.checkVersionContentExists(version.id);
				return {
					versionId: version.id,
					version: version.version,
					hasContent,
					canImport: !!version.releaseUrl
				};
			} catch (error) {
				console.warn(`Failed to check content for version ${version.id}:`, error);
				return {
					versionId: version.id,
					version: version.version,
					hasContent: false,
					canImport: false,
					error: 'Failed to check content status'
				};
			}
		});

		const statusResults = await Promise.all(statusPromises);

		// Convert array to object for easier frontend consumption
		const statusMap: Record<string, any> = {};
		statusResults.forEach((status) => {
			statusMap[status.versionId] = {
				hasContent: status.hasContent,
				canImport: status.canImport,
				version: status.version,
				...(status.error && { error: status.error })
			};
		});

		return json({
			moduleId: module.id,
			moduleName: module.name,
			versionsCount: versions.length,
			contentStatus: statusMap
		});
	} catch (error) {
		console.error('Error batch checking version content status:', error);

		const errorMessage =
			error instanceof Error ? error.message : 'Failed to batch check version content status';

		return json({ error: errorMessage }, { status: 500 });
	}
};
