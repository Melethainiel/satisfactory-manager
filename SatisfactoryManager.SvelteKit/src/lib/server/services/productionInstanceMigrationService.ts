import { db } from '../db';
import {
	productionInstances,
	sites,
	moduleGames,
	itemVersions,
	items,
	buildingVersions,
	buildings,
	recipeVersions,
	recipes,
	type ProductionInstance
} from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { productionCalculationService } from './productionCalculationService';

export interface MigrationResult {
	success: boolean;
	migratedInstancesCount: number;
	failedInstancesCount: number;
	failedInstances: Array<{
		id: string;
		reason: string;
		siteName: string;
		buildingName?: string;
		recipeName?: string;
		extractedItemName?: string;
		fuelItemName?: string;
	}>;
	warnings: string[];
}

export interface IProductionInstanceMigrationService {
	migrateProductionInstancesForGameModule(
		gameId: string,
		moduleId: string,
		newVersionId: string
	): Promise<MigrationResult>;
}

class ProductionInstanceMigrationService implements IProductionInstanceMigrationService {
	async migrateProductionInstancesForGameModule(
		gameId: string,
		moduleId: string,
		newVersionId: string
	): Promise<MigrationResult> {
		const result: MigrationResult = {
			success: true,
			migratedInstancesCount: 0,
			failedInstancesCount: 0,
			failedInstances: [],
			warnings: []
		};

		try {
			// Get all production instances for sites in this game that reference items/buildings/recipes from this module
			const affectedInstances = await this.getAffectedProductionInstances(gameId, moduleId);

			if (affectedInstances.length === 0) {
				result.warnings.push('No production instances found that need migration');
				return result;
			}

			result.warnings.push(`Found ${affectedInstances.length} production instances to migrate`);

			// Process each instance
			for (const instance of affectedInstances) {
				try {
					const migrationSuccess = await this.migrateInstance(instance, newVersionId);
					if (migrationSuccess.success) {
						result.migratedInstancesCount++;
					} else {
						result.failedInstancesCount++;
						result.failedInstances.push(migrationSuccess.failedInstance!);
					}
				} catch (error) {
					console.error(`Failed to migrate instance ${instance.id}:`, error);
					result.failedInstancesCount++;
					result.failedInstances.push({
						id: instance.id,
						reason: 'Unexpected error during migration',
						siteName: instance.siteName,
						buildingName: instance.buildingName || undefined,
						recipeName: instance.recipeName || undefined,
						extractedItemName: instance.extractedItemName || undefined,
						fuelItemName: instance.fuelItemName || undefined
					});
				}
			}

			// Invalidate cache for all affected sites (sequential processing to avoid race conditions)
			const uniqueSiteIds = [...new Set(affectedInstances.map((i) => i.siteId))];
			for (const siteId of uniqueSiteIds) {
				try {
					await productionCalculationService.onProductionInstanceChanged(siteId);
				} catch (cacheError) {
					console.error(`Failed to invalidate cache for site ${siteId}:`, cacheError);
					// Continue with other sites even if one fails
				}
			}

			result.success = result.failedInstancesCount === 0;
			return result;
		} catch (error) {
			console.error('Error during production instance migration:', error);
			result.success = false;
			result.failedInstances.push({
				id: 'unknown',
				reason: 'Global migration error',
				siteName: 'unknown'
			});
			return result;
		}
	}

