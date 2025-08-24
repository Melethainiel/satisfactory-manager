import { db } from '../db';
import {
	recipeInstances,
	sites,
	recipeVersions,
	recipes,
	buildings,
	recipeProducts,
	recipeIngredients,
	items,
	type RecipeInstance,
	type NewRecipeInstance
} from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';

export interface RecipeInstanceWithDetails extends RecipeInstance {
	site: {
		id: string;
		name: string;
		gameId: string;
	};
	recipe: {
		id: string;
		displayName: string;
		className: string;
	};
	recipeVersion: {
		id: string;
		manufacturingDuration: string;
	};
	building: {
		id: string;
		name: string;
		className: string;
		type: string;
	};
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

export interface IRecipeInstanceService {
	// CRUD operations
	getAllRecipeInstances(): Promise<RecipeInstance[]>;
	getRecipeInstanceById(id: string): Promise<RecipeInstanceWithDetails | undefined>;
	getRecipeInstancesBySite(siteId: string): Promise<RecipeInstanceWithDetails[]>;
	createRecipeInstance(data: Omit<NewRecipeInstance, 'id' | 'createdAt' | 'updatedAt'>): Promise<RecipeInstance>;
	updateRecipeInstance(
		id: string,
		data: Partial<Omit<NewRecipeInstance, 'id' | 'createdAt' | 'updatedAt'>>
	): Promise<RecipeInstance | undefined>;
	deleteRecipeInstance(id: string): Promise<boolean>;

	// Production calculations
	calculateInstanceProduction(instanceId: string): Promise<ProductionCalculation | undefined>;
	calculateSiteProduction(siteId: string): Promise<{
		totalProduction: Array<{ itemId: string; itemName: string; rate: number }>;
		totalConsumption: Array<{ itemId: string; itemName: string; rate: number }>;
		netBalance: Array<{ itemId: string; itemName: string; balance: number }>;
	}>;

	// Validation
	validateRecipeInstanceData(data: Omit<NewRecipeInstance, 'id' | 'createdAt' | 'updatedAt'>): Promise<{
		isValid: boolean;
		errors: string[];
	}>;
}

class RecipeInstanceService implements IRecipeInstanceService {
	async getAllRecipeInstances(): Promise<RecipeInstance[]> {
		return db
			.select()
			.from(recipeInstances)
			.orderBy(desc(recipeInstances.createdAt));
	}

	async getRecipeInstanceById(id: string): Promise<RecipeInstanceWithDetails | undefined> {
		const result = await db
			.select({
				// Recipe instance fields
				id: recipeInstances.id,
				siteId: recipeInstances.siteId,
				recipeVersionId: recipeInstances.recipeVersionId,
				buildingId: recipeInstances.buildingId,
				buildingCount: recipeInstances.buildingCount,
				efficiencyRatio: recipeInstances.efficiencyRatio,
				notes: recipeInstances.notes,
				createdAt: recipeInstances.createdAt,
				updatedAt: recipeInstances.updatedAt,
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
				}
			})
			.from(recipeInstances)
			.leftJoin(sites, eq(recipeInstances.siteId, sites.id))
			.leftJoin(recipeVersions, eq(recipeInstances.recipeVersionId, recipeVersions.id))
			.leftJoin(recipes, eq(recipeVersions.recipeId, recipes.id))
			.leftJoin(buildings, eq(recipeInstances.buildingId, buildings.id))
			.where(eq(recipeInstances.id, id))
			.limit(1);

		if (result.length === 0) return undefined;

		const instanceData = result[0];

		// Get products and ingredients
		const [products, ingredients] = await Promise.all([
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
				.leftJoin(items, eq(recipeProducts.itemId, items.id))
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
				.leftJoin(items, eq(recipeIngredients.itemId, items.id))
				.where(eq(recipeIngredients.recipeVersionId, instanceData.recipeVersionId))
		]);

		return {
			...instanceData,
			products,
			ingredients
		} as RecipeInstanceWithDetails;
	}

	async getRecipeInstancesBySite(siteId: string): Promise<RecipeInstanceWithDetails[]> {
		const instances = await db
			.select()
			.from(recipeInstances)
			.where(eq(recipeInstances.siteId, siteId))
			.orderBy(desc(recipeInstances.createdAt));

		const detailed = await Promise.all(
			instances.map(async (instance) => {
				return this.getRecipeInstanceById(instance.id);
			})
		);

		return detailed.filter((instance): instance is RecipeInstanceWithDetails => instance !== undefined);
	}

	async createRecipeInstance(data: Omit<NewRecipeInstance, 'id' | 'createdAt' | 'updatedAt'>): Promise<RecipeInstance> {
		// Validate data first
		const validation = await this.validateRecipeInstanceData(data);
		if (!validation.isValid) {
			throw new Error(`Invalid recipe instance data: ${validation.errors.join(', ')}`);
		}

		const [result] = await db
			.insert(recipeInstances)
			.values({
				...data,
				updatedAt: new Date()
			})
			.returning();

		return result;
	}

