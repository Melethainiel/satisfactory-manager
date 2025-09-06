import { db } from '../db';
import {
	type GameUserRole,
	buildingVersions,
	buildings,
	games,
	itemVersions,
	items,
	moduleGames,
	modules,
	productionInstances,
	recipeIngredients,
	recipeProducts,
	recipeVersions,
	recipes,
	sites,
	userGames,
	users
} from '../db/schema';
import { and, eq, inArray } from 'drizzle-orm';

// Power calculation functions based on Satisfactory wiki formula
function calculatePowerMultiplier(filledSlots: number, totalSlots: number): number {
	if (totalSlots === 0) return 1.0;
	const slotRatio = filledSlots / totalSlots;
	return Math.pow(1 + slotRatio, 2);
}

function calculatePowerConsumption(
	basePowerUsage: number,
	powerMultiplier: number,
	clockSpeed: number
): number {
	const clockSpeedRatio = clockSpeed / 100;
	return basePowerUsage * powerMultiplier * Math.pow(clockSpeedRatio, 1.321928);
}

function calculatePowerProduction(basePowerProduction: number, clockSpeed: number): number {
	const clockSpeedRatio = clockSpeed / 100;
	return basePowerProduction * clockSpeedRatio; // Linear scaling for power production
}

// Production boost calculation for Somersloop
function calculateProductionBoost(filledSlots: number, totalSlots: number): number {
	if (totalSlots === 0) return 1.0;
	const slotRatio = filledSlots / totalSlots;
	return 1 + slotRatio;
}

// Data structures for the game dashboard
export interface GameDashboardData {
	gameId: string;
	sites: Array<{
		siteId: string;
		siteName: string;
		totalProduction: Array<{ itemId: string; itemName: string; rate: number }>;
		totalConsumption: Array<{ itemId: string; itemName: string; rate: number }>;
		powerConsumption: number;
		powerProduction: number;
		instanceCount: number;
		buildingCount: number;
		averageEfficiency: number;
	}>;
	aggregated: {
		totalProduction: Array<{
			itemId: string;
			itemName: string;
			rate: number;
			sites: Array<{ siteId: string; siteName: string; rate: number }>;
		}>;
		totalConsumption: Array<{
			itemId: string;
			itemName: string;
			rate: number;
			sites: Array<{ siteId: string; siteName: string; rate: number }>;
		}>;
		netBalance: Array<{ itemId: string; itemName: string; balance: number }>;
		totalPowerConsumption: number;
		totalPowerProduction: number;
		netPowerBalance: number;
		totalInstances: number;
		totalBuildings: number;
		averageEfficiency: number;
		uniqueItems: number;
	};
	performance: {
		topProducingSites: Array<{ siteId: string; siteName: string; productionScore: number }>;
		powerEfficiencyBySite: Array<{ siteId: string; siteName: string; efficiency: number }>;
		bottlenecks: Array<{ itemId: string; itemName: string; deficit: number; sites: string[] }>;
	};
	lastUpdated: Date;
}

interface CacheEntry {
	data: GameDashboardData;
	timestamp: Date;
	ttl: number;
}

interface SiteProductionData {
	siteId: string;
	siteName: string;
	instanceId: string;
	buildingCount: number;
	efficiencyRatio: number;
	somersloopCount: number;
	isBuilt: boolean;
	powerConsumption: number;
	powerProduction: number;
	recipeVersionId: string | null;
	extractedItemVersionId: string | null;
	fuelItemVersionId: string | null;
	extractorPurity: string | null;
	buildingOutput: number;
	manufacturingDuration: number;
	supplementalLoadAmount: number;
	productionShardSlotSize: number;
	fuelEnergyValue: number;
	products: Array<{ itemId: string; itemName: string; count: number }>;
	ingredients: Array<{ itemId: string; itemName: string; count: number }>;
}

// Purity multipliers for extractors
function getPurityMultiplier(purity: string | null): number {
	switch (purity) {
		case 'Impure':
			return 0.5;
		case 'Pure':
			return 2.0;
		case 'Normal':
		default:
			return 1.0;
	}
}

