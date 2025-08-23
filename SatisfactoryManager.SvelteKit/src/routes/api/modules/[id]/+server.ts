import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { moduleService } from '$lib/server/services/moduleService';
import { requireAdmin, isValidUUID } from '$lib/server/auth/authUtils';

// DELETE /api/modules/[id] - Delete a module (Admin only)
export const DELETE: RequestHandler = requireAdmin(async ({ params, user }) => {
	try {
		const moduleId = params.id;

		if (!moduleId) {
			return json({ error: 'Module ID is required' }, { status: 400 });
		}

		// Validate UUID format
		if (!isValidUUID(moduleId)) {
			return json({ error: 'Invalid module ID format' }, { status: 400 });
		}

		console.log(
			`Admin user ${user.email} (${user.displayName}) attempting to delete module: ${moduleId}`
		);

		const success = await moduleService.delete(moduleId);

		if (!success) {
			return json({ error: 'Module not found or could not be deleted' }, { status: 404 });
		}

		console.log(`Module ${moduleId} successfully deleted by admin ${user.email}`);
		return json({ success: true });
	} catch (error) {
		console.error('Error deleting module:', error);

		const errorMessage = error instanceof Error ? error.message : 'Failed to delete module';
		return json({ error: errorMessage }, { status: 500 });
	}
});
