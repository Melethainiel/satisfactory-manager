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
	itemVersions,
	moduleGames,
	modules
} from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';

export interface ProductionInstanceDetail {
	id: string;
	siteId: string;
	recipeVersionId: string | null;
	buildingId: string;
	extractedItemId: string | null;
	fuelItemId: string | null;
	buildingCount: string;
	efficiencyRatio: string;
	notes: string | null;
	createdAt: Date;
	updatedAt: Date;
	// Calculated fields
	production: ProductionCalculation;
	// Related data
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
		output: string | null;
		energyConsumption: string | null;
		energyProduction: string | null;
		supplementalLoadAmount: string | null;
	} | null;
	products: Array<{
		itemId: string;
		count: string;
		actualRate: number; // Calculated rate per minute
		item: {
			displayName: string;
			className: string;
			form: string;
		};
	}>;
	ingredients: Array<{
		itemId: string;
		count: string;
		actualRate: number; // Calculated rate per minute
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
	powerConsumption: number;
	powerProduction: number;
}

export interface ProductionSummary {
	instances: ProductionInstanceDetail[];
	overview: {
		totalProduction: Array<{ itemId: string; itemName: string; rate: number }>;
		totalConsumption: Array<{ itemId: string; itemName: string; rate: number }>;
		netBalance: Array<{ itemId: string; itemName: string; balance: number }>;
		totalPowerConsumption: number;
		totalPowerProduction: number;
		netPowerBalance: number;
	};
	metrics: {
		totalInstances: number;
		totalBuildings: number;
		averageEfficiency: number;
		uniqueItems: number;
		lastUpdated: Date;
	};
}

interface CacheEntry {
	data: ProductionSummary;
	timestamp: Date;
	ttl: number;
}

export class ProductionCalculationService {
	private cache = new Map<string, CacheEntry>();
	private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

	private getCacheKey(siteId: string): string {
		return `site:${siteId}`;
	}

	private isCacheValid(entry: CacheEntry): boolean {
		return Date.now() - entry.timestamp.getTime() < entry.ttl;
	}

	private setCache(siteId: string, data: ProductionSummary, ttl: number = this.DEFAULT_TTL): void {
		this.cache.set(this.getCacheKey(siteId), {
			data,
			timestamp: new Date(),
			ttl
		});
	}

	private getCache(siteId: string): ProductionSummary | null {
		const entry = this.cache.get(this.getCacheKey(siteId));
		if (entry && this.isCacheValid(entry)) {
			return entry.data;
		}
		// Remove expired entry
		if (entry) {
			this.cache.delete(this.getCacheKey(siteId));
		}
		return null;
	}

	public invalidateCache(siteId: string): void {
		this.cache.delete(this.getCacheKey(siteId));
	}

	public clearAllCache(): void {
		this.cache.clear();
	}

	private calculateInstanceProduction(
		instance: any,
		recipeData?: { products: any[]; ingredients: any[] }
	): ProductionCalculation {
		const buildingCount = parseFloat(instance.buildingCount);
		const efficiency = parseFloat(instance.efficiencyRatio);
		const powerConsumption = parseFloat(instance.buildingVersion?.energyConsumption || '0');
		const powerProduction = parseFloat(instance.buildingVersion?.energyProduction || '0');

		// Handle extraction (no recipe)
		if (!instance.recipeVersionId) {
			const buildingOutput = parseFloat(instance.buildingVersion?.output || '0');
			const totalRate = buildingOutput * buildingCount * efficiency;

			return {
				itemsPerMinute: totalRate,
				totalProduction: totalRate,
				buildingUtilization: efficiency,
				powerConsumption: powerConsumption * buildingCount * efficiency,
				powerProduction: powerProduction * buildingCount * efficiency
			};
		}

		// Handle crafting (has recipe)
		const manufacturingDuration = parseFloat(instance.recipeVersion?.manufacturingDuration || '1');

		// Calculate primary product rate (first product)
		const primaryProductRate = recipeData?.products?.[0]
			? (parseFloat(recipeData.products[0].count) / manufacturingDuration) *
				buildingCount *
				efficiency
			: 0;

		return {
			itemsPerMinute: primaryProductRate,
			totalProduction: primaryProductRate,
			buildingUtilization: efficiency,
			powerConsumption: powerConsumption * buildingCount * efficiency,
			powerProduction: powerProduction * buildingCount * efficiency
		};
	}

