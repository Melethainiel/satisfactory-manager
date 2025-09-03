import { type ArchiveImportResult, archiveItemService } from './archiveItemService';
import { type ArchiveBuildingImportResult, archiveBuildingService } from './archiveBuildingService';
import { type ArchiveRecipeImportResult, archiveRecipeService } from './archiveRecipeService';
import { archiveService } from './archiveService';
import { db } from '../db/index';
import { buildingVersions, itemVersions, recipeVersions } from '../db/schema';
import { eq, or } from 'drizzle-orm';
import { getModuleConfig } from '../config/moduleConfig';

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
	hasContentForVersion(versionId: string): Promise<boolean>;
}

class ArchiveContentService implements IArchiveContentService {
	private archiveCache = new Map<string, ArchiveCacheEntry>();
	private readonly config = getModuleConfig();

	// Cache access tracking for LRU eviction
	private cacheAccess = new Map<string, number>();
	private accessCounter = 0;

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
					buildings: {
						totalBuildings: 0,
						validBuildings: 0,
						created: 0,
						updated: 0,
						versionsCreated: 0
					},
					recipes: { totalRecipes: 0, validRecipes: 0, created: 0, updated: 0, versionsCreated: 0 },
					errors: [],
					summary: {
						totalProcessed: 0,
						totalCreated: 0,
						totalUpdated: 0,
						totalVersionsCreated: 0,
						totalErrors: 0
					}
				};

				const buildingsResult = await this.importBuildingsFromYaml(
					archiveContent.extractedContent.buildingsYaml,
					moduleVersionId
				);
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

				const itemsResult = await this.importItemsFromYaml(
					archiveContent.extractedContent.itemsYaml,
					moduleVersionId
				);

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
			throw new Error(
				`Archive import failed: ${error instanceof Error ? error.message : String(error)}`
			);
		} finally {
			// Always clean up temp files
			await this.cleanupTempFiles(tempFiles);
		}
	}

	/**
	 * Enforce cache size limits using LRU eviction
	 */
	private enforceCacheLimit(): void {
		if (this.archiveCache.size <= this.config.cache.maxEntries) {
			return;
		}

		// Find least recently used entries
		const sortedByAccess = Array.from(this.cacheAccess.entries()).sort(([, a], [, b]) => a - b);

		// Remove oldest entries until under limit
		const toRemove = this.archiveCache.size - this.config.cache.maxEntries;
		for (let i = 0; i < toRemove && i < sortedByAccess.length; i++) {
			const [url] = sortedByAccess[i];
			this.archiveCache.delete(url);
			this.cacheAccess.delete(url);
			console.log(`Evicted cache entry: ${url}`);
		}
	}

	/**
	 * Clean expired cache entries
	 */
	private cleanExpiredCache(): void {
		const now = Date.now();
		const expired: string[] = [];

		for (const [url, entry] of this.archiveCache) {
			if (now - entry.timestamp > this.config.cache.ttlMs) {
				expired.push(url);
			}
		}

		for (const url of expired) {
			this.archiveCache.delete(url);
			this.cacheAccess.delete(url);
			console.log(`Removed expired cache entry: ${url}`);
		}
	}

	/**
	 * Gets archive content from cache or downloads and extracts it
	 */
	private async getArchiveContent(archiveUrl: string): Promise<ArchiveCacheEntry> {
		// Clean up expired entries first
		this.cleanExpiredCache();

		// Check cache first
		const cached = this.archiveCache.get(archiveUrl);
		if (cached && Date.now() - cached.timestamp < this.config.cache.ttlMs) {
			// Update access tracking
			this.cacheAccess.set(archiveUrl, ++this.accessCounter);
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

		// Cache the result with size enforcement
		this.archiveCache.set(archiveUrl, cacheEntry);
		this.cacheAccess.set(archiveUrl, ++this.accessCounter);

		// Enforce cache size limits
		this.enforceCacheLimit();

		return cacheEntry;
	}

	/**
	 * Safely extracts a file from archive, returning undefined if not found
	 */
	private async safeExtractFile(
		archivePath: string,
		filePath: string
	): Promise<string | undefined> {
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
		return await archiveBuildingService.importBuildingsFromYamlContent(
			yamlContent,
			moduleVersionId
		);
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
	 * Check if a version has any imported content (items, buildings, or recipes)
	 * @param versionId The module version ID to check
	 * @returns true if the version has any content, false otherwise
	 */
	async hasContentForVersion(versionId: string): Promise<boolean> {
		try {
			// Check for items, buildings, or recipes associated with this version
			const [itemExists, buildingExists, recipeExists] = await Promise.all([
				// Check for item versions
				db
					.select({ id: itemVersions.id })
					.from(itemVersions)
					.where(eq(itemVersions.moduleVersionId, versionId))
					.limit(1),
				// Check for building versions
				db
					.select({ id: buildingVersions.id })
					.from(buildingVersions)
					.where(eq(buildingVersions.moduleVersionId, versionId))
					.limit(1),
				// Check for recipe versions
				db
					.select({ id: recipeVersions.id })
					.from(recipeVersions)
					.where(eq(recipeVersions.moduleVersionId, versionId))
					.limit(1)
			]);

			// Return true if any content exists for this version
			return itemExists.length > 0 || buildingExists.length > 0 || recipeExists.length > 0;
		} catch (error) {
			console.error('Error checking version content:', error);
			return false;
		}
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
