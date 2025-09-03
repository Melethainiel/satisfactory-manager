import * as yaml from 'js-yaml';
import { type IArchiveService, archiveService } from './archiveService';
import { itemService } from './itemService';
import { yamlValidationService } from './yamlValidationService';
import type { Item } from '../db/schema';
import { db } from '../db';
import { moduleVersions } from '../db/schema';
import { eq } from 'drizzle-orm';

// Interface for items as they appear in the Satisfactory mod archive YAML files
interface ArchiveItemData {
	className: string;
	displayName: string;
	description?: string;
	form: 'RF_SOLID' | 'RF_LIQUID' | 'RF_GAS';
	energyValue?: number;
	extractionBuildings?: string[];
	fuelGenerators?: string[];
	// Additional fields that might exist but we don't use yet
	[key: string]: any;
}

// Interface for the converted format that matches our existing import API
interface ImportItemData {
	className: string;
	displayName: string;
	description?: string;
	form: 'RF_SOLID' | 'RF_LIQUID' | 'RF_GAS';
	energyValue?: number;
	extractionBuildings?: string[];
	fuelGenerators?: string[];
}

export interface ArchiveImportResult {
	totalItems: number;
	validItems: number;
	importResults: {
		created: number;
		updated: number;
		versionsCreated: number;
		errors: string[];
	};
}

export interface IArchiveItemService {
	importItemsFromArchive(archiveUrl: string, moduleVersionId: string): Promise<ArchiveImportResult>;
	importItemsFromYamlContent(
		yamlContent: string,
		moduleVersionId: string
	): Promise<ArchiveImportResult>;
	parseItemsYaml(yamlContent: string): Promise<ImportItemData[]>;
	validateArchiveItem(item: any, index: number): ArchiveItemData | null;
	convertToImportFormat(archiveItem: ArchiveItemData): ImportItemData;
}

class ArchiveItemService implements IArchiveItemService {
	constructor(private archiveService: IArchiveService) {}

	/**
	 * Downloads an archive, extracts and imports items from Files/items.yaml
	 * @param archiveUrl URL of the archive to download
	 * @param moduleVersionId Module version to associate items with
	 * @returns Import results with statistics
	 */
	async importItemsFromArchive(
		archiveUrl: string,
		moduleVersionId: string
	): Promise<ArchiveImportResult> {
		try {
			// Download and extract the items.yaml file
			const yamlContent = await this.archiveService.downloadAndExtractFile(
				archiveUrl,
				'Files/items.yaml'
			);

			if (!yamlContent) {
				throw new Error('Files/items.yaml not found in archive');
			}

			// Parse YAML content
			const importItems = await this.parseItemsYaml(yamlContent);

			if (importItems.length === 0) {
				return {
					totalItems: 0,
					validItems: 0,
					importResults: {
						created: 0,
						updated: 0,
						versionsCreated: 0,
						errors: ['No valid items found in Files/items.yaml']
					}
				};
			}

			// Use existing item import logic
			const results = await this.importItemsBulk(importItems, moduleVersionId);

			return {
				totalItems: importItems.length,
				validItems: importItems.length,
				importResults: results
			};
		} catch (error) {
			console.error('Error importing items from archive:', error);
			throw new Error(`Failed to import items from archive: ${error}`);
		}
	}

	/**
	 * Imports items directly from YAML content without downloading
	 * @param yamlContent Raw YAML content string
	 * @param moduleVersionId Module version to associate items with
	 * @returns Import results with statistics
	 */
	async importItemsFromYamlContent(
		yamlContent: string,
		moduleVersionId: string
	): Promise<ArchiveImportResult> {
		try {
			// Parse YAML content
			const importItems = await this.parseItemsYaml(yamlContent);

			if (importItems.length === 0) {
				return {
					totalItems: 0,
					validItems: 0,
					importResults: {
						created: 0,
						updated: 0,
						versionsCreated: 0,
						errors: ['No valid items found in YAML content']
					}
				};
			}

			// Use existing item import logic
			const results = await this.importItemsBulk(importItems, moduleVersionId);

			return {
				totalItems: importItems.length,
				validItems: importItems.length,
				importResults: results
			};
		} catch (error) {
			console.error('Error importing items from YAML content:', error);
			throw new Error(`Failed to import items from YAML content: ${error}`);
		}
	}

