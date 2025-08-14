import { db } from '../db';
import {
	recipes,
	recipeVersions,
	recipeIngredients,
	recipeProducts,
	recipeBuildings,
	type Recipe,
	type NewRecipe,
	type RecipeVersion,
	type NewRecipeVersion,
	type RecipeIngredient,
	type NewRecipeIngredient,
	type RecipeProduct,
	type NewRecipeProduct,
	type RecipeBuilding,
	type NewRecipeBuilding
} from '../db/schema';
import { eq, desc } from 'drizzle-orm';

export interface RecipeVersionWithDetails extends RecipeVersion {
	ingredients: RecipeIngredient[];
	products: RecipeProduct[];
	buildings: RecipeBuilding[];
}

export interface IRecipeService {
	// Recipe CRUD operations
	getAllRecipes(): Promise<Recipe[]>;
	getRecipeById(id: string): Promise<Recipe | undefined>;
	getRecipeByClassName(className: string): Promise<Recipe | undefined>;
	createRecipe(data: Omit<NewRecipe, 'id' | 'createdAt' | 'updatedAt'>): Promise<Recipe>;
	updateRecipe(
		id: string,
		data: Partial<Omit<NewRecipe, 'id' | 'createdAt' | 'updatedAt'>>
	): Promise<Recipe | undefined>;
	deleteRecipe(id: string): Promise<boolean>;

	// Recipe version management
	getRecipeVersions(recipeId: string): Promise<RecipeVersionWithDetails[]>;
	getRecipeVersionsByModuleVersion(moduleVersionId: string): Promise<RecipeVersionWithDetails[]>;
	getRecipeVersionWithDetails(versionId: string): Promise<RecipeVersionWithDetails | undefined>;
	createRecipeVersion(
		recipeId: string,
		versionData: Omit<NewRecipeVersion, 'id' | 'recipeId' | 'createdAt'>,
		ingredients: Omit<NewRecipeIngredient, 'id' | 'recipeVersionId' | 'createdAt'>[],
		products: Omit<NewRecipeProduct, 'id' | 'recipeVersionId' | 'createdAt'>[],
		buildings: Omit<NewRecipeBuilding, 'id' | 'recipeVersionId' | 'createdAt'>[]
	): Promise<RecipeVersionWithDetails>;
	getRecipeVersionByModuleAndRecipe(
		recipeId: string,
		moduleVersionId: string
	): Promise<RecipeVersionWithDetails | undefined>;

	// Bulk operations
	bulkCreateRecipes(
		recipesData: Omit<NewRecipe, 'id' | 'createdAt' | 'updatedAt'>[]
	): Promise<Recipe[]>;

	// Query helpers
	getRecipesByIngredient(itemClassName: string): Promise<Recipe[]>;
	getRecipesByProduct(itemClassName: string): Promise<Recipe[]>;
	getRecipesByBuilding(buildingClassName: string): Promise<Recipe[]>;
}

class RecipeService implements IRecipeService {
	async getAllRecipes(): Promise<Recipe[]> {
		return await db.select().from(recipes).orderBy(recipes.displayName);
	}

	async getRecipeById(id: string): Promise<Recipe | undefined> {
		const [row] = await db.select().from(recipes).where(eq(recipes.id, id));
		return row;
	}

	async getRecipeByClassName(className: string): Promise<Recipe | undefined> {
		const [row] = await db.select().from(recipes).where(eq(recipes.className, className));
		return row;
	}

	async createRecipe(data: Omit<NewRecipe, 'id' | 'createdAt' | 'updatedAt'>): Promise<Recipe> {
		const [row] = await db.insert(recipes).values(data).returning();
		return row;
	}

	async updateRecipe(
		id: string,
		data: Partial<Omit<NewRecipe, 'id' | 'createdAt' | 'updatedAt'>>
	): Promise<Recipe | undefined> {
		const [row] = await db
			.update(recipes)
			.set({
				...data,
				updatedAt: new Date()
			})
			.where(eq(recipes.id, id))
			.returning();
		return row;
	}

	async deleteRecipe(id: string): Promise<boolean> {
		const res = await db.delete(recipes).where(eq(recipes.id, id)).returning({ id: recipes.id });
		return res.length > 0;
	}

	async getRecipeVersions(recipeId: string): Promise<RecipeVersionWithDetails[]> {
		const versions = await db
			.select()
			.from(recipeVersions)
			.where(eq(recipeVersions.recipeId, recipeId))
			.orderBy(desc(recipeVersions.createdAt));

		const versionsWithDetails: RecipeVersionWithDetails[] = [];

		for (const version of versions) {
			const details = await this.getRecipeVersionWithDetails(version.id);
			if (details) {
				versionsWithDetails.push(details);
			}
		}

		return versionsWithDetails;
	}

	async getRecipeVersionsByModuleVersion(
		moduleVersionId: string
	): Promise<RecipeVersionWithDetails[]> {
		const versions = await db
			.select()
			.from(recipeVersions)
			.where(eq(recipeVersions.moduleVersionId, moduleVersionId))
			.orderBy(recipeVersions.recipeId);

		const versionsWithDetails: RecipeVersionWithDetails[] = [];

		for (const version of versions) {
			const details = await this.getRecipeVersionWithDetails(version.id);
			if (details) {
				versionsWithDetails.push(details);
			}
		}

		return versionsWithDetails;
	}

