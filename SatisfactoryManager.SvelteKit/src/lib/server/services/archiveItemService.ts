import * as yaml from 'js-yaml';
import { archiveService, type IArchiveService } from './archiveService';
import { itemService } from './itemService';

// Interface for items as they appear in the Satisfactory mod archive YAML files
interface ArchiveItemData {
	ClassName: string;
	DisplayName: string;
	Description?: string;
	Form: 'RF_SOLID' | 'RF_LIQUID' | 'RF_GAS';
	EnergyValue?: number;
	StackSize?: number;
	RadioactiveDecay?: number;
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
	 * Parses YAML content and converts items to import format
	 * @param yamlContent Raw YAML content string
	 * @returns Array of items in import format
	 */
	async parseItemsYaml(yamlContent: string): Promise<ImportItemData[]> {
		try {
			// Parse YAML
			const parsedYaml: any = yaml.load(yamlContent);

			if (!parsedYaml) {
				throw new Error('Invalid or empty YAML content');
			}

			// Handle different possible YAML structures
			let itemsArray: any[];

			if (Array.isArray(parsedYaml)) {
				// YAML is a direct array of items
				itemsArray = parsedYaml;
			} else if (parsedYaml.items && Array.isArray(parsedYaml.items)) {
				// YAML has an 'items' property containing the array
				itemsArray = parsedYaml.items;
			} else if (parsedYaml.Items && Array.isArray(parsedYaml.Items)) {
				// YAML has 'Items' (capitalized) property containing the array
				itemsArray = parsedYaml.Items;
			} else {
				// Try to find any array property
				const arrayProperty = Object.values(parsedYaml).find((val) => Array.isArray(val));
				if (arrayProperty) {
					itemsArray = arrayProperty as any[];
				} else {
					throw new Error(
						'No items array found in YAML. Expected structure: array of items or {items: [...]}'
					);
				}
			}

			// Validate and convert each item
			const validItems: ImportItemData[] = [];
			const errors: string[] = [];

			for (let i = 0; i < itemsArray.length; i++) {
				const validatedItem = this.validateArchiveItem(itemsArray[i], i);
				if (validatedItem) {
					validItems.push(this.convertToImportFormat(validatedItem));
				} else {
					errors.push(`Invalid item data at index ${i}`);
				}
			}

			if (errors.length > 0) {
				console.warn('Archive item validation errors:', errors);
			}

			return validItems;
		} catch (error) {
			console.error('Error parsing items YAML:', error);
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
				ClassName: className.trim(),
				DisplayName: displayName.trim(),
				Description: description ? String(description).trim() : undefined,
				Form: form as 'RF_SOLID' | 'RF_LIQUID' | 'RF_GAS',
				EnergyValue: validatedEnergyValue,
				StackSize: stackSize ? Number(stackSize) : undefined,
				RadioactiveDecay: radioactiveDecay ? Number(radioactiveDecay) : undefined
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
			className: archiveItem.ClassName,
			displayName: archiveItem.DisplayName,
			description: archiveItem.Description || undefined,
			form: archiveItem.Form,
			energyValue: archiveItem.EnergyValue || undefined
		};
	}

	/**
	 * Uses existing item service to import items in bulk
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

		// Process items in batches to avoid overwhelming the database
		const batchSize = 100;
		for (let i = 0; i < items.length; i += batchSize) {
			const batch = items.slice(i, i + batchSize);

			for (const itemData of batch) {
				try {
					// Check if item exists
					let item = await itemService.getItemByClassName(itemData.className);

					if (!item) {
						// Create new item
						item = await itemService.createItem({
							className: itemData.className,
							displayName: itemData.displayName,
							description: itemData.description || null,
							form: itemData.form
						});
						results.created++;
					} else {
						// Check if item needs updating
						const needsUpdate =
							item.displayName !== itemData.displayName ||
							item.description !== (itemData.description || null) ||
							item.form !== itemData.form;

						if (needsUpdate) {
							item = await itemService.updateItem(item.id, {
								displayName: itemData.displayName,
								description: itemData.description || null,
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
		}

		return results;
	}
}

export const archiveItemService: IArchiveItemService = new ArchiveItemService(archiveService);
