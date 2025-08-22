import * as yaml from 'js-yaml';
import { archiveService, type IArchiveService } from './archiveService';
import { itemService } from './itemService';
import { yamlValidationService } from './yamlValidationService';
import type { Item } from '../db/schema';

// Interface for items as they appear in the Satisfactory mod archive YAML files
interface ArchiveItemData {
	className: string;
	displayName: string;
	description?: string;
	form: 'RF_SOLID' | 'RF_LIQUID' | 'RF_GAS';
	energyValue?: number;
	stackSize?: number;
	radioactiveDecay?: number;
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
			energyValue: archiveItem.energyValue || undefined
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
		} catch (error) {
			results.errors.push(`Bulk import failed: ${error}`);
		}

		return results;
	}
}

export const archiveItemService: IArchiveItemService = new ArchiveItemService(archiveService);
