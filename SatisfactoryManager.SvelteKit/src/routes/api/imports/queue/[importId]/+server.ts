import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { importQueueService } from '$lib/server/services/importQueueService';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { importId } = params;
		
		if (!importId) {
			throw error(400, 'Import ID is required');
		}

		const queueEntry = await importQueueService.getQueueStatus(importId);
		
		if (!queueEntry) {
			throw error(404, 'Import not found');
		}

		return json(queueEntry);
	} catch (err) {
		if (err instanceof Response) {
			throw err;
		}
		console.error('Failed to get queue entry:', err);
		throw error(500, 'Failed to get queue entry');
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const { importId } = params;
		
		if (!importId) {
			throw error(400, 'Import ID is required');
		}

		const cancelled = await importQueueService.cancelImport(importId);
		
		if (!cancelled) {
			throw error(400, 'Import cannot be cancelled (not queued or already processing)');
		}

		return json({ success: true });
	} catch (err) {
		if (err instanceof Response) {
			throw err;
		}
		console.error('Failed to cancel import:', err);
		throw error(500, 'Failed to cancel import');
	}
};