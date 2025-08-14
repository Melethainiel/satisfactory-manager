import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { itemService } from '$lib/server/services/itemService';

// GET /api/items - List all items
export const GET: RequestHandler = async ({ url }) => {
	try {
		const form = url.searchParams.get('form');
		
		// Validate form if provided
		if (form && !['RF_SOLID', 'RF_LIQUID', 'RF_GAS'].includes(form)) {
			return json({ error: 'Invalid item form. Must be RF_SOLID, RF_LIQUID, or RF_GAS' }, { status: 400 });
		}
		
		let items;
		if (form) {
			items = await itemService.getItemsByForm(form as any);
		} else {
			items = await itemService.getAllItems();
		}

		return json(items);
	} catch (error) {
		console.error('Error fetching items:', error);
		return json({ error: 'Failed to fetch items' }, { status: 500 });
	}
};

// POST /api/items - Create a new item
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { className, displayName, description, form } = await request.json();

		if (!className || typeof className !== 'string' || !className.trim()) {
			return json({ error: 'Item className is required' }, { status: 400 });
		}

		if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
			return json({ error: 'Item displayName is required' }, { status: 400 });
		}

		if (!form || !['RF_SOLID', 'RF_LIQUID', 'RF_GAS'].includes(form)) {
			return json({ error: 'Valid item form is required (RF_SOLID, RF_LIQUID, or RF_GAS)' }, { status: 400 });
		}

		// Check if item with this className already exists
		const existingItem = await itemService.getItemByClassName(className.trim());
		if (existingItem) {
			return json({ error: 'An item with this className already exists' }, { status: 409 });
		}

		const item = await itemService.createItem({
			className: className.trim(),
			displayName: displayName.trim(),
			description: description?.trim() || null,
			form
		});

		return json(item, { status: 201 });
	} catch (error) {
		console.error('Error creating item:', error);
		return json({ error: 'Failed to create item' }, { status: 500 });
	}
};