import { db } from '../db';
import {
	buildingVersions,
	buildings,
	itemVersions,
	items,
	moduleGames,
	modules,
	productionInstances,
	recipeIngredients,
	recipeProducts,
	recipeVersions,
	recipes,
	sites
} from '../db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import {
	getPurityMultiplier,
	calculatePowerMultiplier,
	calculatePowerConsumption,
	calculatePowerProduction,
	calculateProductionBoost
} from '$lib/utils/productionCalculations';


export interface ProductionInstanceDetail {
	id: string;
	siteId: string;
	recipeVersionId: string | null;
	buildingVersionId: string;
	extractedItemVersionId: string | null;
	fuelItemVersionId: string | null;
	extractorPurity: string | null;
	buildingCount: string;
	efficiencyRatio: string;
	somersloopCount: number;
	isBuilt: boolean;
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
		const basePowerConsumption = parseFloat(instance.buildingVersion?.energyConsumption || '0');
		const basePowerProduction = parseFloat(instance.buildingVersion?.energyProduction || '0');

		// Calculate power multiplier and production boost based on Somersloop usage
		const filledSlots = instance.somersloopCount || 0;
		const totalSlots = instance.buildingVersion?.productionShardSlotSize || 0;

		const powerMultiplier = calculatePowerMultiplier(filledSlots, totalSlots);
		const productionBoost = calculateProductionBoost(filledSlots, totalSlots);
		const clockSpeed = efficiency * 100; // efficiency is typically clock speed as percentage

		// Handle extraction (no recipe)
		if (!instance.recipeVersionId) {
			const buildingOutput = parseFloat(instance.buildingVersion?.output || '0');
			const purityMultiplier = getPurityMultiplier(instance.extractorPurity);
			const baseRate = buildingOutput * buildingCount * efficiency * purityMultiplier;
			const boostedRate = baseRate * productionBoost;

			const actualPowerConsumption = calculatePowerConsumption(
				basePowerConsumption,
				powerMultiplier,
				clockSpeed
			);
			const actualPowerProduction = calculatePowerProduction(basePowerProduction, clockSpeed);

			return {
				itemsPerMinute: boostedRate,
				totalProduction: boostedRate,
				buildingUtilization: efficiency,
				powerConsumption: actualPowerConsumption * buildingCount,
				powerProduction: actualPowerProduction * buildingCount
			};
		}

		// Handle crafting (has recipe)
		const manufacturingDuration = parseFloat(instance.recipeVersion?.manufacturingDuration || '1');

		// Calculate primary product rate (first product) with production boost
		const basePrimaryProductRate = recipeData?.products?.[0]
			? (parseFloat(recipeData.products[0].count) / manufacturingDuration) *
				buildingCount *
				efficiency
			: 0;
		const boostedPrimaryProductRate = basePrimaryProductRate * productionBoost;

		const actualPowerConsumption = calculatePowerConsumption(
			basePowerConsumption,
			powerMultiplier,
			clockSpeed
		);
		const actualPowerProduction = calculatePowerProduction(basePowerProduction, clockSpeed);