	async getRecipeVersionWithDetails(
		versionId: string
	): Promise<RecipeVersionWithDetails | undefined> {
		const [version] = await db
			.select()
			.from(recipeVersions)
			.where(eq(recipeVersions.id, versionId));

		if (!version) return undefined;

		const [ingredients, products, buildings] = await Promise.all([
			db.select().from(recipeIngredients).where(eq(recipeIngredients.recipeVersionId, versionId)),
			db.select().from(recipeProducts).where(eq(recipeProducts.recipeVersionId, versionId)),
			db.select().from(recipeBuildings).where(eq(recipeBuildings.recipeVersionId, versionId))
		]);

		return {
			...version,
			ingredients,
			products,
			buildings
		};
	}

	async createRecipeVersion(
		recipeId: string,
		versionData: Omit<NewRecipeVersion, 'id' | 'recipeId' | 'createdAt'>,
		ingredients: Omit<NewRecipeIngredient, 'id' | 'recipeVersionId' | 'createdAt'>[],
		products: Omit<NewRecipeProduct, 'id' | 'recipeVersionId' | 'createdAt'>[],
		buildings: Omit<NewRecipeBuilding, 'id' | 'recipeVersionId' | 'createdAt'>[]
	): Promise<RecipeVersionWithDetails> {
		// Create recipe version
		const [version] = await db
			.insert(recipeVersions)
			.values({
				recipeId,
				...versionData
			})
			.returning();

		// Create ingredients, products, and buildings
		const [createdIngredients, createdProducts, createdBuildings] = await Promise.all([
			ingredients.length > 0
				? db
						.insert(recipeIngredients)
						.values(ingredients.map((ing) => ({ ...ing, recipeVersionId: version.id })))
						.returning()
				: Promise.resolve([]),
			products.length > 0
				? db
						.insert(recipeProducts)
						.values(products.map((prod) => ({ ...prod, recipeVersionId: version.id })))
						.returning()
				: Promise.resolve([]),
			buildings.length > 0
				? db
						.insert(recipeBuildings)
						.values(buildings.map((build) => ({ ...build, recipeVersionId: version.id })))
						.returning()
				: Promise.resolve([])
		]);

		return {
			...version,
			ingredients: createdIngredients,
			products: createdProducts,
			buildings: createdBuildings
		};
	}

	async getRecipeVersionByModuleAndRecipe(
		recipeId: string,
		moduleVersionId: string
	): Promise<RecipeVersionWithDetails | undefined> {
		const [version] = await db
			.select()
			.from(recipeVersions)
			.where(
				eq(recipeVersions.recipeId, recipeId) && eq(recipeVersions.moduleVersionId, moduleVersionId)
			);

		if (!version) return undefined;

		return this.getRecipeVersionWithDetails(version.id);
	}

	async bulkCreateRecipes(
		recipesData: Omit<NewRecipe, 'id' | 'createdAt' | 'updatedAt'>[]
	): Promise<Recipe[]> {
		if (recipesData.length === 0) return [];
		return await db.insert(recipes).values(recipesData).returning();
	}

	async getRecipesByIngredient(itemClassName: string): Promise<Recipe[]> {
		const recipeIds = await db
			.selectDistinct({ recipeId: recipeVersions.recipeId })
			.from(recipeVersions)
			.innerJoin(recipeIngredients, eq(recipeIngredients.recipeVersionId, recipeVersions.id))
			.where(eq(recipeIngredients.itemClassName, itemClassName));

		if (recipeIds.length === 0) return [];

		return await db
			.select()
			.from(recipes)
			.where(eq(recipes.id, recipeIds[0].recipeId))
			.orderBy(recipes.displayName);
	}

	async getRecipesByProduct(itemClassName: string): Promise<Recipe[]> {
		const recipeIds = await db
			.selectDistinct({ recipeId: recipeVersions.recipeId })
			.from(recipeVersions)
			.innerJoin(recipeProducts, eq(recipeProducts.recipeVersionId, recipeVersions.id))
			.where(eq(recipeProducts.itemClassName, itemClassName));

		if (recipeIds.length === 0) return [];

		return await db
			.select()
			.from(recipes)
			.where(eq(recipes.id, recipeIds[0].recipeId))
			.orderBy(recipes.displayName);
	}

	async getRecipesByBuilding(buildingClassName: string): Promise<Recipe[]> {
		const recipeIds = await db
			.selectDistinct({ recipeId: recipeVersions.recipeId })
			.from(recipeVersions)
			.innerJoin(recipeBuildings, eq(recipeBuildings.recipeVersionId, recipeVersions.id))
			.where(eq(recipeBuildings.buildingClassName, buildingClassName));

		if (recipeIds.length === 0) return [];

		return await db
			.select()
			.from(recipes)
			.where(eq(recipes.id, recipeIds[0].recipeId))
			.orderBy(recipes.displayName);
	}
}

export const recipeService: IRecipeService = new RecipeService();