	async updateRecipeInstance(
		id: string,
		data: Partial<Omit<NewRecipeInstance, 'id' | 'createdAt' | 'updatedAt'>>
	): Promise<RecipeInstance | undefined> {
		const [result] = await db
			.update(recipeInstances)
			.set({
				...data,
				updatedAt: new Date()
			})
			.where(eq(recipeInstances.id, id))
			.returning();

		return result;
	}

	async deleteRecipeInstance(id: string): Promise<boolean> {
		const result = await db
			.delete(recipeInstances)
			.where(eq(recipeInstances.id, id));

		return result.length > 0;
	}

	async calculateInstanceProduction(instanceId: string): Promise<ProductionCalculation | undefined> {
		const instance = await this.getRecipeInstanceById(instanceId);
		if (!instance) return undefined;

		const buildingCount = parseFloat(instance.buildingCount);
		const efficiency = parseFloat(instance.efficiencyRatio);
		const manufacturingDuration = parseFloat(instance.recipeVersion.manufacturingDuration);

		// Calculate items per minute for each product
		const productionRates = instance.products.map(product => {
			const baseRate = parseFloat(product.count) / manufacturingDuration * 60; // items per minute for 1 building
			const totalRate = baseRate * buildingCount * efficiency;
			
			return {
				itemId: product.itemId,
				itemName: product.item.displayName,
				rate: totalRate
			};
		});

		// For now, return the first product's rate (in a real scenario, you might want to return all products)
		const primaryProduct = productionRates[0];
		
		return {
			itemsPerMinute: primaryProduct?.rate || 0,
			totalProduction: primaryProduct?.rate || 0,
			buildingUtilization: efficiency,
			powerConsumption: 0 // TODO: Calculate based on building power consumption
		};
	}

	async calculateSiteProduction(siteId: string): Promise<{
		totalProduction: Array<{ itemId: string; itemName: string; rate: number }>;
		totalConsumption: Array<{ itemId: string; itemName: string; rate: number }>;
		netBalance: Array<{ itemId: string; itemName: string; balance: number }>;
	}> {
		const instances = await this.getRecipeInstancesBySite(siteId);
		
		const productionMap = new Map<string, { itemName: string; rate: number }>();
		const consumptionMap = new Map<string, { itemName: string; rate: number }>();

		for (const instance of instances) {
			const buildingCount = parseFloat(instance.buildingCount);
			const efficiency = parseFloat(instance.efficiencyRatio);
			const manufacturingDuration = parseFloat(instance.recipeVersion.manufacturingDuration);

			// Calculate production
			for (const product of instance.products) {
				const baseRate = parseFloat(product.count) / manufacturingDuration * 60;
				const totalRate = baseRate * buildingCount * efficiency;
				
				const existing = productionMap.get(product.itemId);
				productionMap.set(product.itemId, {
					itemName: product.item.displayName,
					rate: (existing?.rate || 0) + totalRate
				});
			}

			// Calculate consumption
			for (const ingredient of instance.ingredients) {
				const baseRate = parseFloat(ingredient.count) / manufacturingDuration * 60;
				const totalRate = baseRate * buildingCount * efficiency;
				
				const existing = consumptionMap.get(ingredient.itemId);
				consumptionMap.set(ingredient.itemId, {
					itemName: ingredient.item.displayName,
					rate: (existing?.rate || 0) + totalRate
				});
			}
		}

		// Convert maps to arrays
		const totalProduction = Array.from(productionMap.entries()).map(([itemId, data]) => ({
			itemId,
			itemName: data.itemName,
			rate: data.rate
		}));

		const totalConsumption = Array.from(consumptionMap.entries()).map(([itemId, data]) => ({
			itemId,
			itemName: data.itemName,
			rate: data.rate
		}));

		// Calculate net balance
		const allItemIds = new Set([...productionMap.keys(), ...consumptionMap.keys()]);
		const netBalance = Array.from(allItemIds).map(itemId => {
			const production = productionMap.get(itemId)?.rate || 0;
			const consumption = consumptionMap.get(itemId)?.rate || 0;
			const itemName = productionMap.get(itemId)?.itemName || consumptionMap.get(itemId)?.itemName || '';
			
			return {
				itemId,
				itemName,
				balance: production - consumption
			};
		}).filter(item => Math.abs(item.balance) > 0.001); // Filter out near-zero balances

		return {
			totalProduction,
			totalConsumption,
			netBalance
		};
	}

	async validateRecipeInstanceData(data: Omit<NewRecipeInstance, 'id' | 'createdAt' | 'updatedAt'>): Promise<{
		isValid: boolean;
		errors: string[];
	}> {
		const errors: string[] = [];

		// Check if site exists
		if (data.siteId) {
			const site = await db
				.select()
				.from(sites)
				.where(eq(sites.id, data.siteId))
				.limit(1);
			
			if (site.length === 0) {
				errors.push('Site does not exist');
			}
		}

		// Check if recipe version exists
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

		if (data.efficiencyRatio && (parseFloat(data.efficiencyRatio) <= 0 || parseFloat(data.efficiencyRatio) > 2.5)) {
			errors.push('Efficiency ratio must be between 0 and 2.5');
		}

		return {
			isValid: errors.length === 0,
			errors
		};
	}
}

export const recipeInstanceService = new RecipeInstanceService();