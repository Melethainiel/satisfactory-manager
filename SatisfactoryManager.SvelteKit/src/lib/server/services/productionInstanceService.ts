import { db } from '../db';
import {
	productionInstances,
	sites,
	recipeVersions,
	recipes,
	buildings,
	buildingVersions,
	recipeProducts,
	recipeIngredients,
	items,
	moduleGames,
	modules,
	type ProductionInstance,
	type NewProductionInstance
} from '../db/schema';
import { alias } from 'drizzle-orm/pg-core';
import { eq, desc, and } from 'drizzle-orm';
import { productionCalculationService } from './productionCalculationService';

export interface ProductionInstanceWithDetails extends ProductionInstance {
	site: {
		id: string;
		name: string;
		gameId: string;
	};
	recipe: {
		id: string;
		displayName: string;
		className: string;
	} | null;
	recipeVersion: {
		id: string;
		manufacturingDuration: string;
	} | null;
	building: {
		id: string;
		name: string;
		className: string;
		type: string;
	};
	buildingVersion: {
		id: string;
		output: string;
		energyConsumption: string;
		energyProduction: string;
	} | null;
	fuelItem: {
		id: string;
		displayName: string;
		className: string;
		form: string;
	} | null;
	products: Array<{
		itemId: string;
		count: string;
		item: {
			displayName: string;
			className: string;
			form: string;
		};
	}>;
	ingredients: Array<{
		itemId: string;
		count: string;
		item: {
			displayName: string;
			className: string;
			form: string;
		};
	}>;
}

export interface ProductionCalculation {
	itemsPerMinute: number;
	totalProduction: number;
	buildingUtilization: number;
	powerConsumption?: number;
}

export interface IProductionInstanceService {
	// CRUD operations
	getAllProductionInstances(): Promise<ProductionInstance[]>;
	getProductionInstanceById(id: string): Promise<ProductionInstanceWithDetails | undefined>;
	createProductionInstance(
		data: Omit<NewProductionInstance, 'id' | 'createdAt' | 'updatedAt'>
	): Promise<ProductionInstance>;
	updateProductionInstance(
		id: string,
		data: Partial<Omit<NewProductionInstance, 'id' | 'createdAt' | 'updatedAt'>>
	): Promise<ProductionInstance | undefined>;
	deleteProductionInstance(id: string): Promise<boolean>;

	// Validation
	validateProductionInstanceData(
		data: Omit<NewProductionInstance, 'id' | 'createdAt' | 'updatedAt'>
	): Promise<{
		isValid: boolean;
		errors: string[];
	}>;
}

class ProductionInstanceService implements IProductionInstanceService {
	async getAllProductionInstances(): Promise<ProductionInstance[]> {
		return db.select().from(productionInstances).orderBy(desc(productionInstances.createdAt));
	}

