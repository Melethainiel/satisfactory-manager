import { getContext, setContext } from 'svelte';

// TypeScript interfaces for item-based production data
export interface ItemWithVersion {
	id: string;
	displayName: string;
	className: string;
	form: 'RF_SOLID' | 'RF_LIQUID' | 'RF_GAS';
	// Version is automatically determined by game configuration
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

export interface ItemState {
	// Data states
	searchResults: ItemWithVersion[];
	selectedItem: ItemWithVersion | null;
	productionOptions: ProductionOptions | null;
	selectedProductionType: 'extract' | 'craft' | 'power' | null;
	selectedRecipe: Recipe | null; // only used when production type is 'craft'
	availableBuildings: Building[]; // extractors, recipe buildings, or generators depending on type

	// UI states
	isSearching: boolean;
	isLoadingProductionOptions: boolean;
	isLoadingBuildings: boolean;

	// Methods
	searchItems: (gameId: string, query: string) => Promise<ItemWithVersion[]>;
	loadProductionOptions: (gameId: string, itemId: string) => Promise<ProductionOptions>;
	loadBuildingsForProduction: (
		gameId: string,
		itemId: string,
		productionType: 'extract' | 'craft' | 'power',
		recipeVersionId?: string
	) => Promise<Building[]>;
	clearResults: () => void;

	// Authentication
	attachAuth: (apiFetch: AuthFetchFn) => void;
}

// Auth fetch function type (same as in gameState)
type AuthFetchFn = <T = any>(
	input: string | URL | Request,
	init?: RequestInit & { autoJson?: boolean }
) => Promise<T | Response>;

class ItemStateClass implements ItemState {
	// Reactive states using Svelte 5 runes
	searchResults = $state<ItemWithVersion[]>([]);
	selectedItem = $state<ItemWithVersion | null>(null);
	productionOptions = $state<ProductionOptions | null>(null);
	selectedProductionType = $state<'extract' | 'craft' | 'power' | null>(null);
	selectedRecipe = $state<Recipe | null>(null);
	availableBuildings = $state<Building[]>([]);

	// UI states
	isSearching = $state(false);
	isLoadingProductionOptions = $state(false);
	isLoadingBuildings = $state(false);

	// Private auth function
	private apiFetch: AuthFetchFn | null = null;

	attachAuth(apiFetch: AuthFetchFn) {
		this.apiFetch = apiFetch;
	}

	async searchItems(gameId: string, query: string): Promise<ItemWithVersion[]> {
		if (!this.apiFetch) {
			throw new Error('Authentication not attached to itemState');
		}

		if (!query.trim()) {
			this.searchResults = [];
			return [];
		}

		this.isSearching = true;
		try {
			const res = await this.apiFetch(
				`/api/items?gameId=${encodeURIComponent(gameId)}&search=${encodeURIComponent(query.trim())}`
			);
			if (!res.ok) throw new Error(`Failed to search items (${res.status})`);
			const results = (await res.json()) as ItemWithVersion[];
			this.searchResults = results;
			return results;
		} catch (error) {
			console.error('Failed to search items:', error);
			this.searchResults = [];
			throw error;
		} finally {
			this.isSearching = false;
		}
	}

	async loadProductionOptions(gameId: string, itemId: string): Promise<ProductionOptions> {
		if (!this.apiFetch) {
			throw new Error('Authentication not attached to itemState');
		}

		if (!itemId) {
			this.productionOptions = null;
			return {
				canExtract: false,
				canCraft: false,
				canGeneratePower: false,
				extractors: [],
				recipes: [],
				generators: []
			};
		}

		this.isLoadingProductionOptions = true;
		try {
			const res = await this.apiFetch(
				`/api/items/${itemId}/production-options?gameId=${encodeURIComponent(gameId)}`
			);
			if (!res.ok) throw new Error(`Failed to load production options (${res.status})`);
			const response = await res.json();

			if (response.success) {
				this.productionOptions = response.data;
				return response.data;
			} else {
				throw new Error(response.error || 'Failed to load production options');
			}
		} catch (error) {
			console.error('Failed to load production options:', error);
			this.productionOptions = null;
			throw error;
		} finally {
			this.isLoadingProductionOptions = false;
		}
	}

	async loadBuildingsForProduction(
		gameId: string,
		itemId: string,
		productionType: 'extract' | 'craft' | 'power',
		recipeVersionId?: string
	): Promise<Building[]> {
		if (!this.apiFetch) {
			throw new Error('Authentication not attached to itemState');
		}

		this.isLoadingBuildings = true;
		try {
			let buildings: Building[] = [];

			switch (productionType) {
				case 'extract':
					const extractorRes = await this.apiFetch(
						`/api/items/${itemId}/extractors?gameId=${encodeURIComponent(gameId)}`
					);
					if (!extractorRes.ok)
						throw new Error(`Failed to load extractors (${extractorRes.status})`);
					const extractorData = await extractorRes.json();
					buildings = extractorData.success ? extractorData.data : [];
					break;

				case 'power':
					const generatorRes = await this.apiFetch(
						`/api/items/${itemId}/generators?gameId=${encodeURIComponent(gameId)}`
					);
					if (!generatorRes.ok)
						throw new Error(`Failed to load generators (${generatorRes.status})`);
					const generatorData = await generatorRes.json();
					buildings = generatorData.success ? generatorData.data : [];
					break;

				case 'craft':
					if (!recipeVersionId) {
						throw new Error('Recipe version ID is required for craft production type');
					}
					// Use the existing endpoint for recipe buildings
					const recipeRes = await this.apiFetch(
						`/api/recipes/versions/${recipeVersionId}/buildings`
					);
					if (!recipeRes.ok)
						throw new Error(`Failed to load recipe buildings (${recipeRes.status})`);
					buildings = await recipeRes.json();
					break;

				default:
					throw new Error(`Unknown production type: ${productionType}`);
			}

			this.availableBuildings = buildings;
			return buildings;
		} catch (error) {
			console.error('Failed to load buildings for production:', error);
			this.availableBuildings = [];
			throw error;
		} finally {
			this.isLoadingBuildings = false;
		}
	}

	clearResults() {
		this.searchResults = [];
		this.selectedItem = null;
		this.productionOptions = null;
		this.selectedProductionType = null;
		this.selectedRecipe = null;
		this.availableBuildings = [];
	}
}

// Context management
const ITEM_STATE_KEY = Symbol('itemState');

export function setItemState(itemState: ItemState) {
	return setContext<ItemState>(ITEM_STATE_KEY, itemState);
}

export function getItemState(): ItemState {
	const existingState = getContext<ItemState | undefined>(ITEM_STATE_KEY);
	if (existingState) {
		return existingState;
	}

	// Create new state instance if none exists
	const newState = new ItemStateClass();
	setContext<ItemState>(ITEM_STATE_KEY, newState);
	return newState;
}