		return {
			itemsPerMinute: boostedPrimaryProductRate,
			totalProduction: boostedPrimaryProductRate,
			buildingUtilization: efficiency,
			powerConsumption: actualPowerConsumption * buildingCount,
			powerProduction: actualPowerProduction * buildingCount
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
				buildingVersionId: productionInstances.buildingVersionId,
				extractedItemVersionId: productionInstances.extractedItemVersionId,
				fuelItemVersionId: productionInstances.fuelItemVersionId,
				extractorPurity: productionInstances.extractorPurity,
				buildingCount: productionInstances.buildingCount,
				efficiencyRatio: productionInstances.efficiencyRatio,
				somersloopCount: productionInstances.somersloopCount,
				isBuilt: productionInstances.isBuilt,
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
					supplementalLoadAmount: buildingVersions.supplementalLoadAmount,
					productionShardSlotSize: buildingVersions.productionShardSlotSize
				}
			})
			.from(productionInstances)
			.leftJoin(sites, eq(productionInstances.siteId, sites.id))
			.leftJoin(recipeVersions, eq(productionInstances.recipeVersionId, recipeVersions.id))
			.leftJoin(recipes, eq(recipeVersions.recipeId, recipes.id))
			.leftJoin(buildingVersions, eq(productionInstances.buildingVersionId, buildingVersions.id))
			.leftJoin(buildings, eq(buildingVersions.buildingId, buildings.id))
			.where(eq(productionInstances.siteId, siteId));

		// Get all recipe version IDs for batch fetching products/ingredients
		const recipeVersionIds = instancesQuery
			.filter((i) => i.recipeVersionId)
			.map((i) => i.recipeVersionId!);

		const extractedItemVersionIds = instancesQuery
			.filter((i) => i.extractedItemVersionId)
			.map((i) => i.extractedItemVersionId!);

		const fuelItemVersionIds = instancesQuery
			.filter((i) => i.fuelItemVersionId)
			.map((i) => i.fuelItemVersionId!);

		// Check if any generator has supplemental load amount (water consumption)
		const needsWaterItem = instancesQuery.some(
			(i) => i.fuelItemVersionId && parseFloat(i.buildingVersion?.supplementalLoadAmount || '0') > 0
		);

		// Get gameId from the first instance (all instances in a site have the same gameId)
		const gameId = instancesQuery.length > 0 ? instancesQuery[0].site?.gameId : null;

		// Batch fetch products, ingredients, and item versions
		const [
			productsData,
			ingredientsData,
			extractedItemVersionsData,
			fuelItemVersionsData,
			waterItemData
		] = await Promise.all([
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

			extractedItemVersionIds.length > 0
				? db
						.select({
							id: itemVersions.id,
							itemId: itemVersions.itemId,
							displayName: items.displayName,
							className: items.className,
							form: items.form
						})
						.from(itemVersions)
						.innerJoin(items, eq(itemVersions.itemId, items.id))
						.where(inArray(itemVersions.id, extractedItemVersionIds))
				: [],

			fuelItemVersionIds.length > 0
				? db
						.select({
							id: itemVersions.id,
							itemId: itemVersions.itemId,
							displayName: items.displayName,
							className: items.className,
							form: items.form,
							energyValue: itemVersions.energyValue
						})
						.from(itemVersions)
						.innerJoin(items, eq(itemVersions.itemId, items.id))
						.where(inArray(itemVersions.id, fuelItemVersionIds))
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
		const extractedItemVersionsMap = new Map();
		const fuelItemVersionsMap = new Map();

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

		extractedItemVersionsData.forEach((itemVersion) => {
			extractedItemVersionsMap.set(itemVersion.id, itemVersion);
		});

		fuelItemVersionsData.forEach((itemVersion) => {
			fuelItemVersionsMap.set(itemVersion.id, itemVersion);
		});

		// Build detailed instances with calculations
		return instancesQuery.map((instance) => {
			let products: ProductionInstanceDetail['products'] = [];
			let ingredients: ProductionInstanceDetail['ingredients'] = [];

			// Calculate production boost for this instance
			const filledSlots = instance.somersloopCount || 0;
			const totalSlots = instance.buildingVersion?.productionShardSlotSize || 0;
			const productionBoost = calculateProductionBoost(filledSlots, totalSlots);

			if (instance.recipeVersionId) {
				// Get products and ingredients for this recipe
				const recipeProducts = productsByRecipeVersion.get(instance.recipeVersionId) || [];
				const recipeIngredients = ingredientsByRecipeVersion.get(instance.recipeVersionId) || [];

				const buildingCount = parseFloat(instance.buildingCount);
				const efficiency = parseFloat(instance.efficiencyRatio);

				// Products get the production boost
				products = recipeProducts.map((p: any) => {
					const baseRate = parseFloat(p.count);
					const actualRate = baseRate * buildingCount * efficiency * productionBoost;
					return {
						itemId: p.itemId,
						count: p.count,
						actualRate,
						item: p.item
					};
				});

				// Ingredients do NOT get the production boost
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
			} else if (instance.extractedItemVersionId) {
				// Handle extraction with production boost
				const extractedItemVersion = extractedItemVersionsMap.get(instance.extractedItemVersionId);
				if (extractedItemVersion) {
					const buildingCount = parseFloat(instance.buildingCount);
					const efficiency = parseFloat(instance.efficiencyRatio);
					const buildingOutput = parseFloat(instance.buildingVersion?.output || '0');
					const purityMultiplier = getPurityMultiplier(instance.extractorPurity);
					const actualRate = buildingOutput * buildingCount * efficiency * purityMultiplier * productionBoost;

					products = [
						{
							itemId: extractedItemVersion.itemId,
							count: '1',
							actualRate,
							item: {
								displayName: extractedItemVersion.displayName,
								className: extractedItemVersion.className,
								form: extractedItemVersion.form
							}
						}
					];
				}
			} else if (instance.fuelItemVersionId) {
				// Handle generators with fuel
				const fuelItemVersion = fuelItemVersionsMap.get(instance.fuelItemVersionId);
				if (fuelItemVersion) {
					const buildingCount = parseFloat(instance.buildingCount);
					const efficiency = parseFloat(instance.efficiencyRatio);
					const powerProduction = parseFloat(instance.buildingVersion?.energyProduction || '0');

					// Calculate fuel consumption using correct formula: 60 / (Item.EnergyValue / Building.EnergyProduction)
					// Convert GJ to MJ: Item.EnergyValue * 1000
					const fuelEnergyValueMJ = (fuelItemVersion.energyValue || 0) * 1000; // Convert GJ to MJ
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
							itemId: fuelItemVersion.itemId,
							count: '1',
							actualRate: fuelConsumptionRate,
							item: {
								displayName: fuelItemVersion.displayName,
								className: fuelItemVersion.className,
								form: fuelItemVersion.form
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
				buildingVersionId: instance.buildingVersionId,
				extractedItemVersionId: instance.extractedItemVersionId,
				fuelItemVersionId: instance.fuelItemVersionId,
				extractorPurity: instance.extractorPurity,
				buildingCount: instance.buildingCount,
				efficiencyRatio: instance.efficiencyRatio,
				somersloopCount: instance.somersloopCount,
				isBuilt: instance.isBuilt,
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
