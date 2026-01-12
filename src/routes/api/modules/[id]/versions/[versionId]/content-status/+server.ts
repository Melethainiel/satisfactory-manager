import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { moduleService } from '$lib/server/services/moduleService';

// GET /api/modules/[id]/versions/[versionId]/content-status - Check if version has imported content
export const GET: RequestHandler = async ({ params }) => {
	try {
		const moduleId = params.id;
		const versionId = params.versionId;

		if (!moduleId) {
			return json({ error: 'Module ID is required' }, { status: 400 });
		}

		if (!versionId) {
			return json({ error: 'Version ID is required' }, { status: 400 });
		}

		// Validate module exists
		const module = await moduleService.getById(moduleId);
		if (!module) {
			return json({ error: 'Module not found' }, { status: 404 });
		}

		// Validate version exists and belongs to the module
		const version = await moduleService.getVersionById(versionId);
		if (!version) {
			return json({ error: 'Version not found' }, { status: 404 });
		}

		if (version.moduleId !== moduleId) {
			return json({ error: 'Version does not belong to the specified module' }, { status: 400 });
		}

		// Check if the version has any imported content
		const hasContent = await moduleService.checkVersionContentExists(versionId);

		return json({
			versionId: version.id,
			version: version.version,
			moduleId: module.id,
			moduleName: module.name,
			hasContent,
			canImport: !!version.releaseUrl // Can only import if version has a release URL
		});
	} catch (error) {
		console.error('Error checking version content status:', error);

		// Return specific error message if available
		const errorMessage =
			error instanceof Error ? error.message : 'Failed to check version content status';

		return json({ error: errorMessage }, { status: 500 });
	}
};
