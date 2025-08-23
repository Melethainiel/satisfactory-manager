import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { importQueueService } from '$lib/server/services/importQueueService';

export const GET: RequestHandler = async () => {
	try {
		const queueEntries = await importQueueService.getAllQueueEntries();
		return json(queueEntries);
	} catch (err) {
		console.error('Failed to get queue entries:', err);
		throw error(500, 'Failed to get queue entries');
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { action, importId } = await request.json();

		if (action === 'cancel' && importId) {
			const cancelled = await importQueueService.cancelImport(importId);
			return json({ success: cancelled });
		}

		if (action === 'process') {
			await importQueueService.processQueue();
			return json({ success: true });
		}

		throw error(400, 'Invalid action or missing importId');
	} catch (err) {
		console.error('Failed to process queue action:', err);
		throw error(500, 'Failed to process queue action');
	}
};
