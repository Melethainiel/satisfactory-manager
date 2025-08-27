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
	extractionBuildings?: string[];
	fuelGenerators?: string[];
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

		// Collect all unique building class names from all items to resolve them in batch
		const allBuildingClassNames = new Set<string>();
		for (const itemData of itemsData as ImportItemData[]) {
			itemData.extractionBuildings?.forEach((className) => allBuildingClassNames.add(className));
			itemData.fuelGenerators?.forEach((className) => allBuildingClassNames.add(className));
		}

		// Pre-resolve building class names to IDs for performance
		const buildingClassNameToIdMap = await itemService.getBuildingIdsByClassNames(
			Array.from(allBuildingClassNames),
			moduleVersion.moduleId
		);

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

				// Validate extractionBuildings if provided
				if (itemData.extractionBuildings !== undefined && itemData.extractionBuildings !== null) {
					if (!Array.isArray(itemData.extractionBuildings)) {
						results.errors.push(
							`Invalid item data: extractionBuildings must be an array for ${itemData.className}`
						);
						continue;
					}
					for (const buildingClassName of itemData.extractionBuildings) {
						if (typeof buildingClassName !== 'string' || !buildingClassName.trim()) {
							results.errors.push(
								`Invalid item data: extractionBuildings must contain valid string classNames for ${itemData.className}`
							);
							continue;
						}
					}
				}

				// Validate fuelGenerators if provided
				if (itemData.fuelGenerators !== undefined && itemData.fuelGenerators !== null) {
					if (!Array.isArray(itemData.fuelGenerators)) {
						results.errors.push(
							`Invalid item data: fuelGenerators must be an array for ${itemData.className}`
						);
						continue;
					}
					for (const buildingClassName of itemData.fuelGenerators) {
						if (typeof buildingClassName !== 'string' || !buildingClassName.trim()) {
							results.errors.push(
								`Invalid item data: fuelGenerators must contain valid string classNames for ${itemData.className}`
							);
							continue;
						}
					}
				}

				// Validate that all referenced building class names exist
				const missingExtractionBuildings: string[] = [];
				const missingFuelGenerators: string[] = [];

				if (itemData.extractionBuildings) {
					for (const className of itemData.extractionBuildings) {
						if (!buildingClassNameToIdMap.has(className)) {
							missingExtractionBuildings.push(className);
						}
					}
				}

				if (itemData.fuelGenerators) {
					for (const className of itemData.fuelGenerators) {
						if (!buildingClassNameToIdMap.has(className)) {
							missingFuelGenerators.push(className);
						}
					}
				}

				if (missingExtractionBuildings.length > 0 || missingFuelGenerators.length > 0) {
					const missingClassNames = [
						...missingExtractionBuildings.map((cn) => `extraction: ${cn}`),
						...missingFuelGenerators.map((cn) => `fuel: ${cn}`)
					];
					results.errors.push(
						`Invalid item data: Building class names not found in module for ${itemData.className}: ${missingClassNames.join(', ')}`
					);
					continue;
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
					let itemVersion = await itemService.getItemVersionByModuleAndItem(
						item.id,
						moduleVersionId
					);

					if (!itemVersion) {
						// Create item version with energy value
						itemVersion = await itemService.addItemVersion(item.id, {
							moduleVersionId,
							energyValue: itemData.energyValue?.toString() || '0'
						});
						results.versionsCreated++;
					}

					// Handle building associations if the item version exists
					if (itemVersion) {
						// Clear existing building associations first
						await itemService.clearItemBuildingAssociations(itemVersion.id);

						// Add new extraction building associations
						if (itemData.extractionBuildings && itemData.extractionBuildings.length > 0) {
							const extractionBuildingIds = itemData.extractionBuildings
								.map((className) => buildingClassNameToIdMap.get(className))
								.filter((id): id is string => id !== undefined);

							if (extractionBuildingIds.length > 0) {
								await itemService.addItemExtractionBuildings(itemVersion.id, extractionBuildingIds);
							}
						}

						// Add new fuel generator associations
						if (itemData.fuelGenerators && itemData.fuelGenerators.length > 0) {
							const fuelGeneratorIds = itemData.fuelGenerators
								.map((className) => buildingClassNameToIdMap.get(className))
								.filter((id): id is string => id !== undefined);

							if (fuelGeneratorIds.length > 0) {
								await itemService.addItemFuelGenerators(itemVersion.id, fuelGeneratorIds);
							}
						}
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
