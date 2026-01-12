import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { moduleService } from '$lib/server/services/moduleService';

// POST /api/modules/yaml-preview - Preview module information from YAML manifest URL
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { manifestUrl } = await request.json();

		if (!manifestUrl || typeof manifestUrl !== 'string' || !manifestUrl.trim()) {
			return json({ error: 'Manifest URL is required' }, { status: 400 });
		}

		// Validate URL format
		try {
			new URL(manifestUrl.trim());
		} catch {
			return json({ error: 'Invalid manifest URL format' }, { status: 400 });
		}

		// Fetch and parse the manifest
		const previewInfo = await moduleService.previewFromManifest(manifestUrl.trim());

		return json({
			success: true,
			manifest: previewInfo
		});
	} catch (error) {
		console.error('Error previewing YAML manifest:', error);

		// Return specific error message if available
		const errorMessage = error instanceof Error ? error.message : 'Failed to preview manifest';

		return json(
			{
				error: errorMessage
			},
			{
				status: 400
			}
		);
	}
};
