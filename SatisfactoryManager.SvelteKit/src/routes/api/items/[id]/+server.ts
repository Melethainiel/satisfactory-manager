import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { itemService } from '$lib/server/services/itemService';

// GET /api/items/[id] - Get item by ID
export const GET: RequestHandler = async ({ params }) => {
	try {
		if (!params.id || typeof params.id !== 'string') {
			return json({ error: 'Invalid item ID' }, { status: 400 });
		}

		const item = await itemService.getItemById(params.id);
		
		if (!item) {
			return json({ error: 'Item not found' }, { status: 404 });
		}

		return json(item);
	} catch (error) {
		console.error('Error fetching item:', error);
		return json({ error: 'Failed to fetch item' }, { status: 500 });
	}
};

// PATCH /api/items/[id] - Update item
export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		if (!params.id || typeof params.id !== 'string') {
			return json({ error: 'Invalid item ID' }, { status: 400 });
		}

		const updates = await request.json();
		
		// Validate update fields
		if (updates.className !== undefined) {
			if (typeof updates.className !== 'string' || !updates.className.trim()) {
				return json({ error: 'Invalid className' }, { status: 400 });
			}
			updates.className = updates.className.trim();
		}

		if (updates.displayName !== undefined) {
			if (typeof updates.displayName !== 'string' || !updates.displayName.trim()) {
				return json({ error: 'Invalid displayName' }, { status: 400 });
			}
			updates.displayName = updates.displayName.trim();
		}

		if (updates.description !== undefined && updates.description !== null) {
			if (typeof updates.description !== 'string') {
				return json({ error: 'Invalid description' }, { status: 400 });
			}
			updates.description = updates.description.trim() || null;
		}

		if (updates.form !== undefined) {
			if (!['RF_SOLID', 'RF_LIQUID', 'RF_GAS'].includes(updates.form)) {
				return json({ error: 'Invalid item form. Must be RF_SOLID, RF_LIQUID, or RF_GAS' }, { status: 400 });
			}
		}

		const item = await itemService.updateItem(params.id, updates);
		
		if (!item) {
			return json({ error: 'Item not found' }, { status: 404 });
		}

		return json(item);
	} catch (error) {
		console.error('Error updating item:', error);
		return json({ error: 'Failed to update item' }, { status: 500 });
	}
};

// DELETE /api/items/[id] - Delete item
export const DELETE: RequestHandler = async ({ params }) => {
	try {
		if (!params.id || typeof params.id !== 'string') {
			return json({ error: 'Invalid item ID' }, { status: 400 });
		}

		const deleted = await itemService.deleteItem(params.id);
		
		if (!deleted) {
			return json({ error: 'Item not found' }, { status: 404 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting item:', error);
		return json({ error: 'Failed to delete item' }, { status: 500 });
	}
};