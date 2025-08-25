import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { recipeService } from '$lib/server/services/recipeService';

// GET /api/recipes - List all recipes with optional filtering
export const GET: RequestHandler = async ({ url }) => {
	try {
		const gameId = url.searchParams.get('gameId');
		const search = url.searchParams.get('search');
		const ingredient = url.searchParams.get('ingredient');
		const product = url.searchParams.get('product');
		const building = url.searchParams.get('building');

		// When gameId is provided, filter recipes by game's configured module versions
		let recipes;
		if (gameId && search) {
			recipes = await recipeService.searchRecipesByGameAndName(gameId, search);
		} else if (search) {
			recipes = await recipeService.searchRecipesByName(search);
		} else if (ingredient) {
			recipes = await recipeService.getRecipesByIngredient(ingredient);
		} else if (product) {
			recipes = await recipeService.getRecipesByProduct(product);
		} else if (building) {
			recipes = await recipeService.getRecipesByBuilding(building);
		} else {
			recipes = await recipeService.getAllRecipes();
		}

		return json(recipes);
	} catch (error) {
		console.error('Error fetching recipes:', error);
		return json({ error: 'Failed to fetch recipes' }, { status: 500 });
	}
};

// POST /api/recipes - Create a new recipe
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { className, displayName, moduleId } = await request.json();

		if (!className || typeof className !== 'string' || !className.trim()) {
			return json({ error: 'Recipe className is required' }, { status: 400 });
		}

		if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
			return json({ error: 'Recipe displayName is required' }, { status: 400 });
		}

		if (!moduleId || typeof moduleId !== 'string' || !moduleId.trim()) {
			return json({ error: 'Recipe moduleId is required' }, { status: 400 });
		}

		// Check if recipe with this className already exists
		const existingRecipe = await recipeService.getRecipeByClassName(className.trim());
		if (existingRecipe) {
			return json({ error: 'A recipe with this className already exists' }, { status: 409 });
		}

		const recipe = await recipeService.createRecipe({
			moduleId: moduleId.trim(),
			className: className.trim(),
			displayName: displayName.trim()
		});

		return json(recipe, { status: 201 });
	} catch (error) {
		console.error('Error creating recipe:', error);
		return json({ error: 'Failed to create recipe' }, { status: 500 });
	}
};
