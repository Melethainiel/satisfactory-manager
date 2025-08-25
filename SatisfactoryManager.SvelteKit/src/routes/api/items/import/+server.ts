import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { itemService } from '$lib/server/services/itemService';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { moduleVersions } from '$lib/server/db/schema';

interface ImportItemData {
	className: string;
	displayName: string;
	description?: string;
	form: 'RF_SOLID' | 'RF_LIQUID' | 'RF_GAS';
	energyValue?: number;
}

// POST /api/items/import - Bulk import item data
export const POST: RequestHandler = async ({ request }) => {
	try {
		// Check content length to prevent DoS attacks
		const contentLength = request.headers.get('content-length');
		if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
			// 10MB limit
			return json({ error: 'Request payload too large (max 10MB)' }, { status: 413 });
		}

		const { items: itemsData, moduleVersionId } = await request.json();

		if (!Array.isArray(itemsData) || itemsData.length === 0) {
			return json({ error: 'items array is required and must not be empty' }, { status: 400 });
		}

		// Limit number of items that can be imported at once
		if (itemsData.length > 1000) {
			return json({ error: 'Maximum 1000 items can be imported at once' }, { status: 400 });
		}

		if (!moduleVersionId || typeof moduleVersionId !== 'string') {
			return json({ error: 'moduleVersionId is required' }, { status: 400 });
		}

		// Validate that the module version exists
		const [moduleVersion] = await db
			.select()
			.from(moduleVersions)
			.where(eq(moduleVersions.id, moduleVersionId));

		if (!moduleVersion) {
			return json({ error: 'Invalid moduleVersionId' }, { status: 400 });
		}

		const results = {
			created: 0,
			updated: 0,
			versionsCreated: 0,
			errors: [] as string[]
		};

		for (const itemData of itemsData as ImportItemData[]) {
			try {
				// Validate required fields
				if (
					!itemData.className ||
					typeof itemData.className !== 'string' ||
					!itemData.className.trim()
				) {
					results.errors.push(
						`Invalid item data: missing or invalid className for ${itemData.className || 'unknown'}`
					);
					continue;
				}

				if (
					!itemData.displayName ||
					typeof itemData.displayName !== 'string' ||
					!itemData.displayName.trim()
				) {
					results.errors.push(
						`Invalid item data: missing or invalid displayName for ${itemData.className}`
					);
					continue;
				}

				if (!itemData.form || !['RF_SOLID', 'RF_LIQUID', 'RF_GAS'].includes(itemData.form)) {
					results.errors.push(
						`Invalid item data: missing or invalid form for ${itemData.className}`
					);
					continue;
				}

				// Validate energyValue if provided
				if (itemData.energyValue !== undefined && itemData.energyValue !== null) {
					const value = Number(itemData.energyValue);
					if (isNaN(value) || value < 0) {
						results.errors.push(
							`Invalid item data: energyValue must be a non-negative number for ${itemData.className}`
						);
						continue;
					}
				}

				// Check if item exists
				let item = await itemService.getItemByClassName(itemData.className.trim());

				if (!item) {
					// Create new item
					item = await itemService.createItem({
						moduleId: moduleVersion.moduleId,
						className: itemData.className.trim(),
						displayName: itemData.displayName.trim(),
						description: itemData.description?.trim() || null,
						form: itemData.form
					});
					results.created++;
				} else {
					// Check if item needs updating
					const needsUpdate =
						item.displayName !== itemData.displayName.trim() ||
						item.description !== (itemData.description?.trim() || null) ||
						item.form !== itemData.form;

					if (needsUpdate) {
						item = await itemService.updateItem(item.id, {
							displayName: itemData.displayName.trim(),
							description: itemData.description?.trim() || null,
							form: itemData.form
						});
						results.updated++;
					}
				}

				if (item) {
					// Check if item version already exists for this module version
					const existingVersion = await itemService.getItemVersionByModuleAndItem(
						item.id,
						moduleVersionId
					);

					if (!existingVersion) {
						// Create item version with energy value
						await itemService.addItemVersion(item.id, {
							moduleVersionId,
							energyValue: itemData.energyValue?.toString() || '0'
						});
						results.versionsCreated++;
					}
				}
			} catch (error) {
				results.errors.push(`Error processing item ${itemData.className}: ${error}`);
			}
		}

		return json(results);
	} catch (error) {
		console.error('Error importing items:', error);
		return json({ error: 'Failed to import items' }, { status: 500 });
	}
};
