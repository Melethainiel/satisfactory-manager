import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { moduleService } from '$lib/server/services/moduleService';

export const POST: RequestHandler = async ({ params }) => {
	try {
		const moduleId = params.id;

		if (!moduleId) {
			return json({ error: 'Module ID is required' }, { status: 400 });
		}

		// Check if module exists
		const module = await moduleService.getById(moduleId);
		if (!module) {
			return json({ error: 'Module not found' }, { status: 404 });
		}

		if (!module.githubRepo) {
			return json(
				{ error: 'Module does not have a GitHub repository configured' },
				{ status: 400 }
			);
		}

		const newVersions = await moduleService.fetchAndSyncVersionsFromGitHub(moduleId);

		return json({
			message: `Synchronized ${newVersions.length} new versions from GitHub`,
			newVersions
		});
	} catch (error) {
		console.error('Error syncing module versions from GitHub:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to sync versions from GitHub'
			},
			{ status: 500 }
		);
	}
};