	/**
	 * Parses YAML content and converts items to import format
	 * @param yamlContent Raw YAML content string
	 * @returns Array of items in import format
	 */
	async parseItemsYaml(yamlContent: string): Promise<ImportItemData[]> {
		try {
			// Use secure YAML validation service
			const validatedItems = await yamlValidationService.validateAndParseItemsYaml(yamlContent);

			// Convert validated items to import format
			const importItems: ImportItemData[] = validatedItems.map((item) =>
				this.convertToImportFormat(item)
			);

			return importItems;
		} catch (error) {
			console.error('Error parsing items YAML with security validation:', error);
			throw new Error(`Failed to parse items YAML: ${error}`);
		}
	}

	/**
	 * Validates and normalizes an item from the archive
	 * @param item Raw item data from YAML
	 * @param index Index for error reporting
	 * @returns Validated item or null if invalid
	 */
	validateArchiveItem(item: any, index: number): ArchiveItemData | null {
		try {
			// Check required fields
			if (!item || typeof item !== 'object') {
				console.warn(`Item at index ${index} is not an object`);
				return null;
			}

			// Handle both camelCase and PascalCase formats
			const className = item.className || item.ClassName;
			const displayName = item.displayName || item.DisplayName;
			const form = item.form || item.Form;
			const description = item.description || item.Description;
			const energyValue = item.energyValue !== undefined ? item.energyValue : item.EnergyValue;
			const stackSize = item.stackSize !== undefined ? item.stackSize : item.StackSize;
			const radioactiveDecay =
				item.radioactiveDecay !== undefined ? item.radioactiveDecay : item.RadioactiveDecay;

			if (!className || typeof className !== 'string' || !className.trim()) {
				console.warn(`Item at index ${index} missing or invalid className/ClassName`);
				return null;
			}

			if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
				console.warn(`Item at index ${index} missing or invalid displayName/DisplayName`);
				return null;
			}

			// Validate Form enum
			const validForms = ['RF_SOLID', 'RF_LIQUID', 'RF_GAS'];
			if (!form || !validForms.includes(form)) {
				console.warn(`Item at index ${index} (${className}) has invalid form/Form: ${form}`);
				return null;
			}

			// Validate optional numeric fields
			let validatedEnergyValue: number | undefined;
			if (energyValue !== undefined && energyValue !== null) {
				const numericEnergyValue = Number(energyValue);
				if (isNaN(numericEnergyValue) || numericEnergyValue < 0) {
					console.warn(
						`Item at index ${index} (${className}) has invalid energyValue/EnergyValue: ${energyValue}`
					);
					return null;
				}
				validatedEnergyValue = numericEnergyValue;
			}

			// Return validated item with normalized field names
			return {
				className: className.trim(),
				displayName: displayName.trim(),
				description: description ? String(description).trim() : undefined,
				form: form as 'RF_SOLID' | 'RF_LIQUID' | 'RF_GAS',
				energyValue: validatedEnergyValue,
				stackSize: stackSize ? Number(stackSize) : undefined,
				radioactiveDecay: radioactiveDecay ? Number(radioactiveDecay) : undefined
			};
		} catch (error) {
			console.warn(`Error validating item at index ${index}:`, error);
			return null;
		}
	}

	/**
	 * Converts archive item format to existing import API format
	 * @param archiveItem Validated archive item
	 * @returns Item in import format
	 */
	convertToImportFormat(archiveItem: ArchiveItemData): ImportItemData {
		return {
			className: archiveItem.className,
			displayName: archiveItem.displayName,
			description: archiveItem.description || undefined,
			form: archiveItem.form,
			energyValue: archiveItem.energyValue || undefined,
			extractionBuildings: archiveItem.extractionBuildings || undefined,
			fuelGenerators: archiveItem.fuelGenerators || undefined
		};
	}

	/**
	 * Optimized bulk import using batch queries to avoid N+1 problems
	 * @param items Items to import
	 * @param moduleVersionId Module version to associate with
	 * @returns Import results
	 */
	private async importItemsBulk(
		items: ImportItemData[],
		moduleVersionId: string
	): Promise<{ created: number; updated: number; versionsCreated: number; errors: string[] }> {
		const results = {
			created: 0,
			updated: 0,
			versionsCreated: 0,
			errors: [] as string[]
		};

		if (items.length === 0) return results;

		// Get the moduleId from moduleVersionId
		const [moduleVersion] = await db
			.select()
			.from(moduleVersions)
			.where(eq(moduleVersions.id, moduleVersionId));

		if (!moduleVersion) {
			throw new Error(`Module version ${moduleVersionId} not found`);
		}

		try {
			// Get all existing items in one query instead of N queries
			const classNames = items.map((item) => item.className);
			const existingItems = await itemService.getItemsByClassNames(classNames);
			const existingItemsMap = new Map(existingItems.map((item) => [item.className, item]));

			// Separate items into create/update batches
			const itemsToCreate: ImportItemData[] = [];
			const itemsToUpdate: { item: Item; data: ImportItemData }[] = [];

			for (const itemData of items) {
				const existingItem = existingItemsMap.get(itemData.className);

				if (!existingItem) {
					itemsToCreate.push(itemData);
				} else {
					// Check if item needs updating
					const needsUpdate =
						existingItem.displayName !== itemData.displayName ||
						existingItem.form !== itemData.form;

					if (needsUpdate) {
						itemsToUpdate.push({ item: existingItem, data: itemData });
					}
				}
			}

			// Bulk create new items
			if (itemsToCreate.length > 0) {
				const newItemsData = itemsToCreate.map((item) => ({
					moduleId: moduleVersion.moduleId,
					className: item.className,
					displayName: item.displayName,
					form: item.form
				}));

				const createdItems = await itemService.bulkCreateItems(newItemsData);
				results.created = createdItems.length;

				// Add created items to the map for version processing
				for (const createdItem of createdItems) {
					existingItemsMap.set(createdItem.className, createdItem);
				}
			}

			// Update items individually (Drizzle doesn't have bulk update with different data)
			for (const { item, data } of itemsToUpdate) {
				try {
					await itemService.updateItem(item.id, {
						displayName: data.displayName,
						form: data.form
					});
					results.updated++;
				} catch (error) {
					results.errors.push(`Failed to update item ${data.className}: ${error}`);
				}
			}

			// Get all item IDs for version checking
			const allItemIds = Array.from(existingItemsMap.values()).map((item) => item.id);

			// Batch query for existing versions
			const existingVersionsMap = await itemService.getExistingVersionsForModule(
				allItemIds,
				moduleVersionId
			);

			// Collect versions to create
			const versionsToCreate: {
				itemId: string;
				moduleVersionId: string;
				energyValue: string;
			}[] = [];

			for (const itemData of items) {
				const item = existingItemsMap.get(itemData.className);
				if (item && !existingVersionsMap.has(item.id)) {
					versionsToCreate.push({
						itemId: item.id,
						moduleVersionId,
						energyValue: itemData.energyValue?.toString() || '0'
					});
				}
			}

			// Bulk create versions
			if (versionsToCreate.length > 0) {
				const createdVersions = await itemService.bulkCreateItemVersions(versionsToCreate);
				results.versionsCreated = createdVersions.length;
			}

			// Process building associations for items that have them
			await this.processBuildingAssociations(items, existingItemsMap, moduleVersionId, results);
		} catch (error) {
			results.errors.push(`Bulk import failed: ${error}`);
		}

		return results;
	}

	/**
	 * Process building associations for imported items
	 * @param items Imported item data
	 * @param existingItemsMap Map of existing items by className
	 * @param moduleVersionId Module version ID to find item versions and resolve building classNames
	 * @param results Results object to add errors to
	 */
	private async processBuildingAssociations(
		items: ImportItemData[],
		existingItemsMap: Map<string, Item>,
		moduleVersionId: string,
		results: { created: number; updated: number; versionsCreated: number; errors: string[] }
	): Promise<void> {
		// Collect all building classNames that need to be resolved
		const allBuildingClassNames = new Set<string>();

		for (const itemData of items) {
			if (itemData.extractionBuildings) {
				itemData.extractionBuildings.forEach((className) => allBuildingClassNames.add(className));
			}
			if (itemData.fuelGenerators) {
				itemData.fuelGenerators.forEach((className) => allBuildingClassNames.add(className));
			}
		}

		if (allBuildingClassNames.size === 0) {
			// No building associations to process
			return;
		}

		// Get the moduleId from the moduleVersionId
		const [moduleVersion] = await db
			.select()
			.from(moduleVersions)
			.where(eq(moduleVersions.id, moduleVersionId));

		if (!moduleVersion) {
			results.errors.push(`Module version ${moduleVersionId} not found for building resolution`);
			return;
		}

		// Resolve all building classNames to IDs in one query
		const buildingClassNamesArray = Array.from(allBuildingClassNames);
		const buildingIdMap = await itemService.getBuildingIdsByClassNames(
			buildingClassNamesArray,
			moduleVersion.moduleId
		);

		// Process each item's building associations
		for (const itemData of items) {
			const item = existingItemsMap.get(itemData.className);
			if (!item) {
				// Item should exist at this point, skip if not found
				continue;
			}

			// Get the item version ID for this module version
			const itemVersion = await itemService.getItemVersionByModuleAndItem(item.id, moduleVersionId);

			if (!itemVersion) {
				results.errors.push(`Could not find item version for ${itemData.className}`);
				continue;
			}

			try {
				// Process extraction building associations
				if (itemData.extractionBuildings && itemData.extractionBuildings.length > 0) {
					const extractionBuildingIds: string[] = [];
					const missingClassNames: string[] = [];

					for (const className of itemData.extractionBuildings) {
						const buildingId = buildingIdMap.get(className);
						if (buildingId) {
							extractionBuildingIds.push(buildingId);
						} else {
							missingClassNames.push(className);
						}
					}

					if (extractionBuildingIds.length > 0) {
						await itemService.addItemExtractionBuildings(itemVersion.id, extractionBuildingIds);
					}

					if (missingClassNames.length > 0) {
						results.errors.push(
							`Item ${itemData.className}: extraction buildings not found: ${missingClassNames.join(', ')}`
						);
					}
				}

				// Process fuel generator associations
				if (itemData.fuelGenerators && itemData.fuelGenerators.length > 0) {
					const fuelGeneratorIds: string[] = [];
					const missingClassNames: string[] = [];

					for (const className of itemData.fuelGenerators) {
						const buildingId = buildingIdMap.get(className);
						if (buildingId) {
							fuelGeneratorIds.push(buildingId);
						} else {
							missingClassNames.push(className);
						}
					}

					if (fuelGeneratorIds.length > 0) {
						await itemService.addItemFuelGenerators(itemVersion.id, fuelGeneratorIds);
					}

					if (missingClassNames.length > 0) {
						results.errors.push(
							`Item ${itemData.className}: fuel generators not found: ${missingClassNames.join(', ')}`
						);
					}
				}
			} catch (error) {
				results.errors.push(
					`Failed to process building associations for ${itemData.className}: ${error}`
				);
			}
		}
	}
}

export const archiveItemService: IArchiveItemService = new ArchiveItemService(archiveService);
