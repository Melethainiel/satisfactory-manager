import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { recipeService } from '$lib/server/services/recipeService';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { moduleVersions } from '$lib/server/db/schema';

interface ImportRecipeData {
	className: string;
	displayName: string;
	manufacturingDuration: number;
	ingredients: Array<{
		item: string;
		count: number;
	}>;
	products: Array<{
		item: string;
		count: number;
	}>;
	craftedIn: string[];
}

// POST /api/recipes/import - Bulk import recipe data
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { recipes: recipesData, moduleVersionId } = await request.json();

		if (!Array.isArray(recipesData) || recipesData.length === 0) {
			return json({ error: 'recipes array is required and must not be empty' }, { status: 400 });
		}

		if (!moduleVersionId || typeof moduleVersionId !== 'string') {
			return json({ error: 'moduleVersionId is required' }, { status: 400 });
		}

		// Validate that the module version exists
		const [moduleVersion] = await db
			.select()
			.from(moduleVersions)
			.where(eq(moduleVersions.id, moduleVersionId));

		if (!moduleVersion) {
			return json({ error: 'Invalid moduleVersionId' }, { status: 400 });
		}

		const results = {
			created: 0,
			updated: 0,
			versionsCreated: 0,
			errors: [] as string[]
		};

		for (const recipeData of recipesData as ImportRecipeData[]) {
			try {
				// Validate required fields
				if (
					!recipeData.className ||
					typeof recipeData.className !== 'string' ||
					!recipeData.className.trim()
				) {
					results.errors.push(
						`Invalid recipe data: missing or invalid className for ${recipeData.className || 'unknown'}`
					);
					continue;
				}

				if (
					!recipeData.displayName ||
					typeof recipeData.displayName !== 'string' ||
					!recipeData.displayName.trim()
				) {
					results.errors.push(
						`Invalid recipe data: missing or invalid displayName for ${recipeData.className}`
					);
					continue;
				}

				if (
					!recipeData.manufacturingDuration ||
					isNaN(Number(recipeData.manufacturingDuration)) ||
					recipeData.manufacturingDuration <= 0
				) {
					results.errors.push(
						`Invalid recipe data: manufacturingDuration must be a positive number for ${recipeData.className}`
					);
					continue;
				}

				// Validate ingredients
				if (!Array.isArray(recipeData.ingredients)) {
					results.errors.push(
						`Invalid recipe data: ingredients must be an array for ${recipeData.className}`
					);
					continue;
				}

				let validIngredients = true;
				for (const ingredient of recipeData.ingredients) {
					if (
						!ingredient.item ||
						typeof ingredient.item !== 'string' ||
						!ingredient.count ||
						isNaN(Number(ingredient.count)) ||
						ingredient.count <= 0
					) {
						results.errors.push(`Invalid ingredient data in recipe ${recipeData.className}`);
						validIngredients = false;
						break;
					}
				}

				if (!validIngredients) continue;

				// Validate products
				if (!Array.isArray(recipeData.products)) {
					results.errors.push(
						`Invalid recipe data: products must be an array for ${recipeData.className}`
					);
					continue;
				}

				let validProducts = true;
				for (const product of recipeData.products) {
					if (
						!product.item ||
						typeof product.item !== 'string' ||
						!product.count ||
						isNaN(Number(product.count)) ||
						product.count <= 0
					) {
						results.errors.push(`Invalid product data in recipe ${recipeData.className}`);
						validProducts = false;
						break;
					}
				}

				if (!validProducts) continue;

				// Validate craftedIn (buildings)
				if (!Array.isArray(recipeData.craftedIn) || recipeData.craftedIn.length === 0) {
					results.errors.push(
						`Invalid recipe data: craftedIn must be a non-empty array for ${recipeData.className}`
					);
					continue;
				}

				// Check if recipe exists
				let recipe = await recipeService.getRecipeByClassName(recipeData.className.trim());

				if (!recipe) {
					// Create new recipe
					recipe = await recipeService.createRecipe({
						className: recipeData.className.trim(),
						displayName: recipeData.displayName.trim()
					});
					results.created++;
				} else if (recipe.displayName !== recipeData.displayName.trim()) {
					// Update recipe if displayName changed
					recipe = await recipeService.updateRecipe(recipe.id, {
						displayName: recipeData.displayName.trim()
					});
					results.updated++;
				}

				if (recipe) {
					// Check if recipe version already exists for this module version
					const existingVersion = await recipeService.getRecipeVersionByModuleAndRecipe(
						recipe.id,
						moduleVersionId
					);

					if (!existingVersion) {
						// Prepare ingredients, products, and buildings data
						const ingredients = recipeData.ingredients.map((ing) => ({
							itemClassName: ing.item,
							count: ing.count.toString()
						}));

						const products = recipeData.products.map((prod) => ({
							itemClassName: prod.item,
							count: prod.count.toString()
						}));

						const buildings = recipeData.craftedIn.map((buildingClassName) => ({
							buildingClassName
						}));

						// Create recipe version
						await recipeService.createRecipeVersion(
							recipe.id,
							{
								moduleVersionId,
								manufacturingDuration: recipeData.manufacturingDuration.toString()
							},
							ingredients,
							products,
							buildings
						);
						results.versionsCreated++;
					}
				}
			} catch (error) {
				results.errors.push(`Error processing recipe ${recipeData.className}: ${error}`);
			}
		}

		return json(results);
	} catch (error) {
		console.error('Error importing recipes:', error);
		return json({ error: 'Failed to import recipes' }, { status: 500 });
	}
};