export class GameDashboardService {
	private cache = new Map<string, CacheEntry>();
	private readonly DEFAULT_TTL = 10 * 60 * 1000; // 10 minutes

	private getCacheKey(gameId: string): string {
		return `game-dashboard:${gameId}`;
	}

	private isCacheValid(entry: CacheEntry): boolean {
		return Date.now() - entry.timestamp.getTime() < entry.ttl;
	}

	private setCache(gameId: string, data: GameDashboardData, ttl: number = this.DEFAULT_TTL): void {
		this.cache.set(this.getCacheKey(gameId), {
			data,
			timestamp: new Date(),
			ttl
		});
	}

	private getCache(gameId: string): GameDashboardData | null {
		const entry = this.cache.get(this.getCacheKey(gameId));
		if (entry && this.isCacheValid(entry)) {
			return entry.data;
		}
		// Remove expired entry
		if (entry) {
			this.cache.delete(this.getCacheKey(gameId));
		}
		return null;
	}

	public invalidateGameDashboardCache(gameId: string): void {
		this.cache.delete(this.getCacheKey(gameId));
	}

	public clearAllCache(): void {
		this.cache.clear();
	}

	// Check if user has read access to game
	private async validateGameAccess(gameId: string, userEmail?: string): Promise<boolean> {
		if (!userEmail) return false;

		const userAccess = await db
			.select({ role: userGames.role })
			.from(userGames)
			.innerJoin(games, eq(userGames.gameId, games.id))
			.innerJoin(users, eq(userGames.userId, users.id))
			.where(and(eq(games.id, gameId), eq(users.email, userEmail)))
			.limit(1);

		return userAccess.length > 0;
	}

