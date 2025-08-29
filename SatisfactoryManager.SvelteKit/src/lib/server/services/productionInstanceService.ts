import { db } from '../db';
import { broadcastToGame } from './sseService.js';
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
	modules,
	type ProductionInstance,
	type NewProductionInstance
} from '../db/schema';
import { alias } from 'drizzle-orm/pg-core';
import { eq, desc, and } from 'drizzle-orm';
import { productionCalculationService } from './productionCalculationService';
import { gameDashboardService } from './gameDashboardService';

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
		const result = await db
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
					energyProduction: buildingVersions.energyProduction
				}
			})
			.from(productionInstances)
			.leftJoin(sites, eq(productionInstances.siteId, sites.id))
			.leftJoin(recipeVersions, eq(productionInstances.recipeVersionId, recipeVersions.id))
			.leftJoin(recipes, eq(recipeVersions.recipeId, recipes.id))
			.leftJoin(buildingVersions, eq(productionInstances.buildingVersionId, buildingVersions.id))
			.leftJoin(buildings, eq(buildingVersions.buildingId, buildings.id))
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
		} else if (instanceData.extractedItemVersionId) {
			// For extraction instances - create synthetic product from extractedItemVersionId
			const extractedItemVersion = await db
				.select({
					id: itemVersions.id,
					itemId: itemVersions.itemId,
					displayName: items.displayName,
					className: items.className,
					form: items.form
				})
				.from(itemVersions)
				.innerJoin(items, eq(itemVersions.itemId, items.id))
				.where(eq(itemVersions.id, instanceData.extractedItemVersionId))
				.limit(1);

			if (extractedItemVersion.length > 0) {
				products = [
					{
						itemId: extractedItemVersion[0].itemId,
						count: '1', // Placeholder count for extraction
						item: {
							displayName: extractedItemVersion[0].displayName,
							className: extractedItemVersion[0].className,
							form: extractedItemVersion[0].form
						}
					}
				];
			}
		} else if (instanceData.fuelItemVersionId) {
			// For generator instances - create synthetic ingredient from fuelItemVersionId
			const fuelItemVersion = await db
				.select({
					id: itemVersions.id,
					itemId: itemVersions.itemId,
					displayName: items.displayName,
					className: items.className,
					form: items.form
				})
				.from(itemVersions)
				.innerJoin(items, eq(itemVersions.itemId, items.id))
				.where(eq(itemVersions.id, instanceData.fuelItemVersionId))
				.limit(1);

			if (fuelItemVersion.length > 0) {
				ingredients = [
					{
						itemId: fuelItemVersion[0].itemId,
						count: '1', // Placeholder count for fuel
						item: {
							displayName: fuelItemVersion[0].displayName,
							className: fuelItemVersion[0].className,
							form: fuelItemVersion[0].form
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

		// Invalidate cache for the site and broadcast creation
		if (data.siteId) {
			await productionCalculationService.onProductionInstanceChanged(data.siteId);
			await gameDashboardService.onProductionInstanceChanged(data.siteId);

			// Get gameId for WebSocket broadcast
			const siteData = await db
				.select({ gameId: sites.gameId })
				.from(sites)
				.where(eq(sites.id, data.siteId))
				.limit(1);

			// Broadcast real-time creation via SSE
			if (siteData.length > 0 && siteData[0].gameId && result) {
				console.log('📡 Broadcasting production_instance_created to game:', siteData[0].gameId);
				broadcastToGame(siteData[0].gameId, {
					type: 'production_instance_created',
					data: {
						gameId: siteData[0].gameId,
						siteId: result.siteId,
						instanceId: result.id,
						instanceData: result,
						userId: 'system',
						userName: 'System'
					}
				});
			} else {
				console.log('📡 Not broadcasting - gameId:', siteData[0]?.gameId, 'result:', !!result);
			}
		}

		return result;
	}

	async updateProductionInstance(
		id: string,
		data: Partial<Omit<NewProductionInstance, 'id' | 'createdAt' | 'updatedAt'>>
	): Promise<ProductionInstance | undefined> {
		// Get the current instance to know which site to invalidate cache for and get gameId for WebSocket broadcast
		const currentInstance = await db
			.select({
				siteId: productionInstances.siteId,
				gameId: sites.gameId
			})
			.from(productionInstances)
			.leftJoin(sites, eq(productionInstances.siteId, sites.id))
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
			await gameDashboardService.onProductionInstanceChanged(currentInstance[0].siteId);

			// Broadcast real-time update via WebSocket
			if (currentInstance[0].gameId && result) {
				console.log(
					'📡 Broadcasting production_instance_updated to game:',
					currentInstance[0].gameId
				);
				broadcastToGame(currentInstance[0].gameId, {
					type: 'production_instance_updated',
					data: {
						gameId: currentInstance[0].gameId,
						siteId: result.siteId,
						instanceId: result.id,
						changes: data,
						instanceData: result,
						userId: 'system',
						userName: 'System'
					}
				});
			} else {
				console.log(
					'📡 Not broadcasting - gameId:',
					currentInstance[0]?.gameId,
					'result:',
					!!result
				);
			}
		}

		return result;
	}

	async deleteProductionInstance(id: string): Promise<boolean> {
		// First get gameId before deletion
		const instanceData = await db
			.select({
				gameId: sites.gameId,
				siteId: productionInstances.siteId
			})
			.from(productionInstances)
			.leftJoin(sites, eq(productionInstances.siteId, sites.id))
			.where(eq(productionInstances.id, id))
			.limit(1);

		const result = await db
			.delete(productionInstances)
			.where(eq(productionInstances.id, id))
			.returning({ id: productionInstances.id, siteId: productionInstances.siteId });

		// Invalidate cache for the site and broadcast deletion
		if (result.length > 0 && instanceData.length > 0) {
			await productionCalculationService.onProductionInstanceChanged(result[0].siteId);
			await gameDashboardService.onProductionInstanceChanged(result[0].siteId);

			// Broadcast real-time deletion via WebSocket
			if (instanceData[0].gameId) {
				console.log('📡 Broadcasting production_instance_deleted to game:', instanceData[0].gameId);
				broadcastToGame(instanceData[0].gameId, {
					type: 'production_instance_deleted',
					data: {
						gameId: instanceData[0].gameId,
						siteId: result[0].siteId,
						instanceId: result[0].id,
						userId: 'system',
						userName: 'System'
					}
				});
			}
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

		// Check if building version exists
		if (data.buildingVersionId) {
			const buildingVersion = await db
				.select()
				.from(buildingVersions)
				.where(eq(buildingVersions.id, data.buildingVersionId))
				.limit(1);

			if (buildingVersion.length === 0) {
				errors.push('Building version does not exist');
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
