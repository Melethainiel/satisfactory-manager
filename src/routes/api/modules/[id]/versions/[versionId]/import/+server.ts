import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { moduleService } from '$lib/server/services/moduleService';

// POST /api/modules/[id]/versions/[versionId]/import - Import content from specific version
export const POST: RequestHandler = async ({ params }) => {
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

		// Import content from the version's archive
		const importResult = await moduleService.importContentFromVersionArchive(moduleId, versionId);

		if (!importResult) {
			return json(
				{ error: 'Could not import from version archive - no releaseUrl found' },
				{ status: 400 }
			);
		}

		return json({
			success: true,
			module: {
				id: module.id,
				name: module.name
			},
			version: {
				id: version.id,
				version: version.version,
				releaseUrl: version.releaseUrl
			},
			importResult: {
				items: importResult.items,
				buildings: importResult.buildings,
				recipes: importResult.recipes,
				summary: importResult.summary,
				errors: importResult.errors
			}
		});
	} catch (error) {
		console.error('Error importing from version archive:', error);

		// Return specific error message if available
		const errorMessage =
			error instanceof Error ? error.message : 'Failed to import from version archive';

		return json({ error: errorMessage }, { status: 500 });
	}
};
