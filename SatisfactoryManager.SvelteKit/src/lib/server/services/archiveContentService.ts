import { archiveItemService, type ArchiveImportResult } from './archiveItemService';
import { archiveBuildingService, type ArchiveBuildingImportResult } from './archiveBuildingService';
import { archiveRecipeService, type ArchiveRecipeImportResult } from './archiveRecipeService';

// Combined result interface for items, buildings, and recipes
export interface ArchiveContentImportResult {
	items: {
		totalItems: number;
		validItems: number;
		created: number;
		updated: number;
		versionsCreated: number;
	};
	buildings: {
		totalBuildings: number;
		validBuildings: number;
		created: number;
		updated: number;
		versionsCreated: number;
	};
	recipes: {
		totalRecipes: number;
		validRecipes: number;
		created: number;
		updated: number;
		versionsCreated: number;
	};
	errors: string[];
	summary: {
		totalProcessed: number;
		totalCreated: number;
		totalUpdated: number;
		totalVersionsCreated: number;
		totalErrors: number;
	};
}

export interface IArchiveContentService {
	importContentFromArchive(
		archiveUrl: string,
		moduleVersionId: string
	): Promise<ArchiveContentImportResult>;
}

class ArchiveContentService implements IArchiveContentService {
	/**
	 * Downloads an archive and imports items, buildings, and recipes
	 * @param archiveUrl URL of the archive to download
	 * @param moduleVersionId Module version to associate content with
	 * @returns Combined import results with statistics
	 */
	async importContentFromArchive(
		archiveUrl: string,
		moduleVersionId: string
	): Promise<ArchiveContentImportResult> {
		const result: ArchiveContentImportResult = {
			items: {
				totalItems: 0,
				validItems: 0,
				created: 0,
				updated: 0,
				versionsCreated: 0
			},
			buildings: {
				totalBuildings: 0,
				validBuildings: 0,
				created: 0,
				updated: 0,
				versionsCreated: 0
			},
			recipes: {
				totalRecipes: 0,
				validRecipes: 0,
				created: 0,
				updated: 0,
				versionsCreated: 0
			},
			errors: [],
			summary: {
				totalProcessed: 0,
				totalCreated: 0,
				totalUpdated: 0,
				totalVersionsCreated: 0,
				totalErrors: 0
			}
		};

		// Import items first
		try {
			console.log('Starting items import from archive:', archiveUrl);
			const itemsResult = await archiveItemService.importItemsFromArchive(
				archiveUrl,
				moduleVersionId
			);

			result.items = {
				totalItems: itemsResult.totalItems,
				validItems: itemsResult.validItems,
				created: itemsResult.importResults.created,
				updated: itemsResult.importResults.updated,
				versionsCreated: itemsResult.importResults.versionsCreated
			};

			result.errors.push(...itemsResult.importResults.errors);
			console.log('Items import completed:', {
				total: itemsResult.totalItems,
				created: itemsResult.importResults.created,
				updated: itemsResult.importResults.updated,
				versionsCreated: itemsResult.importResults.versionsCreated,
				errors: itemsResult.importResults.errors.length
			});
		} catch (error) {
			const errorMessage = `Failed to import items: ${error}`;
			console.error(errorMessage);
			result.errors.push(errorMessage);
		}

		// Import buildings second
		try {
			console.log('Starting buildings import from archive:', archiveUrl);
			const buildingsResult = await archiveBuildingService.importBuildingsFromArchive(
				archiveUrl,
				moduleVersionId
			);

			result.buildings = {
				totalBuildings: buildingsResult.totalBuildings,
				validBuildings: buildingsResult.validBuildings,
				created: buildingsResult.importResults.created,
				updated: buildingsResult.importResults.updated,
				versionsCreated: buildingsResult.importResults.versionsCreated
			};

			result.errors.push(...buildingsResult.importResults.errors);
			console.log('Buildings import completed:', {
				total: buildingsResult.totalBuildings,
				created: buildingsResult.importResults.created,
				updated: buildingsResult.importResults.updated,
				versionsCreated: buildingsResult.importResults.versionsCreated,
				errors: buildingsResult.importResults.errors.length
			});
		} catch (error) {
			const errorMessage = `Failed to import buildings: ${error}`;
			console.error(errorMessage);
			result.errors.push(errorMessage);
		}

		// Import recipes third (depends on items and buildings)
		try {
			console.log('Starting recipes import from archive:', archiveUrl);
			const recipesResult = await archiveRecipeService.importRecipesFromArchive(
				archiveUrl,
				moduleVersionId
			);

			result.recipes = {
				totalRecipes: recipesResult.totalRecipes,
				validRecipes: recipesResult.validRecipes,
				created: recipesResult.importResults.created,
				updated: recipesResult.importResults.updated,
				versionsCreated: recipesResult.importResults.versionsCreated
			};

			result.errors.push(...recipesResult.importResults.errors);
			console.log('Recipes import completed:', {
				total: recipesResult.totalRecipes,
				created: recipesResult.importResults.created,
				updated: recipesResult.importResults.updated,
				versionsCreated: recipesResult.importResults.versionsCreated,
				errors: recipesResult.importResults.errors.length
			});
		} catch (error) {
			const errorMessage = `Failed to import recipes: ${error}`;
			console.error(errorMessage);
			result.errors.push(errorMessage);
		}

		// Calculate summary statistics
		result.summary = {
			totalProcessed:
				result.items.totalItems + result.buildings.totalBuildings + result.recipes.totalRecipes,
			totalCreated: result.items.created + result.buildings.created + result.recipes.created,
			totalUpdated: result.items.updated + result.buildings.updated + result.recipes.updated,
			totalVersionsCreated:
				result.items.versionsCreated +
				result.buildings.versionsCreated +
				result.recipes.versionsCreated,
			totalErrors: result.errors.length
		};

		console.log('Archive content import summary:', result.summary);

		return result;
	}
}

export const archiveContentService: IArchiveContentService = new ArchiveContentService();