	async getProductionInstanceById(id: string): Promise<ProductionInstanceWithDetails | undefined> {
		const fuelItems = alias(items, 'fuel_items');
		const result = await db
			.select({
				// Production instance fields
				id: productionInstances.id,
				siteId: productionInstances.siteId,
				recipeVersionId: productionInstances.recipeVersionId,
				buildingId: productionInstances.buildingId,
				extractedItemId: productionInstances.extractedItemId,
				fuelItemId: productionInstances.fuelItemId,
				buildingCount: productionInstances.buildingCount,
				efficiencyRatio: productionInstances.efficiencyRatio,
				notes: productionInstances.notes,
				createdAt: productionInstances.createdAt,
				updatedAt: productionInstances.updatedAt,
				// Related data
				site: {
					id: sites.id,
					name: sites.name,
					gameId: sites.gameId
				},
				recipe: {
					id: recipes.id,
					displayName: recipes.displayName,
					className: recipes.className
				},
				recipeVersion: {
					id: recipeVersions.id,
					manufacturingDuration: recipeVersions.manufacturingDuration
				},
				building: {
					id: buildings.id,
					name: buildings.name,
					className: buildings.className,
					type: buildings.type
				},
				buildingVersion: {
					id: buildingVersions.id,
					output: buildingVersions.output,
					energyConsumption: buildingVersions.energyConsumption,
					energyProduction: buildingVersions.energyProduction
				},
				fuelItem: {
					id: fuelItems.id,
					displayName: fuelItems.displayName,
					className: fuelItems.className,
					form: fuelItems.form
				}
			})
			.from(productionInstances)
			.leftJoin(sites, eq(productionInstances.siteId, sites.id))
			.leftJoin(recipeVersions, eq(productionInstances.recipeVersionId, recipeVersions.id))
			.leftJoin(recipes, eq(recipeVersions.recipeId, recipes.id))
			.leftJoin(buildings, eq(productionInstances.buildingId, buildings.id))
			.leftJoin(modules, eq(buildings.moduleId, modules.id))
			.leftJoin(
				moduleGames,
				and(eq(moduleGames.moduleId, modules.id), eq(moduleGames.gameId, sites.gameId))
			)
			.leftJoin(
				buildingVersions,
				and(
					eq(buildingVersions.buildingId, buildings.id),
					eq(buildingVersions.moduleVersionId, moduleGames.selectedVersionId)
				)
			)
			.leftJoin(
				fuelItems,
				eq(productionInstances.fuelItemId, fuelItems.id)
			)
			.where(eq(productionInstances.id, id))
			.limit(1);

		if (result.length === 0) return undefined;

		const instanceData = result[0];

		// Get products and ingredients
		let products: Array<{
			itemId: string;
			count: string;
			item: {
				displayName: string;
				className: string;
				form: string;
			};
		}> = [];
		let ingredients: Array<{
			itemId: string;
			count: string;
			item: {
				displayName: string;
				className: string;
				form: string;
			};
		}> = [];

		if (instanceData.recipeVersionId) {
			// For crafting instances - get products and ingredients from recipe
			[products, ingredients] = await Promise.all([
				db
					.select({
						itemId: recipeProducts.itemId,
						count: recipeProducts.count,
						item: {
							displayName: items.displayName,
							className: items.className,
							form: items.form
						}
					})
					.from(recipeProducts)
					.innerJoin(items, eq(recipeProducts.itemId, items.id))
					.where(eq(recipeProducts.recipeVersionId, instanceData.recipeVersionId)),

				db
					.select({
						itemId: recipeIngredients.itemId,
						count: recipeIngredients.count,
						item: {
							displayName: items.displayName,
							className: items.className,
							form: items.form
						}
					})
					.from(recipeIngredients)
					.innerJoin(items, eq(recipeIngredients.itemId, items.id))
					.where(eq(recipeIngredients.recipeVersionId, instanceData.recipeVersionId))
			]);
		} else if (instanceData.extractedItemId) {
			// For extraction instances - create synthetic product from extractedItemId
			const extractedItem = await db
				.select({
					id: items.id,
					displayName: items.displayName,
					className: items.className,
					form: items.form
				})
				.from(items)
				.where(eq(items.id, instanceData.extractedItemId))
				.limit(1);

			if (extractedItem.length > 0) {
				products = [
					{
						itemId: extractedItem[0].id,
						count: '1', // Placeholder count for extraction
						item: {
							displayName: extractedItem[0].displayName,
							className: extractedItem[0].className,
							form: extractedItem[0].form
						}
					}
				];
			}
		} else if (instanceData.fuelItemId) {
			// For generator instances - create synthetic ingredient from fuelItemId
			const fuelItem = await db
				.select({
					id: items.id,
					displayName: items.displayName,
					className: items.className,
					form: items.form
				})
				.from(items)
				.where(eq(items.id, instanceData.fuelItemId))
				.limit(1);

			if (fuelItem.length > 0) {
				ingredients = [
					{
						itemId: fuelItem[0].id,
						count: '1', // Placeholder count for fuel
						item: {
							displayName: fuelItem[0].displayName,
							className: fuelItem[0].className,
							form: fuelItem[0].form
						}
					}
				];
			}
		}

		return {
			...instanceData,
			products,
			ingredients
		} as ProductionInstanceWithDetails;
	}

