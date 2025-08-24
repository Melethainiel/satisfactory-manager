import { getContext, setContext } from 'svelte';

// TypeScript interfaces for recipe-related data
export interface Recipe {
	id: string;
	displayName: string;
	className: string;
	// Version is automatically determined by game configuration
	recipeVersionId: string;
	manufacturingDuration: number;
	moduleVersion: {
		version: string;
		module: {
			name: string;
		};
	};
}

export interface Building {
	id: string;
	name: string;
	type: string;
	className: string;
}

export interface RecipeState {
	// Data states
	searchResults: Recipe[];
	selectedRecipe: Recipe | null;
	availableBuildings: Building[];
	
	// UI states
	isSearching: boolean;
	isLoadingBuildings: boolean;
	
	// Methods
	searchRecipes: (gameId: string, query: string) => Promise<Recipe[]>;
	loadCompatibleBuildings: (recipeVersionId: string) => Promise<Building[]>;
	clearResults: () => void;
	
	// Authentication
	attachAuth: (apiFetch: AuthFetchFn) => void;
}

// Auth fetch function type (same as in gameState)
type AuthFetchFn = <T = any>(
	input: string | URL | Request,
	init?: RequestInit & { autoJson?: boolean }
) => Promise<T | Response>;

class RecipeStateClass implements RecipeState {
	// Reactive states using Svelte 5 runes
	searchResults = $state<Recipe[]>([]);
	selectedRecipe = $state<Recipe | null>(null);
	availableBuildings = $state<Building[]>([]);
	
	// UI states
	isSearching = $state(false);
	isLoadingBuildings = $state(false);
	
	// Private auth function
	private apiFetch: AuthFetchFn | null = null;
	
	attachAuth(apiFetch: AuthFetchFn) {
		this.apiFetch = apiFetch;
	}
	
	async searchRecipes(gameId: string, query: string): Promise<Recipe[]> {
		if (!this.apiFetch) {
			throw new Error('Authentication not attached to recipeState');
		}
		
		if (!query.trim()) {
			this.searchResults = [];
			return [];
		}
		
		this.isSearching = true;
		try {
			const res = await this.apiFetch(`/api/recipes?gameId=${encodeURIComponent(gameId)}&search=${encodeURIComponent(query.trim())}`);
			if (!res.ok) throw new Error(`Failed to search recipes (${res.status})`);
			const results = (await res.json()) as Recipe[];
			this.searchResults = results;
			return results;
		} catch (error) {
			console.error('Failed to search recipes:', error);
			this.searchResults = [];
			throw error;
		} finally {
			this.isSearching = false;
		}
	}
	
	async loadCompatibleBuildings(recipeVersionId: string): Promise<Building[]> {
		if (!this.apiFetch) {
			throw new Error('Authentication not attached to recipeState');
		}
		
		if (!recipeVersionId) {
			this.availableBuildings = [];
			return [];
		}
		
		this.isLoadingBuildings = true;
		try {
			const res = await this.apiFetch(`/api/recipes/versions/${recipeVersionId}/buildings`);
			if (!res.ok) throw new Error(`Failed to load buildings (${res.status})`);
			const buildings = (await res.json()) as Building[];
			
			this.availableBuildings = buildings;
			return buildings;
		} catch (error) {
			console.error('Failed to load compatible buildings:', error);
			// Fallback to empty array if API fails
			this.availableBuildings = [];
			return [];
		} finally {
			this.isLoadingBuildings = false;
		}
	}
	
	clearResults() {
		this.searchResults = [];
		this.selectedRecipe = null;
		this.availableBuildings = [];
	}
}

// Context management
const RECIPE_STATE_KEY = Symbol('recipeState');

export function setRecipeState(recipeState: RecipeState) {
	return setContext<RecipeState>(RECIPE_STATE_KEY, recipeState);
}

export function getRecipeState(): RecipeState {
	const existingState = getContext<RecipeState | undefined>(RECIPE_STATE_KEY);
	if (existingState) {
		return existingState;
	}
	
	// Create new state instance if none exists
	const newState = new RecipeStateClass();
	setContext<RecipeState>(RECIPE_STATE_KEY, newState);
	return newState;
}