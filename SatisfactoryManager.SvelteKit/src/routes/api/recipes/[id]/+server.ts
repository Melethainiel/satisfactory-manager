import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { recipeService } from '$lib/server/services/recipeService';

// GET /api/recipes/[id] - Get recipe by ID
export const GET: RequestHandler = async ({ params }) => {
	try {
		if (!params.id || typeof params.id !== 'string') {
			return json({ error: 'Invalid recipe ID' }, { status: 400 });
		}

		const recipe = await recipeService.getRecipeById(params.id);

		if (!recipe) {
			return json({ error: 'Recipe not found' }, { status: 404 });
		}

		return json(recipe);
	} catch (error) {
		console.error('Error fetching recipe:', error);
		return json({ error: 'Failed to fetch recipe' }, { status: 500 });
	}
};

// PATCH /api/recipes/[id] - Update recipe
export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		if (!params.id || typeof params.id !== 'string') {
			return json({ error: 'Invalid recipe ID' }, { status: 400 });
		}

		const updates = await request.json();

		// Validate update fields
		if (updates.className !== undefined) {
			if (typeof updates.className !== 'string' || !updates.className.trim()) {
				return json({ error: 'Invalid className' }, { status: 400 });
			}
			updates.className = updates.className.trim();
		}

		if (updates.displayName !== undefined) {
			if (typeof updates.displayName !== 'string' || !updates.displayName.trim()) {
				return json({ error: 'Invalid displayName' }, { status: 400 });
			}
			updates.displayName = updates.displayName.trim();
		}

		const recipe = await recipeService.updateRecipe(params.id, updates);

		if (!recipe) {
			return json({ error: 'Recipe not found' }, { status: 404 });
		}

		return json(recipe);
	} catch (error) {
		console.error('Error updating recipe:', error);
		return json({ error: 'Failed to update recipe' }, { status: 500 });
	}
};

// DELETE /api/recipes/[id] - Delete recipe
export const DELETE: RequestHandler = async ({ params }) => {
	try {
		if (!params.id || typeof params.id !== 'string') {
			return json({ error: 'Invalid recipe ID' }, { status: 400 });
		}

		const deleted = await recipeService.deleteRecipe(params.id);

		if (!deleted) {
			return json({ error: 'Recipe not found' }, { status: 404 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting recipe:', error);
		return json({ error: 'Failed to delete recipe' }, { status: 500 });
	}
};