	async createProductionInstance(
		data: Omit<NewProductionInstance, 'id' | 'createdAt' | 'updatedAt'>
	): Promise<ProductionInstance> {
		// Validate data first
		const validation = await this.validateProductionInstanceData(data);
		if (!validation.isValid) {
			throw new Error(`Invalid production instance data: ${validation.errors.join(', ')}`);
		}

		const [result] = await db
			.insert(productionInstances)
			.values({
				...data,
				updatedAt: new Date()
			})
			.returning();

		// Invalidate cache for the site
		if (data.siteId) {
			await productionCalculationService.onProductionInstanceChanged(data.siteId);
		}

		return result;
	}

	async updateProductionInstance(
		id: string,
		data: Partial<Omit<NewProductionInstance, 'id' | 'createdAt' | 'updatedAt'>>
	): Promise<ProductionInstance | undefined> {
		// Get the current instance to know which site to invalidate cache for
		const currentInstance = await db
			.select({ siteId: productionInstances.siteId })
			.from(productionInstances)
			.where(eq(productionInstances.id, id))
			.limit(1);

		const [result] = await db
			.update(productionInstances)
			.set({
				...data,
				updatedAt: new Date()
			})
			.where(eq(productionInstances.id, id))
			.returning();

		// Invalidate cache for the site
		if (currentInstance.length > 0) {
			await productionCalculationService.onProductionInstanceChanged(currentInstance[0].siteId);
		}

		return result;
	}

	async deleteProductionInstance(id: string): Promise<boolean> {
		const result = await db
			.delete(productionInstances)
			.where(eq(productionInstances.id, id))
			.returning({ id: productionInstances.id, siteId: productionInstances.siteId });

		// Invalidate cache for the site
		if (result.length > 0) {
			await productionCalculationService.onProductionInstanceChanged(result[0].siteId);
		}

		return result.length > 0;
	}

	async validateProductionInstanceData(
		data: Omit<NewProductionInstance, 'id' | 'createdAt' | 'updatedAt'>
	): Promise<{
		isValid: boolean;
		errors: string[];
	}> {
		const errors: string[] = [];

		// Check if site exists
		if (data.siteId) {
			const site = await db.select().from(sites).where(eq(sites.id, data.siteId)).limit(1);

			if (site.length === 0) {
				errors.push('Site does not exist');
			}
		}

		// Check if recipe version exists (only if provided - null is allowed for extraction)
		if (data.recipeVersionId) {
			const recipeVersion = await db
				.select()
				.from(recipeVersions)
				.where(eq(recipeVersions.id, data.recipeVersionId))
				.limit(1);

			if (recipeVersion.length === 0) {
				errors.push('Recipe version does not exist');
			}
		}

		// Check if building exists
		if (data.buildingId) {
			const building = await db
				.select()
				.from(buildings)
				.where(eq(buildings.id, data.buildingId))
				.limit(1);

			if (building.length === 0) {
				errors.push('Building does not exist');
			}
		}

		// Validate numeric values
		if (data.buildingCount && parseFloat(data.buildingCount) <= 0) {
			errors.push('Building count must be greater than 0');
		}

		if (
			data.efficiencyRatio &&
			(parseFloat(data.efficiencyRatio) <= 0 || parseFloat(data.efficiencyRatio) > 2.5)
		) {
			errors.push('Efficiency ratio must be between 0 and 2.5');
		}

		return {
			isValid: errors.length === 0,
			errors
		};
	}
}

export const productionInstanceService = new ProductionInstanceService();