	private async getAffectedProductionInstances(gameId: string, moduleId: string) {
		// Get all production instances in sites for this game
		const extractedItems = alias(items, 'extracted_items');
		const extractedItemVersions = alias(itemVersions, 'extracted_item_versions');
		const fuelItems = alias(items, 'fuel_items');
		const fuelItemVersions = alias(itemVersions, 'fuel_item_versions');

		const query = await db
			.select({
				id: productionInstances.id,
				siteId: productionInstances.siteId,
				recipeVersionId: productionInstances.recipeVersionId,
				buildingVersionId: productionInstances.buildingVersionId,
				extractedItemVersionId: productionInstances.extractedItemVersionId,
				fuelItemVersionId: productionInstances.fuelItemVersionId,
				buildingCount: productionInstances.buildingCount,
				efficiencyRatio: productionInstances.efficiencyRatio,
				extractorPurity: productionInstances.extractorPurity,
				notes: productionInstances.notes,
				siteName: sites.name,
				buildingName: buildings.name,
				buildingClassName: buildings.className,
				recipeName: recipes.displayName,
				recipeClassName: recipes.className,
				extractedItemName: extractedItems.displayName,
				extractedItemClassName: extractedItems.className,
				fuelItemName: fuelItems.displayName,
				fuelItemClassName: fuelItems.className
			})
			.from(productionInstances)
			.innerJoin(sites, eq(productionInstances.siteId, sites.id))
			.leftJoin(buildingVersions, eq(productionInstances.buildingVersionId, buildingVersions.id))
			.leftJoin(buildings, eq(buildingVersions.buildingId, buildings.id))
			.leftJoin(recipeVersions, eq(productionInstances.recipeVersionId, recipeVersions.id))
			.leftJoin(recipes, eq(recipeVersions.recipeId, recipes.id))
			.leftJoin(
				extractedItemVersions,
				eq(productionInstances.extractedItemVersionId, extractedItemVersions.id)
			)
			.leftJoin(extractedItems, eq(extractedItemVersions.itemId, extractedItems.id))
			.leftJoin(fuelItemVersions, eq(productionInstances.fuelItemVersionId, fuelItemVersions.id))
			.leftJoin(fuelItems, eq(fuelItemVersions.itemId, fuelItems.id))
			.where(eq(sites.gameId, gameId));

		// Filter to only instances that actually reference items/buildings from this module
		const filteredInstances = [];
		for (const instance of query) {
			const referencesModule = await this.instanceReferencesModule(instance, moduleId);
			if (referencesModule) {
				filteredInstances.push(instance);
			}
		}

		return filteredInstances;
	}

	private async instanceReferencesModule(instance: any, moduleId: string): Promise<boolean> {
		// Check if building belongs to this module
		if (instance.buildingVersionId) {
			const buildingModule = await db
				.select({ moduleId: buildings.moduleId })
				.from(buildings)
				.innerJoin(buildingVersions, eq(buildings.id, buildingVersions.buildingId))
				.where(eq(buildingVersions.id, instance.buildingVersionId))
				.limit(1);

			if (buildingModule.length > 0 && buildingModule[0].moduleId === moduleId) {
				return true;
			}
		}

		// Check if recipe belongs to this module
		if (instance.recipeVersionId) {
			const recipeModule = await db
				.select({ moduleId: recipes.moduleId })
				.from(recipes)
				.innerJoin(recipeVersions, eq(recipes.id, recipeVersions.recipeId))
				.where(eq(recipeVersions.id, instance.recipeVersionId))
				.limit(1);

			if (recipeModule.length > 0 && recipeModule[0].moduleId === moduleId) {
				return true;
			}
		}

		// Check if extracted item belongs to this module
		if (instance.extractedItemVersionId) {
			const itemModule = await db
				.select({ moduleId: items.moduleId })
				.from(items)
				.innerJoin(itemVersions, eq(items.id, itemVersions.itemId))
				.where(eq(itemVersions.id, instance.extractedItemVersionId))
				.limit(1);

			if (itemModule.length > 0 && itemModule[0].moduleId === moduleId) {
				return true;
			}
		}

		// Check if fuel item belongs to this module
		if (instance.fuelItemVersionId) {
			const itemModule = await db
				.select({ moduleId: items.moduleId })
				.from(items)
				.innerJoin(itemVersions, eq(items.id, itemVersions.itemId))
				.where(eq(itemVersions.id, instance.fuelItemVersionId))
				.limit(1);

			if (itemModule.length > 0 && itemModule[0].moduleId === moduleId) {
				return true;
			}
		}

		return false;
	}

