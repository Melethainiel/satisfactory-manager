import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { moduleService } from '$lib/server/services/moduleService';

export const PUT: RequestHandler = async ({ request, params }) => {
	try {
		const moduleId = params.id;
		const { version } = await request.json();

		if (!moduleId) {
			return json({ error: 'Module ID is required' }, { status: 400 });
		}

		if (!version || typeof version !== 'string' || !version.trim()) {
			return json({ error: 'Version is required' }, { status: 400 });
		}

		// Check if module exists
		const module = await moduleService.getById(moduleId);
		if (!module) {
			return json({ error: 'Module not found' }, { status: 404 });
		}

		// Check if the version exists for this module
		const versions = await moduleService.getVersions(moduleId);
		const versionExists = versions.some((v) => v.version === version.trim());
		if (!versionExists) {
			return json({ error: 'Version not found for this module' }, { status: 404 });
		}

		const updatedModule = await moduleService.updateCurrentVersion(moduleId, version.trim());

		if (!updatedModule) {
			return json({ error: 'Failed to update module' }, { status: 500 });
		}

		return json(updatedModule);
	} catch (error) {
		console.error('Error updating current module version:', error);
		return json({ error: 'Failed to update current version' }, { status: 500 });
	}
};