	private async fetchSiteProductionInstances(siteId: string): Promise<ProductionInstanceDetail[]> {
		// Single optimized query to get all production instances with related data
		const instancesQuery = await db
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
					energyProduction: buildingVersions.energyProduction,
					supplementalLoadAmount: buildingVersions.supplementalLoadAmount
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
			.where(eq(productionInstances.siteId, siteId));

		// Get all recipe version IDs for batch fetching products/ingredients
		const recipeVersionIds = instancesQuery
			.filter((i) => i.recipeVersionId)
			.map((i) => i.recipeVersionId!);

		const extractedItemIds = instancesQuery
			.filter((i) => i.extractedItemId)
			.map((i) => i.extractedItemId!);

		const fuelItemIds = instancesQuery.filter((i) => i.fuelItemId).map((i) => i.fuelItemId!);

		// Check if any generator has supplemental load amount (water consumption)
		const needsWaterItem = instancesQuery.some(
			(i) => i.fuelItemId && parseFloat(i.buildingVersion?.supplementalLoadAmount || '0') > 0
		);

		// Get gameId from the first instance (all instances in a site have the same gameId)
		const gameId = instancesQuery.length > 0 ? instancesQuery[0].site?.gameId : null;

		// Batch fetch products, ingredients, and water item if needed
		const [productsData, ingredientsData, extractedItemsData, fuelItemsData, waterItemData] =
			await Promise.all([
				recipeVersionIds.length > 0
					? db
							.select({
								recipeVersionId: recipeProducts.recipeVersionId,
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
							.where(inArray(recipeProducts.recipeVersionId, recipeVersionIds))
					: [],

				recipeVersionIds.length > 0
					? db
							.select({
								recipeVersionId: recipeIngredients.recipeVersionId,
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
							.where(inArray(recipeIngredients.recipeVersionId, recipeVersionIds))
					: [],

				extractedItemIds.length > 0
					? db
							.select({
								id: items.id,
								displayName: items.displayName,
								className: items.className,
								form: items.form
							})
							.from(items)
							.where(inArray(items.id, extractedItemIds))
					: [],

				fuelItemIds.length > 0 && gameId
					? db
							.select({
								id: items.id,
								displayName: items.displayName,
								className: items.className,
								form: items.form,
								energyValue: itemVersions.energyValue
							})
							.from(items)
							.leftJoin(itemVersions, eq(itemVersions.itemId, items.id))
							.leftJoin(modules, eq(items.moduleId, modules.id))
							.leftJoin(
								moduleGames,
								and(eq(moduleGames.moduleId, modules.id), eq(moduleGames.gameId, gameId))
							)
							.where(
								and(
									inArray(items.id, fuelItemIds),
									eq(itemVersions.moduleVersionId, moduleGames.selectedVersionId)
								)
							)
					: [],

				// Fetch water item if needed for generators with supplemental load amount
				needsWaterItem && gameId
					? db
							.select({
								id: items.id,
								displayName: items.displayName,
								className: items.className,
								form: items.form
							})
							.from(items)
							.leftJoin(modules, eq(items.moduleId, modules.id))
							.leftJoin(
								moduleGames,
								and(eq(moduleGames.moduleId, modules.id), eq(moduleGames.gameId, gameId))
							)
							.where(eq(items.className, 'Desc_Water_C'))
							.limit(1)
					: []
			]);

		// Group products and ingredients by recipe version ID
		const productsByRecipeVersion = new Map();
		const ingredientsByRecipeVersion = new Map();
		const extractedItemsMap = new Map();
		const fuelItemsMap = new Map();

		// Water item for generators
		const waterItem = waterItemData.length > 0 ? waterItemData[0] : null;

		productsData.forEach((p) => {
			if (!productsByRecipeVersion.has(p.recipeVersionId)) {
				productsByRecipeVersion.set(p.recipeVersionId, []);
			}
			productsByRecipeVersion.get(p.recipeVersionId).push(p);
		});

		ingredientsData.forEach((i) => {
			if (!ingredientsByRecipeVersion.has(i.recipeVersionId)) {
				ingredientsByRecipeVersion.set(i.recipeVersionId, []);
			}
			ingredientsByRecipeVersion.get(i.recipeVersionId).push(i);
		});

		extractedItemsData.forEach((item) => {
			extractedItemsMap.set(item.id, item);
		});

		fuelItemsData.forEach((item) => {
			fuelItemsMap.set(item.id, item);
		});

		// Build detailed instances with calculations
		return instancesQuery.map((instance) => {
			let products: ProductionInstanceDetail['products'] = [];
			let ingredients: ProductionInstanceDetail['ingredients'] = [];

			if (instance.recipeVersionId) {
				// Get products and ingredients for this recipe
				const recipeProducts = productsByRecipeVersion.get(instance.recipeVersionId) || [];
				const recipeIngredients = ingredientsByRecipeVersion.get(instance.recipeVersionId) || [];

				const buildingCount = parseFloat(instance.buildingCount);
				const efficiency = parseFloat(instance.efficiencyRatio);

				products = recipeProducts.map((p: any) => {
					const baseRate = parseFloat(p.count);
					const actualRate = baseRate * buildingCount * efficiency;
					return {
						itemId: p.itemId,
						count: p.count,
						actualRate,
						item: p.item
					};
				});

				ingredients = recipeIngredients.map((i: any) => {
					const baseRate = parseFloat(i.count);
					const actualRate = baseRate * buildingCount * efficiency;
					return {
						itemId: i.itemId,
						count: i.count,
						actualRate,
						item: i.item
					};
				});
			} else if (instance.extractedItemId) {
				// Handle extraction
				const extractedItem = extractedItemsMap.get(instance.extractedItemId);
				if (extractedItem) {
					const buildingCount = parseFloat(instance.buildingCount);
					const efficiency = parseFloat(instance.efficiencyRatio);
					const buildingOutput = parseFloat(instance.buildingVersion?.output || '0');
					const actualRate = buildingOutput * buildingCount * efficiency;

					products = [
						{
							itemId: extractedItem.id,
							count: '1',
							actualRate,
							item: {
								displayName: extractedItem.displayName,
								className: extractedItem.className,
								form: extractedItem.form
							}
						}
					];
				}
			} else if (instance.fuelItemId) {
				// Handle generators with fuel
				const fuelItem = fuelItemsMap.get(instance.fuelItemId);
				if (fuelItem) {
					const buildingCount = parseFloat(instance.buildingCount);
					const efficiency = parseFloat(instance.efficiencyRatio);
					const powerProduction = parseFloat(instance.buildingVersion?.energyProduction || '0');

					// Calculate fuel consumption using correct formula: 60 / (Item.EnergyValue / Building.EnergyProduction)
					// Convert GJ to MJ: Item.EnergyValue * 1000
					const fuelEnergyValueMJ = (fuelItem.energyValue || 0) * 1000; // Convert GJ to MJ
					const buildingEnergyProductionMW = powerProduction; // Already in MW

					let fuelConsumptionRate = 0;
					if (fuelEnergyValueMJ > 0 && buildingEnergyProductionMW > 0) {
						// Formula: 60 / (Item.EnergyValue / Building.EnergyProduction)
						const fuelConsumptionPerBuilding =
							60 / (fuelEnergyValueMJ / buildingEnergyProductionMW);
						fuelConsumptionRate = fuelConsumptionPerBuilding * buildingCount * efficiency;
					}

					ingredients = [
						{
							itemId: fuelItem.id,
							count: '1',
							actualRate: fuelConsumptionRate,
							item: {
								displayName: fuelItem.displayName,
								className: fuelItem.className,
								form: fuelItem.form
							}
						}
					];

					// Add water consumption if generator has supplemental load amount (water consumption)
					const supplementalLoadAmount = parseFloat(
						instance.buildingVersion?.supplementalLoadAmount || '0'
					);
					if (supplementalLoadAmount > 0 && waterItem) {
						const waterConsumptionRate = supplementalLoadAmount * buildingCount * efficiency;
						ingredients.push({
							itemId: waterItem.id,
							count: '1',
							actualRate: waterConsumptionRate,
							item: {
								displayName: waterItem.displayName,
								className: waterItem.className,
								form: waterItem.form
							}
						});
					}
				}
			}

			// Calculate production metrics
			const production = this.calculateInstanceProduction(instance, { products, ingredients });

			return {
				id: instance.id,
				siteId: instance.siteId,
				recipeVersionId: instance.recipeVersionId,
				buildingId: instance.buildingId,
				extractedItemId: instance.extractedItemId,
				fuelItemId: instance.fuelItemId,
				buildingCount: instance.buildingCount,
				efficiencyRatio: instance.efficiencyRatio,
				notes: instance.notes,
				createdAt: instance.createdAt,
				updatedAt: instance.updatedAt,
				production,
				site: instance.site!,
				recipe: instance.recipe,
				recipeVersion: instance.recipeVersion,
				building: instance.building!,
				buildingVersion: instance.buildingVersion,
				products,
				ingredients
			};
		});
	}

	private calculateSiteOverview(instances: ProductionInstanceDetail[]) {
		const productionMap = new Map<string, { itemName: string; rate: number }>();
		const consumptionMap = new Map<string, { itemName: string; rate: number }>();
		let totalPowerConsumption = 0;
		let totalPowerProduction = 0;

		for (const instance of instances) {
			// Aggregate production
			for (const product of instance.products) {
				const existing = productionMap.get(product.itemId);
				productionMap.set(product.itemId, {
					itemName: product.item.displayName,
					rate: (existing?.rate || 0) + product.actualRate
				});
			}

			// Aggregate consumption
			for (const ingredient of instance.ingredients) {
				const existing = consumptionMap.get(ingredient.itemId);
				consumptionMap.set(ingredient.itemId, {
					itemName: ingredient.item.displayName,
					rate: (existing?.rate || 0) + ingredient.actualRate
				});
			}

			// Aggregate power
			totalPowerConsumption += instance.production.powerConsumption;
			totalPowerProduction += instance.production.powerProduction;
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
		const netBalance = Array.from(allItemIds)
			.map((itemId) => {
				const production = productionMap.get(itemId)?.rate || 0;
				const consumption = consumptionMap.get(itemId)?.rate || 0;
				const itemName =
					productionMap.get(itemId)?.itemName || consumptionMap.get(itemId)?.itemName || '';

				return {
					itemId,
					itemName,
					balance: production - consumption
				};
			})
			.filter((item) => Math.abs(item.balance) > 0.001);

		return {
			totalProduction,
			totalConsumption,
			netBalance,
			totalPowerConsumption,
			totalPowerProduction,
			netPowerBalance: totalPowerProduction - totalPowerConsumption
		};
	}

	private calculateMetrics(instances: ProductionInstanceDetail[]) {
		const totalBuildings = instances.reduce((sum, i) => sum + parseFloat(i.buildingCount), 0);
		const averageEfficiency =
			instances.length > 0
				? instances.reduce((sum, i) => sum + parseFloat(i.efficiencyRatio), 0) / instances.length
				: 0;

		const uniqueItems = new Set([
			...instances.flatMap((i) => i.products.map((p) => p.itemId)),
			...instances.flatMap((i) => i.ingredients.map((i) => i.itemId))
		]).size;

		return {
			totalInstances: instances.length,
			totalBuildings,
			averageEfficiency,
			uniqueItems,
			lastUpdated: new Date()
		};
	}

	async getProductionSummary(siteId: string, useCache: boolean = true): Promise<ProductionSummary> {
		// Check cache first
		if (useCache) {
			const cached = this.getCache(siteId);
			if (cached) {
				return cached;
			}
		}

		// Fetch and calculate
		const instances = await this.fetchSiteProductionInstances(siteId);
		const overview = this.calculateSiteOverview(instances);
		const metrics = this.calculateMetrics(instances);

		const summary: ProductionSummary = {
			instances,
			overview,
			metrics
		};

		// Cache the result
		this.setCache(siteId, summary);

		return summary;
	}

	// Methods to invalidate cache when data changes
	async onProductionInstanceChanged(siteId: string): Promise<void> {
		this.invalidateCache(siteId);
	}

	async onSiteDeleted(siteId: string): Promise<void> {
		this.invalidateCache(siteId);
	}
}

export const productionCalculationService = new ProductionCalculationService();
