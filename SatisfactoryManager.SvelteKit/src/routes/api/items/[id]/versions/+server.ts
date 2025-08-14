import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { itemService } from '$lib/server/services/itemService';

// GET /api/items/[id]/versions - Get all versions for an item
export const GET: RequestHandler = async ({ params }) => {
	try {
		if (!params.id || typeof params.id !== 'string') {
			return json({ error: 'Invalid item ID' }, { status: 400 });
		}

		// Check if item exists
		const item = await itemService.getItemById(params.id);
		if (!item) {
			return json({ error: 'Item not found' }, { status: 404 });
		}

		const itemVersions = await itemService.getItemVersions(params.id);
		return json(itemVersions);
	} catch (error) {
		console.error('Error fetching item versions:', error);
		return json({ error: 'Failed to fetch item versions' }, { status: 500 });
	}
};

// POST /api/items/[id]/versions - Create a new item version
export const POST: RequestHandler = async ({ params, request }) => {
	try {
		if (!params.id || typeof params.id !== 'string') {
			return json({ error: 'Invalid item ID' }, { status: 400 });
		}

		const versionData = await request.json();
		
		if (!versionData.moduleVersionId || typeof versionData.moduleVersionId !== 'string') {
			return json({ error: 'moduleVersionId is required' }, { status: 400 });
		}

		// Validate energyValue if provided
		if (versionData.energyValue !== undefined && versionData.energyValue !== null) {
			const value = Number(versionData.energyValue);
			if (isNaN(value) || value < 0) {
				return json({ error: 'energyValue must be a non-negative number' }, { status: 400 });
			}
			versionData.energyValue = value.toString();
		}

		// Check if item exists
		const item = await itemService.getItemById(params.id);
		if (!item) {
			return json({ error: 'Item not found' }, { status: 404 });
		}

		// Check if version already exists for this module version
		const existingVersion = await itemService.getItemVersionByModuleAndItem(
			params.id,
			versionData.moduleVersionId
		);
		if (existingVersion) {
			return json({ error: 'Item version already exists for this module version' }, { status: 409 });
		}

		const itemVersion = await itemService.addItemVersion(params.id, versionData);
		return json(itemVersion, { status: 201 });
	} catch (error) {
		console.error('Error creating item version:', error);
		return json({ error: 'Failed to create item version' }, { status: 500 });
	}
};