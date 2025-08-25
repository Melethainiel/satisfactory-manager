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
import { eq, desc, and } from 'drizzle-orm';

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
	getProductionInstancesBySite(siteId: string): Promise<ProductionInstanceWithDetails[]>;
	createProductionInstance(data: Omit<NewProductionInstance, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductionInstance>;
	updateProductionInstance(
		id: string,
		data: Partial<Omit<NewProductionInstance, 'id' | 'createdAt' | 'updatedAt'>>
	): Promise<ProductionInstance | undefined>;
	deleteProductionInstance(id: string): Promise<boolean>;

	// Production calculations
	calculateInstanceProduction(instanceId: string): Promise<ProductionCalculation | undefined>;
	calculateSiteProduction(siteId: string): Promise<{
		totalProduction: Array<{ itemId: string; itemName: string; rate: number }>;
		totalConsumption: Array<{ itemId: string; itemName: string; rate: number }>;
		netBalance: Array<{ itemId: string; itemName: string; balance: number }>;
	}>;

	// Validation
	validateProductionInstanceData(data: Omit<NewProductionInstance, 'id' | 'createdAt' | 'updatedAt'>): Promise<{
		isValid: boolean;
		errors: string[];
	}>;
}

class ProductionInstanceService implements IProductionInstanceService {
	async getAllProductionInstances(): Promise<ProductionInstance[]> {
		return db
			.select()
			.from(productionInstances)
			.orderBy(desc(productionInstances.createdAt));
	}

