import { archiveItemService, type ArchiveImportResult } from './archiveItemService';
import { archiveBuildingService, type ArchiveBuildingImportResult } from './archiveBuildingService';
import { archiveRecipeService, type ArchiveRecipeImportResult } from './archiveRecipeService';
import { archiveService } from './archiveService';
import { db } from '../db/index';

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

// Cache entry for downloaded archives
interface ArchiveCacheEntry {
	archivePath: string;
	extractedContent: {
		itemsYaml?: string;
		buildingsYaml?: string;
		recipesYaml?: string;
	};
	timestamp: number;
}

// Note: Transaction support will be added when individual services support it

export interface IArchiveContentService {
	importContentFromArchive(
		archiveUrl: string,
		moduleVersionId: string
	): Promise<ArchiveContentImportResult>;
}

class ArchiveContentService implements IArchiveContentService {
	private archiveCache = new Map<string, ArchiveCacheEntry>();
	private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
	
	/**
	 * Downloads an archive and imports items, buildings, and recipes within a single transaction
	 * @param archiveUrl URL of the archive to download
	 * @param moduleVersionId Module version to associate content with
	 * @returns Combined import results with statistics
	 */
	async importContentFromArchive(
		archiveUrl: string,
		moduleVersionId: string
	): Promise<ArchiveContentImportResult> {
		const tempFiles: string[] = [];
		
		try {
			// Execute entire import within a database transaction
			return await db.transaction(async (tx) => {
				console.log('Starting transactional archive import:', archiveUrl);
				
				// Download and extract archive content once
				const archiveContent = await this.getArchiveContent(archiveUrl);
				tempFiles.push(archiveContent.archivePath);
				
				const result: ArchiveContentImportResult = {
					items: { totalItems: 0, validItems: 0, created: 0, updated: 0, versionsCreated: 0 },
					buildings: { totalBuildings: 0, validBuildings: 0, created: 0, updated: 0, versionsCreated: 0 },
					recipes: { totalRecipes: 0, validRecipes: 0, created: 0, updated: 0, versionsCreated: 0 },
					errors: [],
					summary: { totalProcessed: 0, totalCreated: 0, totalUpdated: 0, totalVersionsCreated: 0, totalErrors: 0 }
				};
				
				// Import items and buildings in parallel (no dependencies between them)
				const [itemsResult, buildingsResult] = await Promise.all([
					this.importItemsFromYaml(archiveContent.extractedContent.itemsYaml, moduleVersionId),
					this.importBuildingsFromYaml(archiveContent.extractedContent.buildingsYaml, moduleVersionId)
				]);
				
				// Process items results
				if (itemsResult) {
					result.items = {
						totalItems: itemsResult.totalItems,
						validItems: itemsResult.validItems,
						created: itemsResult.importResults.created,
						updated: itemsResult.importResults.updated,
						versionsCreated: itemsResult.importResults.versionsCreated
					};
					result.errors.push(...itemsResult.importResults.errors);
				}
				
				// Process buildings results
				if (buildingsResult) {
					result.buildings = {
						totalBuildings: buildingsResult.totalBuildings,
						validBuildings: buildingsResult.validBuildings,
						created: buildingsResult.importResults.created,
						updated: buildingsResult.importResults.updated,
						versionsCreated: buildingsResult.importResults.versionsCreated
					};
					result.errors.push(...buildingsResult.importResults.errors);
				}
				
				// Import recipes after items and buildings (has dependencies)
				const recipesResult = await this.importRecipesFromYaml(
					archiveContent.extractedContent.recipesYaml, 
					moduleVersionId
				);
				
				if (recipesResult) {
					result.recipes = {
						totalRecipes: recipesResult.totalRecipes,
						validRecipes: recipesResult.validRecipes,
						created: recipesResult.importResults.created,
						updated: recipesResult.importResults.updated,
						versionsCreated: recipesResult.importResults.versionsCreated
					};
					result.errors.push(...recipesResult.importResults.errors);
				}
				
				// Calculate summary statistics
				result.summary = {
					totalProcessed: result.items.totalItems + result.buildings.totalBuildings + result.recipes.totalRecipes,
					totalCreated: result.items.created + result.buildings.created + result.recipes.created,
					totalUpdated: result.items.updated + result.buildings.updated + result.recipes.updated,
					totalVersionsCreated: result.items.versionsCreated + result.buildings.versionsCreated + result.recipes.versionsCreated,
					totalErrors: result.errors.length
				};
				
				console.log('Transactional archive content import completed:', result.summary);
				
				// If we reach here, transaction will commit automatically
				return result;
			});
			
		} catch (error) {
			// Transaction automatically rolls back on error
			console.error('Archive import failed, transaction rolled back:', error);
			
			// Clean up temporary files
			await this.cleanupTempFiles(tempFiles);
			
			// Re-throw with enhanced context
			throw new Error(`Archive import failed: ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			// Always clean up temp files
			await this.cleanupTempFiles(tempFiles);
		}
	}
	
	/**
	 * Gets archive content from cache or downloads and extracts it
	 */
	private async getArchiveContent(archiveUrl: string): Promise<ArchiveCacheEntry> {
		// Check cache first
		const cached = this.archiveCache.get(archiveUrl);
		if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
			console.log('Using cached archive:', archiveUrl);
			return cached;
		}
		
		// Download and extract archive
		console.log('Downloading and extracting archive:', archiveUrl);
		const archivePath = await archiveService.downloadArchive(archiveUrl);
		
		// Extract all required files in parallel
		const [itemsYaml, buildingsYaml, recipesYaml] = await Promise.all([
			this.safeExtractFile(archivePath, 'Files/items.yaml'),
			this.safeExtractFile(archivePath, 'Files/buildings.yaml'),
			this.safeExtractFile(archivePath, 'Files/recipes.yaml')
		]);
		
		const cacheEntry: ArchiveCacheEntry = {
			archivePath,
			extractedContent: {
				itemsYaml,
				buildingsYaml,
				recipesYaml
			},
			timestamp: Date.now()
		};
		
		// Cache the result
		this.archiveCache.set(archiveUrl, cacheEntry);
		
		return cacheEntry;
	}
	
	/**
	 * Safely extracts a file from archive, returning undefined if not found
	 */
	private async safeExtractFile(archivePath: string, filePath: string): Promise<string | undefined> {
		try {
			const result = await archiveService.extractFileFromArchive(archivePath, filePath);
			return result === null ? undefined : result;
		} catch (error) {
			console.warn(`File ${filePath} not found in archive, skipping:`, error);
			return undefined;
		}
	}
	
	/**
	 * Imports items from YAML content
	 */
	private async importItemsFromYaml(
		yamlContent: string | undefined, 
		moduleVersionId: string
	): Promise<ArchiveImportResult | null> {
		if (!yamlContent) {
			console.log('No items.yaml content found, skipping items import');
			return null;
		}
		
		console.log('Importing items from YAML content');
		// TODO: This will need to be updated when we add transaction support to archiveItemService
		return await archiveItemService.importItemsFromYamlContent(yamlContent, moduleVersionId);
	}
	
	/**
	 * Imports buildings from YAML content
	 */
	private async importBuildingsFromYaml(
		yamlContent: string | undefined, 
		moduleVersionId: string
	): Promise<ArchiveBuildingImportResult | null> {
		if (!yamlContent) {
			console.log('No buildings.yaml content found, skipping buildings import');
			return null;
		}
		
		console.log('Importing buildings from YAML content');
		// TODO: This will need to be updated when we add transaction support to archiveBuildingService
		return await archiveBuildingService.importBuildingsFromYamlContent(yamlContent, moduleVersionId);
	}
	
	/**
	 * Imports recipes from YAML content
	 */
	private async importRecipesFromYaml(
		yamlContent: string | undefined, 
		moduleVersionId: string
	): Promise<ArchiveRecipeImportResult | null> {
		if (!yamlContent) {
			console.log('No recipes.yaml content found, skipping recipes import');
			return null;
		}
		
		console.log('Importing recipes from YAML content');
		// TODO: This will need to be updated when we add transaction support to archiveRecipeService
		return await archiveRecipeService.importRecipesFromYamlContent(yamlContent, moduleVersionId);
	}
	
	/**
	 * Cleans up temporary files
	 */
	private async cleanupTempFiles(tempFiles: string[]): Promise<void> {
		try {
			await archiveService.cleanup(tempFiles);
		} catch (error) {
			console.warn('Failed to cleanup temp files:', tempFiles, error);
		}
	}
}

export const archiveContentService: IArchiveContentService = new ArchiveContentService();