	private async migrateInstance(
		instance: any,
		newVersionId: string
	): Promise<{
		success: boolean;
		failedInstance?: {
			id: string;
			reason: string;
			siteName: string;
			buildingName?: string;
			recipeName?: string;
			extractedItemName?: string;
			fuelItemName?: string;
		};
	}> {
		const updates: Partial<ProductionInstance> = {};
		let migrationErrors: string[] = [];

		// Migrate building version
		if (instance.buildingVersionId && instance.buildingClassName) {
			const newBuildingVersion = await this.findNewBuildingVersion(
				instance.buildingClassName,
				newVersionId
			);
			if (newBuildingVersion) {
				updates.buildingVersionId = newBuildingVersion.id;
			} else {
				migrationErrors.push(`Building ${instance.buildingName} not found in new version`);
			}
		}

		// Migrate recipe version
		if (instance.recipeVersionId && instance.recipeClassName) {
			const newRecipeVersion = await this.findNewRecipeVersion(
				instance.recipeClassName,
				newVersionId
			);
			if (newRecipeVersion) {
				updates.recipeVersionId = newRecipeVersion.id;
			} else {
				migrationErrors.push(`Recipe ${instance.recipeName} not found in new version`);
			}
		}

		// Migrate extracted item version
		if (instance.extractedItemVersionId && instance.extractedItemClassName) {
			const newItemVersion = await this.findNewItemVersion(
				instance.extractedItemClassName,
				newVersionId
			);
			if (newItemVersion) {
				updates.extractedItemVersionId = newItemVersion.id;
			} else {
				migrationErrors.push(
					`Extracted item ${instance.extractedItemName} not found in new version`
				);
			}
		}

		// Migrate fuel item version
		if (instance.fuelItemVersionId && instance.fuelItemClassName) {
			const newItemVersion = await this.findNewItemVersion(
				instance.fuelItemClassName,
				newVersionId
			);
			if (newItemVersion) {
				updates.fuelItemVersionId = newItemVersion.id;
			} else {
				migrationErrors.push(`Fuel item ${instance.fuelItemName} not found in new version`);
			}
		}

		// If we have errors, return failure
		if (migrationErrors.length > 0) {
			return {
				success: false,
				failedInstance: {
					id: instance.id,
					reason: migrationErrors.join(', '),
					siteName: instance.siteName,
					buildingName: instance.buildingName || undefined,
					recipeName: instance.recipeName || undefined,
					extractedItemName: instance.extractedItemName || undefined,
					fuelItemName: instance.fuelItemName || undefined
				}
			};
		}

		// If we have updates to make, apply them
		if (Object.keys(updates).length > 0) {
			updates.updatedAt = new Date();
			await db
				.update(productionInstances)
				.set(updates)
				.where(eq(productionInstances.id, instance.id));
		}

		return { success: true };
	}

	private async findNewBuildingVersion(buildingClassName: string, newVersionId: string) {
		const result = await db
			.select({
				id: buildingVersions.id
			})
			.from(buildingVersions)
			.innerJoin(buildings, eq(buildingVersions.buildingId, buildings.id))
			.where(
				and(
					eq(buildings.className, buildingClassName),
					eq(buildingVersions.moduleVersionId, newVersionId)
				)
			)
			.limit(1);

		return result.length > 0 ? result[0] : null;
	}

	private async findNewRecipeVersion(recipeClassName: string, newVersionId: string) {
		const result = await db
			.select({
				id: recipeVersions.id
			})
			.from(recipeVersions)
			.innerJoin(recipes, eq(recipeVersions.recipeId, recipes.id))
			.where(
				and(
					eq(recipes.className, recipeClassName),
					eq(recipeVersions.moduleVersionId, newVersionId)
				)
			)
			.limit(1);

		return result.length > 0 ? result[0] : null;
	}

	private async findNewItemVersion(itemClassName: string, newVersionId: string) {
		const result = await db
			.select({
				id: itemVersions.id
			})
			.from(itemVersions)
			.innerJoin(items, eq(itemVersions.itemId, items.id))
			.where(
				and(eq(items.className, itemClassName), eq(itemVersions.moduleVersionId, newVersionId))
			)
			.limit(1);

		return result.length > 0 ? result[0] : null;
	}
}

export const productionInstanceMigrationService = new ProductionInstanceMigrationService();
