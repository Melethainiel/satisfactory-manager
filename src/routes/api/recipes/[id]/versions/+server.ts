import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { recipeService } from '$lib/server/services/recipeService';

// GET /api/recipes/[id]/versions - Get all versions for a recipe
export const GET: RequestHandler = async ({ params }) => {
	try {
		if (!params.id || typeof params.id !== 'string') {
			return json({ error: 'Invalid recipe ID' }, { status: 400 });
		}

		// Check if recipe exists
		const recipe = await recipeService.getRecipeById(params.id);
		if (!recipe) {
			return json({ error: 'Recipe not found' }, { status: 404 });
		}

		const recipeVersions = await recipeService.getRecipeVersions(params.id);
		return json(recipeVersions);
	} catch (error) {
		console.error('Error fetching recipe versions:', error);
		return json({ error: 'Failed to fetch recipe versions' }, { status: 500 });
	}
};

// POST /api/recipes/[id]/versions - Create a new recipe version
export const POST: RequestHandler = async ({ params, request }) => {
	try {
		if (!params.id || typeof params.id !== 'string') {
			return json({ error: 'Invalid recipe ID' }, { status: 400 });
		}

		const versionData = await request.json();

		if (!versionData.moduleVersionId || typeof versionData.moduleVersionId !== 'string') {
			return json({ error: 'moduleVersionId is required' }, { status: 400 });
		}

		if (!versionData.manufacturingDuration || isNaN(Number(versionData.manufacturingDuration))) {
			return json({ error: 'manufacturingDuration must be a valid number' }, { status: 400 });
		}

		// Validate ingredients array
		if (!Array.isArray(versionData.ingredients)) {
			return json({ error: 'ingredients must be an array' }, { status: 400 });
		}

		for (const ingredient of versionData.ingredients) {
			if (!ingredient.itemClassName || typeof ingredient.itemClassName !== 'string') {
				return json({ error: 'Each ingredient must have a valid itemClassName' }, { status: 400 });
			}
			if (!ingredient.count || isNaN(Number(ingredient.count)) || Number(ingredient.count) <= 0) {
				return json({ error: 'Each ingredient must have a valid positive count' }, { status: 400 });
			}
		}

		// Validate products array
		if (!Array.isArray(versionData.products)) {
			return json({ error: 'products must be an array' }, { status: 400 });
		}

		for (const product of versionData.products) {
			if (!product.itemClassName || typeof product.itemClassName !== 'string') {
				return json({ error: 'Each product must have a valid itemClassName' }, { status: 400 });
			}
			if (!product.count || isNaN(Number(product.count)) || Number(product.count) <= 0) {
				return json({ error: 'Each product must have a valid positive count' }, { status: 400 });
			}
		}

		// Validate buildings array
		if (!Array.isArray(versionData.buildings)) {
			return json({ error: 'buildings must be an array' }, { status: 400 });
		}

		for (const building of versionData.buildings) {
			if (!building.buildingClassName || typeof building.buildingClassName !== 'string') {
				return json(
					{ error: 'Each building must have a valid buildingClassName' },
					{ status: 400 }
				);
			}
		}

		// Check if recipe exists
		const recipe = await recipeService.getRecipeById(params.id);
		if (!recipe) {
			return json({ error: 'Recipe not found' }, { status: 404 });
		}

		// Check if version already exists for this module version
		const existingVersion = await recipeService.getRecipeVersionByModuleAndRecipe(
			params.id,
			versionData.moduleVersionId
		);
		if (existingVersion) {
			return json(
				{ error: 'Recipe version already exists for this module version' },
				{ status: 409 }
			);
		}

		// Prepare data for creation
		const ingredients = versionData.ingredients.map((ing: any) => ({
			itemClassName: ing.itemClassName,
			count: ing.count.toString()
		}));

		const products = versionData.products.map((prod: any) => ({
			itemClassName: prod.itemClassName,
			count: prod.count.toString()
		}));

		const buildings = versionData.buildings.map((build: any) => ({
			buildingClassName: build.buildingClassName
		}));

		const recipeVersion = await recipeService.createRecipeVersion(
			params.id,
			{
				moduleVersionId: versionData.moduleVersionId,
				manufacturingDuration: versionData.manufacturingDuration.toString()
			},
			ingredients,
			products,
			buildings
		);

		return json(recipeVersion, { status: 201 });
	} catch (error) {
		console.error('Error creating recipe version:', error);
		return json({ error: 'Failed to create recipe version' }, { status: 500 });
	}
};