	async getProductionInstanceById(id: string): Promise<ProductionInstanceWithDetails | undefined> {
		const result = await db
			.select({
				// Production instance fields
				id: productionInstances.id,
				siteId: productionInstances.siteId,
				recipeVersionId: productionInstances.recipeVersionId,
				buildingId: productionInstances.buildingId,
				extractedItemId: productionInstances.extractedItemId,
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
				}
			})
			.from(productionInstances)
			.leftJoin(sites, eq(productionInstances.siteId, sites.id))
			.leftJoin(recipeVersions, eq(productionInstances.recipeVersionId, recipeVersions.id))
			.leftJoin(recipes, eq(recipeVersions.recipeId, recipes.id))
			.leftJoin(buildings, eq(productionInstances.buildingId, buildings.id))
			.leftJoin(modules, eq(buildings.moduleId, modules.id))
			.leftJoin(moduleGames, and(
				eq(moduleGames.moduleId, modules.id),
				eq(moduleGames.gameId, sites.gameId)
			))
			.leftJoin(buildingVersions, and(
				eq(buildingVersions.buildingId, buildings.id),
				eq(buildingVersions.moduleVersionId, moduleGames.selectedVersionId)
			))
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
				products = [{
					itemId: extractedItem[0].id,
					count: '1', // Placeholder count for extraction
					item: {
						displayName: extractedItem[0].displayName,
						className: extractedItem[0].className,
						form: extractedItem[0].form
					}
				}];
			}
		}

		return {
			...instanceData,
			products,
			ingredients
		} as ProductionInstanceWithDetails;
	}

	async getProductionInstancesBySite(siteId: string): Promise<ProductionInstanceWithDetails[]> {
		const instances = await db
			.select()
			.from(productionInstances)
			.where(eq(productionInstances.siteId, siteId))
			.orderBy(desc(productionInstances.createdAt));

		const detailed = await Promise.all(
			instances.map(async (instance) => {
				return this.getProductionInstanceById(instance.id);
			})
		);

		return detailed.filter((instance): instance is ProductionInstanceWithDetails => instance !== undefined);
	}

	async createProductionInstance(data: Omit<NewProductionInstance, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductionInstance> {
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

		return result;
	}

	async updateProductionInstance(
		id: string,
		data: Partial<Omit<NewProductionInstance, 'id' | 'createdAt' | 'updatedAt'>>
	): Promise<ProductionInstance | undefined> {
		const [result] = await db
			.update(productionInstances)
			.set({
				...data,
				updatedAt: new Date()
			})
			.where(eq(productionInstances.id, id))
			.returning();

		return result;
	}

	async deleteProductionInstance(id: string): Promise<boolean> {
		const result = await db
			.delete(productionInstances)
			.where(eq(productionInstances.id, id))
			.returning({ id: productionInstances.id });

		return result.length > 0;
	}

	async calculateInstanceProduction(instanceId: string): Promise<ProductionCalculation | undefined> {
		const instance = await this.getProductionInstanceById(instanceId);
		if (!instance) return undefined;

		const buildingCount = parseFloat(instance.buildingCount);
		const efficiency = parseFloat(instance.efficiencyRatio);

		// Handle extraction (no recipe)
		if (!instance.recipeVersionId) {
			// For extraction, use the building output rate from buildingVersion
			if (!instance.buildingVersion) {
				// Fallback if no building version data
				return {
					itemsPerMinute: 0,
					totalProduction: 0,
					buildingUtilization: efficiency,
					powerConsumption: 0
				};
			}

			const buildingOutput = parseFloat(instance.buildingVersion.output || '0');
			const baseRatePerMinute = buildingOutput; // Already per minute
			const totalRate = baseRatePerMinute * buildingCount * efficiency;

			return {
				itemsPerMinute: totalRate,
				totalProduction: totalRate,
				buildingUtilization: efficiency,
				powerConsumption: parseFloat(instance.buildingVersion.energyConsumption || '0') * buildingCount * efficiency
			};
		}

		// Handle crafting (has recipe)
		const manufacturingDuration = parseFloat(instance.recipeVersion?.manufacturingDuration || '1');

		// Calculate items per minute for each product
		const productionRates = instance.products.map(product => {
			const baseRate = parseFloat(product.count) / manufacturingDuration; // items per minute for 1 building
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
		const instances = await this.getProductionInstancesBySite(siteId);

		const productionMap = new Map<string, { itemName: string; rate: number }>();
		const consumptionMap = new Map<string, { itemName: string; rate: number }>();

		for (const instance of instances) {
			const buildingCount = parseFloat(instance.buildingCount);
			const efficiency = parseFloat(instance.efficiencyRatio);

			// Handle extraction instances (no recipes)
			if (!instance.recipeVersionId) {
				// For extraction, use the building output rate from buildingVersion
				if (instance.buildingVersion && instance.products.length > 0) {
					const buildingOutput = parseFloat(instance.buildingVersion.output || '0');
					const baseRatePerMinute = buildingOutput;
					const totalRate = baseRatePerMinute * buildingCount * efficiency;

					// Use the first (and typically only) product for extraction
					const extractedItem = instance.products[0];
					const existing = productionMap.get(extractedItem.itemId);
					productionMap.set(extractedItem.itemId, {
						itemName: extractedItem.item.displayName,
						rate: (existing?.rate || 0) + totalRate
					});
				}
				continue;
			}

			// Handle crafting instances (with recipes)
			const manufacturingDuration = parseFloat(instance.recipeVersion?.manufacturingDuration || '1');

			// Calculate production
			for (const product of instance.products) {
				const baseRate = parseFloat(product.count) / manufacturingDuration;
				const totalRate = baseRate * buildingCount * efficiency;

				const existing = productionMap.get(product.itemId);
				productionMap.set(product.itemId, {
					itemName: product.item.displayName,
					rate: (existing?.rate || 0) + totalRate
				});
			}

			// Calculate consumption
			for (const ingredient of instance.ingredients) {
				const baseRate = parseFloat(ingredient.count) / manufacturingDuration;
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

	async validateProductionInstanceData(data: Omit<NewProductionInstance, 'id' | 'createdAt' | 'updatedAt'>): Promise<{
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

		if (data.efficiencyRatio && (parseFloat(data.efficiencyRatio) <= 0 || parseFloat(data.efficiencyRatio) > 2.5)) {
			errors.push('Efficiency ratio must be between 0 and 2.5');
		}

		return {
			isValid: errors.length === 0,
			errors
		};
	}
}

export const productionInstanceService = new ProductionInstanceService();