import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { moduleService } from '$lib/server/services/moduleService';

// POST /api/modules/[id]/import-archive - Import items from module's archive
export const POST: RequestHandler = async ({ params }) => {
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

		// Check if module has download URL
		if (!module.downloadUrl) {
			return json({ error: 'Module does not have a download URL configured' }, { status: 400 });
		}

		// Import content from archive
		const importResult = await moduleService.importContentFromModuleArchive(moduleId);

		if (!importResult) {
			return json(
				{ error: 'Could not import from archive - no downloadUrl or versions found' },
				{ status: 400 }
			);
		}

		return json({
			success: true,
			module: {
				id: module.id,
				name: module.name,
				downloadUrl: module.downloadUrl
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
		console.error('Error importing from module archive:', error);

		// Return specific error message if available
		const errorMessage = error instanceof Error ? error.message : 'Failed to import from archive';

		return json({ error: errorMessage }, { status: 500 });
	}
};
