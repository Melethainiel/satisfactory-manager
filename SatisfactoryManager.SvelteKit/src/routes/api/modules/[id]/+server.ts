import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { moduleService } from '$lib/server/services/moduleService';

// DELETE /api/modules/[id] - Delete a module
export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const moduleId = params.id;
		
		if (!moduleId) {
			return json({ error: 'Module ID is required' }, { status: 400 });
		}

		const success = await moduleService.delete(moduleId);
		
		if (!success) {
			return json({ error: 'Module not found or could not be deleted' }, { status: 404 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting module:', error);
		
		const errorMessage = error instanceof Error ? error.message : 'Failed to delete module';
		return json({ error: errorMessage }, { status: 500 });
	}
};