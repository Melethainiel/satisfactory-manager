import { db } from '../db';
import {
	items,
	itemVersions,
	buildings,
	buildingVersions,
	recipeVersions,
	recipeProducts,
	moduleGames,
	moduleVersions,
	modules,
	recipes,
	type Item,
	type NewItem,
	type ItemVersion,
	type NewItemVersion,
	type ItemForm,
	type Building as DBBuilding
} from '../db/schema';
import { eq, desc, and, inArray, ilike, isNotNull, sql } from 'drizzle-orm';

export interface IItemService {
	// Item CRUD operations
	getAllItems(): Promise<Item[]>;
	getItemById(id: string): Promise<Item | undefined>;
	getItemByClassName(className: string): Promise<Item | undefined>;
	createItem(data: Omit<NewItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<Item>;
	updateItem(
		id: string,
		data: Partial<Omit<NewItem, 'id' | 'createdAt' | 'updatedAt'>>
	): Promise<Item | undefined>;
	deleteItem(id: string): Promise<boolean>;

	// Item version management
	getItemVersions(itemId: string): Promise<ItemVersion[]>;
	getItemVersionsByModuleVersion(moduleVersionId: string): Promise<ItemVersion[]>;
	addItemVersion(
		itemId: string,
		versionData: Omit<NewItemVersion, 'id' | 'itemId' | 'createdAt'>
	): Promise<ItemVersion>;
	getItemVersionByModuleAndItem(
		itemId: string,
		moduleVersionId: string
	): Promise<ItemVersion | undefined>;

	// Bulk operations
	bulkCreateItems(itemsData: Omit<NewItem, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Item[]>;
	bulkCreateItemVersions(
		versionsData: Omit<NewItemVersion, 'id' | 'createdAt'>[]
	): Promise<ItemVersion[]>;

	// Helper methods
	getItemsByForm(form: ItemForm): Promise<Item[]>;
	getItemsByClassNames(classNames: string[]): Promise<Item[]>;
	getExistingVersionsForModule(
		itemIds: string[],
		moduleVersionId: string
	): Promise<Map<string, ItemVersion>>;

	// Production-related methods
	searchItemsByGameAndName(gameId: string, searchTerm: string): Promise<ItemWithVersion[]>;
	getItemProductionOptions(gameId: string, itemId: string): Promise<ProductionOptions>;
	getExtractorsForItem(gameId: string, itemId: string): Promise<Building[]>;
	getGeneratorsForItem(gameId: string, itemId: string): Promise<Building[]>;
}

// New interfaces for production system
export interface ItemWithVersion {
	id: string;
	displayName: string;
	className: string;
	form: ItemForm;
	// Version info automatically determined by game configuration
	itemVersionId: string;
	energyValue: string;
	moduleVersion: {
		version: string;
		module: {
			name: string;
		};
	};
}

export interface Recipe {
	id: string;
	displayName: string;
	className: string;
	recipeVersionId: string;
	manufacturingDuration: string;
}

export interface Building {
	id: string;
	name: string;
	type: string;
	className: string;
	// Energy data for generators (stored in original DB units)
	energyProduction?: string;
	burnTime?: number;
	consumptionPerMinute?: number;
	// Display values (converted units)
	energyProductionMW?: number;
}

export interface ProductionOptions {
	canExtract: boolean;
	canCraft: boolean;
	canGeneratePower: boolean;
	extractors: Building[];
	recipes: Recipe[];
	generators: Building[];
}

class ItemService implements IItemService {
	async getAllItems(): Promise<Item[]> {
		return await db.select().from(items).orderBy(items.displayName);
	}

	async getItemById(id: string): Promise<Item | undefined> {
		const [row] = await db.select().from(items).where(eq(items.id, id));
		return row;
	}

	async getItemByClassName(className: string): Promise<Item | undefined> {
		const [row] = await db.select().from(items).where(eq(items.className, className));
		return row;
	}

	async createItem(data: Omit<NewItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<Item> {
		const [row] = await db.insert(items).values(data).returning();
		return row;
	}

	async updateItem(
		id: string,
		data: Partial<Omit<NewItem, 'id' | 'createdAt' | 'updatedAt'>>
	): Promise<Item | undefined> {
		const [row] = await db.update(items).set(data).where(eq(items.id, id)).returning();
		return row;
	}

	async deleteItem(id: string): Promise<boolean> {
		const res = await db.delete(items).where(eq(items.id, id)).returning({ id: items.id });
		return res.length > 0;
	}

	async getItemVersions(itemId: string): Promise<ItemVersion[]> {
		return await db
			.select()
			.from(itemVersions)
			.where(eq(itemVersions.itemId, itemId))
			.orderBy(desc(itemVersions.createdAt));
	}

	async getItemVersionsByModuleVersion(moduleVersionId: string): Promise<ItemVersion[]> {
		return await db
			.select()
			.from(itemVersions)
			.where(eq(itemVersions.moduleVersionId, moduleVersionId))
			.orderBy(itemVersions.itemId);
	}

	async addItemVersion(
		itemId: string,
		versionData: Omit<NewItemVersion, 'id' | 'itemId' | 'createdAt'>
	): Promise<ItemVersion> {
		const [version] = await db
			.insert(itemVersions)
			.values({
				itemId,
				...versionData
			})
			.returning();
		return version;
	}

	async getItemVersionByModuleAndItem(
		itemId: string,
		moduleVersionId: string
	): Promise<ItemVersion | undefined> {
		const [row] = await db
			.select()
			.from(itemVersions)
			.where(
				and(eq(itemVersions.itemId, itemId), eq(itemVersions.moduleVersionId, moduleVersionId))
			);
		return row;
	}

	async bulkCreateItems(
		itemsData: Omit<NewItem, 'id' | 'createdAt' | 'updatedAt'>[]
	): Promise<Item[]> {
		if (itemsData.length === 0) return [];
		return await db.insert(items).values(itemsData).returning();
	}

	async bulkCreateItemVersions(
		versionsData: Omit<NewItemVersion, 'id' | 'createdAt'>[]
	): Promise<ItemVersion[]> {
		if (versionsData.length === 0) return [];
		return await db.insert(itemVersions).values(versionsData).returning();
	}

	async getItemsByForm(form: ItemForm): Promise<Item[]> {
		return await db.select().from(items).where(eq(items.form, form)).orderBy(items.displayName);
	}

	async getItemsByClassNames(classNames: string[]): Promise<Item[]> {
		if (classNames.length === 0) return [];
		return await db.select().from(items).where(inArray(items.className, classNames));
	}

	async getExistingVersionsForModule(
		itemIds: string[],
		moduleVersionId: string
	): Promise<Map<string, ItemVersion>> {
		if (itemIds.length === 0) return new Map();

		const versions = await db
			.select()
			.from(itemVersions)
			.where(
				and(
					inArray(itemVersions.itemId, itemIds),
					eq(itemVersions.moduleVersionId, moduleVersionId)
				)
			);

		return new Map(versions.map((v) => [v.itemId, v]));
	}

	// Production-related methods
	async searchItemsByGameAndName(gameId: string, searchTerm: string): Promise<ItemWithVersion[]> {
		const results = await db
			.select({
				id: items.id,
				displayName: items.displayName,
				className: items.className,
				form: items.form,
				itemVersionId: itemVersions.id,
				energyValue: itemVersions.energyValue,
				moduleVersion: sql<{
					version: string;
					module: { name: string };
				}>`json_build_object('version', ${moduleVersions.version}, 'module', json_build_object('name', ${modules.name}))`
			})
			.from(items)
			.innerJoin(itemVersions, eq(items.id, itemVersions.itemId))
			.innerJoin(moduleVersions, eq(itemVersions.moduleVersionId, moduleVersions.id))
			.innerJoin(modules, eq(moduleVersions.moduleId, modules.id))
			.innerJoin(
				moduleGames,
				and(
					eq(moduleGames.gameId, gameId),
					eq(moduleGames.moduleId, modules.id),
					isNotNull(moduleGames.selectedVersionId),
					eq(moduleGames.selectedVersionId, moduleVersions.id)
				)
			)
			.where(ilike(items.displayName, `%${searchTerm}%`))
			.orderBy(items.displayName);

		return results;
	}

	async getItemProductionOptions(gameId: string, itemId: string): Promise<ProductionOptions> {
		// Get extractors (buildings of type 'Miner' that are configured for this game)
		const extractors = await this.getExtractorsForItem(gameId, itemId);

		// Get recipes that produce this item
		const recipes = await this.getRecipesProducingItem(gameId, itemId);

		// Get generators (buildings of type 'Generator' that can use this item as fuel)
		const generators = await this.getGeneratorsForItem(gameId, itemId);

		return {
			canExtract: extractors.length > 0,
			canCraft: recipes.length > 0,
			canGeneratePower: generators.length > 0,
			extractors,
			recipes,
			generators
		};
	}

	async getExtractorsForItem(gameId: string, itemId: string): Promise<Building[]> {
		// For now, return miners that are available in the game's selected modules
		// TODO: Later we can add logic to check if the item can actually be extracted
		// (requires itemDeposits table or similar)
		const extractors = await db
			.select({
				id: buildings.id,
				name: buildings.name,
				className: buildings.className,
				type: buildings.type
			})
			.from(buildings)
			.innerJoin(modules, eq(buildings.moduleId, modules.id))
			.innerJoin(
				moduleGames,
				and(
					eq(moduleGames.gameId, gameId),
					eq(moduleGames.moduleId, modules.id),
					isNotNull(moduleGames.selectedVersionId)
				)
			)
			.where(eq(buildings.type, 'Miner'));

		return extractors;
	}

	async getGeneratorsForItem(gameId: string, itemId: string): Promise<Building[]> {
		// Get generators that are available in the game's selected modules AND can use this item as fuel
		// Check if the item has energy value > 0 to be usable as fuel
		const results = await db
			.select({
				id: buildings.id,
				name: buildings.name,
				className: buildings.className,
				type: buildings.type,
				energyProduction: buildingVersions.energyProduction,
				energyValue: itemVersions.energyValue
			})
			.from(buildings)
			.innerJoin(modules, eq(buildings.moduleId, modules.id))
			.innerJoin(
				moduleGames,
				and(
					eq(moduleGames.gameId, gameId),
					eq(moduleGames.moduleId, modules.id),
					isNotNull(moduleGames.selectedVersionId)
				)
			)
			.innerJoin(
				buildingVersions,
				and(
					eq(buildingVersions.buildingId, buildings.id),
					sql`${buildingVersions.energyProduction} > 0`
				)
			)
			.innerJoin(
				itemVersions,
				and(eq(itemVersions.itemId, itemId), sql`${itemVersions.energyValue} > 0`)
			)
			.where(eq(buildings.type, 'Generator'));

		// Calculate burn time and consumption per minute for each generator
		const generators: Building[] = results.map((result) => {
			const energyProductionGJ = parseFloat(result.energyProduction || '0');
			const energyValueGJ = parseFloat(result.energyValue || '0');

			// Convert units for calculations and display
			const energyProductionMW = energyProductionGJ * 1000; // GJ → MW (1 GJ = 1000 MW)
			
			// burnTime = energyValue(GJ) / energyProduction(GJ) (en secondes)
			const burnTime = energyValueGJ / energyProductionGJ;

			// consommation par minute = 60 / burnTime
			const consumptionPerMinute = 60 / burnTime;

			return {
				id: result.id,
				name: result.name,
				className: result.className,
				type: result.type,
				energyProduction: result.energyProduction || undefined,
				energyProductionMW,
				burnTime,
				consumptionPerMinute
			};
		});

		return generators;
	}

	private async getRecipesProducingItem(gameId: string, itemId: string): Promise<Recipe[]> {
		const results = await db
			.select({
				id: recipes.id,
				displayName: recipes.displayName,
				className: recipes.className,
				recipeVersionId: recipeVersions.id,
				manufacturingDuration: recipeVersions.manufacturingDuration
			})
			.from(recipes)
			.innerJoin(recipeVersions, eq(recipes.id, recipeVersions.recipeId))
			.innerJoin(recipeProducts, eq(recipeVersions.id, recipeProducts.recipeVersionId))
			.innerJoin(moduleVersions, eq(recipeVersions.moduleVersionId, moduleVersions.id))
			.innerJoin(modules, eq(moduleVersions.moduleId, modules.id))
			.innerJoin(
				moduleGames,
				and(
					eq(moduleGames.gameId, gameId),
					eq(moduleGames.moduleId, modules.id),
					isNotNull(moduleGames.selectedVersionId),
					eq(moduleGames.selectedVersionId, moduleVersions.id)
				)
			)
			.where(eq(recipeProducts.itemId, itemId))
			.orderBy(recipes.displayName);

		return results;
	}
}

export const itemService: IItemService = new ItemService();