	private async fetchGameProductionData(gameId: string): Promise<SiteProductionData[]> {
		// Single optimized query to get all production data for the game
		const productionQuery = await db
			.select({
				// Site data
				siteId: sites.id,
				siteName: sites.name,
				// Production instance data
				instanceId: productionInstances.id,
				buildingCount: productionInstances.buildingCount,
				efficiencyRatio: productionInstances.efficiencyRatio,
				somersloopCount: productionInstances.somersloopCount,
				isBuilt: productionInstances.isBuilt,
				recipeVersionId: productionInstances.recipeVersionId,
				extractedItemVersionId: productionInstances.extractedItemVersionId,
				fuelItemVersionId: productionInstances.fuelItemVersionId,
				extractorPurity: productionInstances.extractorPurity,
				// Building data
				powerConsumption: buildingVersions.energyConsumption,
				powerProduction: buildingVersions.energyProduction,
				buildingOutput: buildingVersions.output,
				supplementalLoadAmount: buildingVersions.supplementalLoadAmount,
				productionShardSlotSize: buildingVersions.productionShardSlotSize,
				// Recipe data
				manufacturingDuration: recipeVersions.manufacturingDuration,
				// Fuel item energy value
				fuelEnergyValue: itemVersions.energyValue
			})
			.from(productionInstances)
			.innerJoin(sites, eq(productionInstances.siteId, sites.id))
			.innerJoin(buildingVersions, eq(productionInstances.buildingVersionId, buildingVersions.id))
			.leftJoin(recipeVersions, eq(productionInstances.recipeVersionId, recipeVersions.id))
			.leftJoin(itemVersions, eq(productionInstances.fuelItemVersionId, itemVersions.id))
			.where(eq(sites.gameId, gameId));

		// Get all recipe version IDs for batch fetching products/ingredients
		const recipeVersionIds = productionQuery
			.filter((p) => p.recipeVersionId)
			.map((p) => p.recipeVersionId!);

		const extractedItemVersionIds = productionQuery
			.filter((p) => p.extractedItemVersionId)
			.map((p) => p.extractedItemVersionId!);

		const fuelItemVersionIds = productionQuery
			.filter((p) => p.fuelItemVersionId)
			.map((p) => p.fuelItemVersionId!);

		// Check if any generator has supplemental load amount (water consumption)
		const needsWaterItem = productionQuery.some(
			(p) => p.fuelItemVersionId && parseFloat(p.supplementalLoadAmount?.toString() || '0') > 0
		);

		// Batch fetch products, ingredients, and item data
		const [productsData, ingredientsData, extractedItemsData, fuelItemsData, waterItemData] =
			await Promise.all([
				// Recipe products
				recipeVersionIds.length > 0
					? db
							.select({
								recipeVersionId: recipeProducts.recipeVersionId,
								itemId: recipeProducts.itemId,
								count: recipeProducts.count,
								itemName: items.displayName
							})
							.from(recipeProducts)
							.innerJoin(items, eq(recipeProducts.itemId, items.id))
							.where(inArray(recipeProducts.recipeVersionId, recipeVersionIds))
					: [],

				// Recipe ingredients
				recipeVersionIds.length > 0
					? db
							.select({
								recipeVersionId: recipeIngredients.recipeVersionId,
								itemId: recipeIngredients.itemId,
								count: recipeIngredients.count,
								itemName: items.displayName
							})
							.from(recipeIngredients)
							.innerJoin(items, eq(recipeIngredients.itemId, items.id))
							.where(inArray(recipeIngredients.recipeVersionId, recipeVersionIds))
					: [],

				// Extracted items
				extractedItemVersionIds.length > 0
					? db
							.select({
								id: itemVersions.id,
								itemId: itemVersions.itemId,
								itemName: items.displayName
							})
							.from(itemVersions)
							.innerJoin(items, eq(itemVersions.itemId, items.id))
							.where(inArray(itemVersions.id, extractedItemVersionIds))
					: [],

				// Fuel items for generators
				fuelItemVersionIds.length > 0
					? db
							.select({
								id: itemVersions.id,
								itemId: itemVersions.itemId,
								itemName: items.displayName
							})
							.from(itemVersions)
							.innerJoin(items, eq(itemVersions.itemId, items.id))
							.where(inArray(itemVersions.id, fuelItemVersionIds))
					: [],

				// Water item for generators
				needsWaterItem
					? db
							.select({
								id: items.id,
								itemName: items.displayName
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

		// Create lookup maps
		const productsByRecipeVersion = new Map<
			string,
			Array<{ itemId: string; itemName: string; count: number }>
		>();
		const ingredientsByRecipeVersion = new Map<
			string,
			Array<{ itemId: string; itemName: string; count: number }>
		>();
		const extractedItemsMap = new Map<string, { itemId: string; itemName: string }>();
		const fuelItemsMap = new Map<string, { itemId: string; itemName: string }>();
		const waterItem = waterItemData.length > 0 ? waterItemData[0] : null;

		productsData.forEach((p) => {
			if (!productsByRecipeVersion.has(p.recipeVersionId)) {
				productsByRecipeVersion.set(p.recipeVersionId, []);
			}
			productsByRecipeVersion.get(p.recipeVersionId)!.push({
				itemId: p.itemId,
				itemName: p.itemName,
				count: parseFloat(p.count.toString())
			});
		});

		ingredientsData.forEach((i) => {
			if (!ingredientsByRecipeVersion.has(i.recipeVersionId)) {
				ingredientsByRecipeVersion.set(i.recipeVersionId, []);
			}
			ingredientsByRecipeVersion.get(i.recipeVersionId)!.push({
				itemId: i.itemId,
				itemName: i.itemName,
				count: parseFloat(i.count.toString())
			});
		});

		extractedItemsData.forEach((item) => {
			extractedItemsMap.set(item.id, {
				itemId: item.itemId,
				itemName: item.itemName
			});
		});

		fuelItemsData.forEach((item) => {
			fuelItemsMap.set(item.id, {
				itemId: item.itemId,
				itemName: item.itemName
			});
		});

		// Transform the data into SiteProductionData
		return productionQuery.map((row) => {
			let products: Array<{ itemId: string; itemName: string; count: number }> = [];
			let ingredients: Array<{ itemId: string; itemName: string; count: number }> = [];

			if (row.recipeVersionId) {
				// Recipe-based production
				products = productsByRecipeVersion.get(row.recipeVersionId) || [];
				ingredients = ingredientsByRecipeVersion.get(row.recipeVersionId) || [];
			} else if (row.extractedItemVersionId) {
				// Extraction-based production
				const extractedItem = extractedItemsMap.get(row.extractedItemVersionId);
				if (extractedItem) {
					products = [
						{
							itemId: extractedItem.itemId,
							itemName: extractedItem.itemName,
							count: 1
						}
					];
				}
			} else if (row.fuelItemVersionId) {
				// Generator-based production - fuel as ingredient
				const fuelEnergyValueMJ = parseFloat(row.fuelEnergyValue?.toString() || '0') * 1000; // Convert GJ to MJ
				const buildingEnergyProductionMW = parseFloat(row.powerProduction?.toString() || '0');
				const fuelItem = fuelItemsMap.get(row.fuelItemVersionId);

				if (fuelEnergyValueMJ > 0 && buildingEnergyProductionMW > 0 && fuelItem) {
					// Calculate fuel consumption rate
					const fuelConsumptionPerBuilding = 60 / (fuelEnergyValueMJ / buildingEnergyProductionMW);
					ingredients.push({
						itemId: fuelItem.itemId,
						itemName: fuelItem.itemName,
						count: fuelConsumptionPerBuilding
					});
				}

				// Add water consumption if generator has supplemental load
				const supplementalLoadAmount = parseFloat(row.supplementalLoadAmount?.toString() || '0');
				if (supplementalLoadAmount > 0 && waterItem) {
					ingredients.push({
						itemId: waterItem.id,
						itemName: waterItem.itemName,
						count: supplementalLoadAmount
					});
				}
			}

			return {
				siteId: row.siteId,
				siteName: row.siteName,
				instanceId: row.instanceId,
				buildingCount: parseFloat(row.buildingCount.toString()),
				efficiencyRatio: parseFloat(row.efficiencyRatio.toString()),
				somersloopCount: row.somersloopCount || 0,
				isBuilt: row.isBuilt,
				powerConsumption: parseFloat(row.powerConsumption?.toString() || '0'),
				powerProduction: parseFloat(row.powerProduction?.toString() || '0'),
				recipeVersionId: row.recipeVersionId,
				extractedItemVersionId: row.extractedItemVersionId,
				fuelItemVersionId: row.fuelItemVersionId,
				extractorPurity: row.extractorPurity,
				buildingOutput: parseFloat(row.buildingOutput?.toString() || '0'),
				manufacturingDuration: parseFloat(row.manufacturingDuration?.toString() || '1'),
				supplementalLoadAmount: parseFloat(row.supplementalLoadAmount?.toString() || '0'),
				productionShardSlotSize: row.productionShardSlotSize || 0,
				fuelEnergyValue: parseFloat(row.fuelEnergyValue?.toString() || '0'),
				products,
				ingredients
			};
		});
	}

	private calculateInstanceRates(instance: SiteProductionData): {
		production: Array<{ itemId: string; itemName: string; rate: number }>;
		consumption: Array<{ itemId: string; itemName: string; rate: number }>;
		powerConsumption: number;
		powerProduction: number;
	} {
		const { buildingCount, efficiencyRatio, somersloopCount, productionShardSlotSize } = instance;

		let production: Array<{ itemId: string; itemName: string; rate: number }> = [];
		let consumption: Array<{ itemId: string; itemName: string; rate: number }> = [];

		// Calculate production boost based on Somersloop usage
		const filledSlots = somersloopCount || 0;
		const totalSlots = productionShardSlotSize || 0;
		const productionBoost = calculateProductionBoost(filledSlots, totalSlots);

		if (instance.recipeVersionId) {
			// Recipe-based production
			const baseRate = buildingCount * efficiencyRatio;

			// Products get the production boost
			production = instance.products.map((p) => ({
				itemId: p.itemId,
				itemName: p.itemName,
				rate: p.count * baseRate * productionBoost
			}));

			// Ingredients do NOT get the production boost
			consumption = instance.ingredients.map((i) => ({
				itemId: i.itemId,
				itemName: i.itemName,
				rate: i.count * baseRate
			}));
		} else if (instance.extractedItemVersionId) {
			// Extraction-based production with production boost
			const purityMultiplier = getPurityMultiplier(instance.extractorPurity);
			const baseRate = instance.buildingOutput * buildingCount * efficiencyRatio * purityMultiplier;
			const boostedRate = baseRate * productionBoost;

			production = instance.products.map((p) => ({
				itemId: p.itemId,
				itemName: p.itemName,
				rate: boostedRate
			}));
		} else if (instance.fuelItemVersionId) {
			// Generator-based production - ingredients do not get production boost
			consumption = instance.ingredients.map((i) => ({
				itemId: i.itemId,
				itemName: i.itemName,
				rate: i.count * buildingCount * efficiencyRatio
			}));
		}

		// Apply correct power formula
		const powerMultiplier = calculatePowerMultiplier(filledSlots, totalSlots);
		const clockSpeed = efficiencyRatio * 100; // efficiency is typically clock speed as percentage

		const actualPowerConsumption = calculatePowerConsumption(
			instance.powerConsumption,
			powerMultiplier,
			clockSpeed
		);
		const actualPowerProduction = calculatePowerProduction(instance.powerProduction, clockSpeed);

		return {
			production,
			consumption,
			powerConsumption: actualPowerConsumption * buildingCount,
			powerProduction: actualPowerProduction * buildingCount
		};
	}

	private aggregateSiteData(gameData: SiteProductionData[]): GameDashboardData['sites'] {
		const siteMap = new Map<
			string,
			{
				siteId: string;
				siteName: string;
				productionMap: Map<string, { itemName: string; rate: number }>;
				consumptionMap: Map<string, { itemName: string; rate: number }>;
				powerConsumption: number;
				powerProduction: number;
				instanceCount: number;
				totalBuildings: number;
				totalEfficiency: number;
			}
		>();

		for (const instance of gameData) {
			const rates = this.calculateInstanceRates(instance);

			if (!siteMap.has(instance.siteId)) {
				siteMap.set(instance.siteId, {
					siteId: instance.siteId,
					siteName: instance.siteName,
					productionMap: new Map(),
					consumptionMap: new Map(),
					powerConsumption: 0,
					powerProduction: 0,
					instanceCount: 0,
					totalBuildings: 0,
					totalEfficiency: 0
				});
			}

			const siteData = siteMap.get(instance.siteId)!;

			// Aggregate production
			for (const product of rates.production) {
				const existing = siteData.productionMap.get(product.itemId);
				siteData.productionMap.set(product.itemId, {
					itemName: product.itemName,
					rate: (existing?.rate || 0) + product.rate
				});
			}

			// Aggregate consumption
			for (const ingredient of rates.consumption) {
				const existing = siteData.consumptionMap.get(ingredient.itemId);
				siteData.consumptionMap.set(ingredient.itemId, {
					itemName: ingredient.itemName,
					rate: (existing?.rate || 0) + ingredient.rate
				});
			}

			// Aggregate power and metrics
			siteData.powerConsumption += rates.powerConsumption;
			siteData.powerProduction += rates.powerProduction;
			siteData.instanceCount += 1;
			siteData.totalBuildings += instance.buildingCount;
			siteData.totalEfficiency += instance.efficiencyRatio;
		}

		// Convert to final format
		return Array.from(siteMap.values()).map((siteData) => ({
			siteId: siteData.siteId,
			siteName: siteData.siteName,
			totalProduction: Array.from(siteData.productionMap.entries()).map(([itemId, data]) => ({
				itemId,
				itemName: data.itemName,
				rate: data.rate
			})),
			totalConsumption: Array.from(siteData.consumptionMap.entries()).map(([itemId, data]) => ({
				itemId,
				itemName: data.itemName,
				rate: data.rate
			})),
			powerConsumption: siteData.powerConsumption,
			powerProduction: siteData.powerProduction,
			instanceCount: siteData.instanceCount,
			buildingCount: siteData.totalBuildings,
			averageEfficiency:
				siteData.instanceCount > 0 ? siteData.totalEfficiency / siteData.instanceCount : 0
		}));
	}

	private aggregateGameData(sites: GameDashboardData['sites']): GameDashboardData['aggregated'] {
		const gameProductionMap = new Map<
			string,
			{
				itemName: string;
				rate: number;
				sites: Array<{ siteId: string; siteName: string; rate: number }>;
			}
		>();
		const gameConsumptionMap = new Map<
			string,
			{
				itemName: string;
				rate: number;
				sites: Array<{ siteId: string; siteName: string; rate: number }>;
			}
		>();

		let totalPowerConsumption = 0;
		let totalPowerProduction = 0;
		let totalInstances = 0;
		let totalBuildings = 0;
		let totalEfficiencySum = 0;

		for (const site of sites) {
			// Aggregate production
			for (const product of site.totalProduction) {
				if (!gameProductionMap.has(product.itemId)) {
					gameProductionMap.set(product.itemId, {
						itemName: product.itemName,
						rate: 0,
						sites: []
					});
				}
				const gameItem = gameProductionMap.get(product.itemId)!;
				gameItem.rate += product.rate;
				gameItem.sites.push({
					siteId: site.siteId,
					siteName: site.siteName,
					rate: product.rate
				});
			}

			// Aggregate consumption
			for (const ingredient of site.totalConsumption) {
				if (!gameConsumptionMap.has(ingredient.itemId)) {
					gameConsumptionMap.set(ingredient.itemId, {
						itemName: ingredient.itemName,
						rate: 0,
						sites: []
					});
				}
				const gameItem = gameConsumptionMap.get(ingredient.itemId)!;
				gameItem.rate += ingredient.rate;
				gameItem.sites.push({
					siteId: site.siteId,
					siteName: site.siteName,
					rate: ingredient.rate
				});
			}

			totalPowerConsumption += site.powerConsumption;
			totalPowerProduction += site.powerProduction;
			totalInstances += site.instanceCount;
			totalBuildings += site.buildingCount;
			totalEfficiencySum += site.averageEfficiency * site.instanceCount;
		}

		// Convert to arrays
		const totalProduction = Array.from(gameProductionMap.entries()).map(([itemId, data]) => ({
			itemId,
			itemName: data.itemName,
			rate: data.rate,
			sites: data.sites
		}));

		const totalConsumption = Array.from(gameConsumptionMap.entries()).map(([itemId, data]) => ({
			itemId,
			itemName: data.itemName,
			rate: data.rate,
			sites: data.sites
		}));

		// Calculate net balance
		const allItemIds = new Set([
			...Array.from(gameProductionMap.keys()),
			...Array.from(gameConsumptionMap.keys())
		]);
		const netBalance = Array.from(allItemIds)
			.map((itemId) => {
				const production = gameProductionMap.get(itemId)?.rate || 0;
				const consumption = gameConsumptionMap.get(itemId)?.rate || 0;
				const itemName =
					gameProductionMap.get(itemId)?.itemName || gameConsumptionMap.get(itemId)?.itemName || '';

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
			netPowerBalance: totalPowerProduction - totalPowerConsumption,
			totalInstances,
			totalBuildings,
			averageEfficiency: totalInstances > 0 ? totalEfficiencySum / totalInstances : 0,
			uniqueItems: allItemIds.size
		};
	}

	private calculatePerformanceMetrics(
		sites: GameDashboardData['sites'],
		aggregated: GameDashboardData['aggregated']
	): GameDashboardData['performance'] {
		// Top producing sites by energy productivity (items produced per MW consumed)
		const topProducingSites = sites
			.map((site) => {
				const totalItemsProduced = site.totalProduction.reduce((sum, p) => sum + p.rate, 0);

				// Calculate productivity score based on site type
				let productionScore: number;

				if (site.powerProduction > 0 && site.powerConsumption === 0) {
					// Power generation sites: use power output as score
					productionScore = site.powerProduction;
				} else if (site.powerConsumption > 0) {
					// Production sites: items produced per MW consumed
					productionScore = totalItemsProduced / site.powerConsumption;
				} else if (totalItemsProduced > 0) {
					// Sites with no power consumption but production (edge case)
					productionScore = totalItemsProduced;
				} else {
					// No production or consumption
					productionScore = 0;
				}

				return {
					siteId: site.siteId,
					siteName: site.siteName,
					productionScore: Number(productionScore.toFixed(2))
				};
			})
			.sort((a, b) => b.productionScore - a.productionScore)
			.slice(0, 10);

		// Energy productivity by site (meaningful energy efficiency)
		const powerEfficiencyBySite = sites
			.map((site) => {
				const totalItemsProduced = site.totalProduction.reduce((sum, p) => sum + p.rate, 0);

				let efficiency: number;

				if (site.powerProduction > 0 && site.powerConsumption === 0) {
					// Power generation sites: energy production efficiency
					efficiency = site.powerProduction;
				} else if (site.powerConsumption > 0) {
					// Production sites: energy productivity (items/MW)
					efficiency = totalItemsProduced / site.powerConsumption;
				} else {
					// Sites with no power consumption
					efficiency = totalItemsProduced;
				}

				return {
					siteId: site.siteId,
					siteName: site.siteName,
					efficiency: Number(efficiency.toFixed(2))
				};
			})
			.sort((a, b) => b.efficiency - a.efficiency);

		// Bottlenecks - items with negative balance
		const bottlenecks = aggregated.netBalance
			.filter((item) => item.balance < 0)
			.map((item) => {
				const consumingSites =
					aggregated.totalConsumption
						.find((c) => c.itemId === item.itemId)
						?.sites.map((s) => s.siteName) || [];

				return {
					itemId: item.itemId,
					itemName: item.itemName,
					deficit: Math.abs(item.balance),
					sites: consumingSites
				};
			})
			.sort((a, b) => b.deficit - a.deficit)
			.slice(0, 10);

		return {
			topProducingSites,
			powerEfficiencyBySite,
			bottlenecks
		};
	}

	// Main public methods
	async getGameDashboard(
		gameId: string,
		userEmail?: string,
		useCache: boolean = true
	): Promise<GameDashboardData | null> {
		// Validate user access
		if (userEmail && !(await this.validateGameAccess(gameId, userEmail))) {
			return null;
		}

		// Check cache first
		if (useCache) {
			const cached = this.getCache(gameId);
			if (cached) {
				return cached;
			}
		}

		// Fetch production data and all sites
		const [gameData, allSites] = await Promise.all([
			this.fetchGameProductionData(gameId),
			db.select({ id: sites.id, name: sites.name }).from(sites).where(eq(sites.gameId, gameId))
		]);

		// Aggregate site data from production instances
		const sitesWithProduction = this.aggregateSiteData(gameData);

		// Include all sites, even those without production instances
		const sitesWithProductionMap = new Map(sitesWithProduction.map((site) => [site.siteId, site]));
		const allSitesWithData = allSites.map((site) => {
			const productionSite = sitesWithProductionMap.get(site.id);
			return (
				productionSite || {
					siteId: site.id,
					siteName: site.name,
					totalProduction: [],
					totalConsumption: [],
					powerConsumption: 0,
					powerProduction: 0,
					instanceCount: 0,
					buildingCount: 0,
					averageEfficiency: 0
				}
			);
		});

		const aggregated = this.aggregateGameData(allSitesWithData);
		const performance = this.calculatePerformanceMetrics(allSitesWithData, aggregated);

		const dashboardData: GameDashboardData = {
			gameId,
			sites: allSitesWithData,
			aggregated,
			performance,
			lastUpdated: new Date()
		};

		// Cache the result
		this.setCache(gameId, dashboardData);

		return dashboardData;
	}

	async refreshGameDashboard(
		gameId: string,
		userEmail?: string
	): Promise<GameDashboardData | null> {
		// Invalidate cache first
		this.invalidateGameDashboardCache(gameId);
		// Fetch fresh data
		return this.getGameDashboard(gameId, userEmail, false);
	}

	// Methods to invalidate cache when related data changes
	async onProductionInstanceChanged(siteId: string): Promise<void> {
		// Get game ID for this site to invalidate cache
		const siteData = await db
			.select({ gameId: sites.gameId })
			.from(sites)
			.where(eq(sites.id, siteId))
			.limit(1);

		if (siteData.length > 0) {
			this.invalidateGameDashboardCache(siteData[0].gameId);
		}
	}

	async onSiteChanged(gameId: string): Promise<void> {
		this.invalidateGameDashboardCache(gameId);
	}

	async onModuleVersionChanged(gameId: string): Promise<void> {
		this.invalidateGameDashboardCache(gameId);
	}
}

export const gameDashboardService = new GameDashboardService();
