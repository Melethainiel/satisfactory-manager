<script lang="ts">
	import { getGameState } from '$lib/states/gameState.svelte';
	import { getItemState } from '$lib/states/itemState.svelte';
	import { t } from '$lib/i18n';
	import type { AddRecipeInstanceDialogHandle } from './AddRecipeInstanceDialogHandle';

	const gameState = getGameState();
	const itemState = getItemState();

	// Dialog state
	let dialog: HTMLDialogElement | null = null;
	let currentSiteId: string | null = null;

	// Form state
	let selectedBuildingId = $state('');
	let buildingCount = $state(1);
	let efficiencyRatio = $state(1.0);
	let notes = $state('');

	// Search state - now using recipeState
	let searchQuery = $state('');
	let showSearchResults = $state(false);
	let searchTimeout: NodeJS.Timeout | null = null;
	
	// Connect authentication when gameState apiFetch is available
	$effect(() => {
		const apiFetch = gameState.getApiFetch();
		console.log('🔍 $effect running, apiFetch:', !!apiFetch);
		if (apiFetch) {
			console.log('🔍 Attaching auth to itemState');
			itemState.attachAuth(apiFetch);
			console.log('🔍 Auth attached to itemState');
		} else {
			console.log('🔍 No apiFetch available from gameState');
		}
	});

	// Search functionality using itemState
	async function searchItems(query: string) {
		if (!query.trim() || !gameState.selectedGameId) {
			showSearchResults = false;
			return;
		}

		// Show dropdown while searching
		showSearchResults = true;
		
		try {
			await itemState.searchItems(gameState.selectedGameId, query);
			// Keep dropdown visible if we have a query, regardless of results
			showSearchResults = true;
		} catch (error) {
			console.error('Error searching items:', error);
			// Still show dropdown to display error state
			showSearchResults = true;
		}
	}

	function handleSearchInput() {
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}
		
		// Show dropdown immediately when user starts typing
		if (searchQuery.trim().length > 0) {
			showSearchResults = true;
		} else {
			showSearchResults = false;
		}
		
		searchTimeout = setTimeout(() => {
			searchItems(searchQuery);
		}, 300);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			showSearchResults = false;
		}
	}


	async function selectItem(item: typeof itemState.selectedItem) {
		itemState.selectedItem = item;
		searchQuery = item?.displayName || '';
		showSearchResults = false;
		
		// Reset previous selections
		selectedBuildingId = '';
		itemState.selectedProductionType = null;
		itemState.selectedRecipe = null;
		itemState.availableBuildings = [];
		
		// Load production options for this item
		if (item?.id && gameState.selectedGameId) {
			await itemState.loadProductionOptions(gameState.selectedGameId, item.id);
		}
	}

	async function selectProductionType(type: 'extract' | 'craft' | 'power') {
		itemState.selectedProductionType = type;
		selectedBuildingId = '';
		itemState.selectedRecipe = null;
		itemState.availableBuildings = [];
		
		if (!itemState.selectedItem?.id || !gameState.selectedGameId) return;
		
		// Load buildings based on production type
		if (type === 'extract' || type === 'power') {
			// For extraction or power generation, load buildings directly
			await itemState.loadBuildingsForProduction(
				gameState.selectedGameId,
				itemState.selectedItem.id,
				type
			);
		}
		// For crafting, we need to wait for recipe selection first
	}

	async function selectRecipe(recipe: typeof itemState.selectedRecipe) {
		itemState.selectedRecipe = recipe;
		selectedBuildingId = '';
		
		if (!recipe?.recipeVersionId || !itemState.selectedItem?.id || !gameState.selectedGameId) return;
		
		// Load buildings for this recipe
		await itemState.loadBuildingsForProduction(
			gameState.selectedGameId,
			itemState.selectedItem.id,
			'craft',
			recipe.recipeVersionId
		);
	}

	function resetForm() {
		searchQuery = '';
		selectedBuildingId = '';
		buildingCount = 1;
		efficiencyRatio = 1.0;
		notes = '';
		// Note: currentSiteId is NOT cleared here - it should persist during dialog session
		showSearchResults = false;
		
		// Clear itemState data
		itemState.clearResults();
		
		// Clear any pending search
		if (searchTimeout) {
			clearTimeout(searchTimeout);
			searchTimeout = null;
		}
	}

	function fullReset() {
		// Reset all form fields including currentSiteId
		resetForm();
		currentSiteId = null;
	}

	async function handleSubmit(e?: Event) {
		console.log('🔍 handleSubmit called with event:', e);
		e?.preventDefault();
		console.log('🔍 preventDefault() called');
		
		// Debug logging
		console.log('🔍 Form validation data:', {
			currentSiteId,
			selectedItem: itemState.selectedItem,
			productionType: itemState.selectedProductionType,
			selectedRecipe: itemState.selectedRecipe,
			selectedBuildingId,
			buildingCount,
			gameStateLoading: gameState.isLoading
		});
		
		if (!currentSiteId) {
			console.log('❌ No current site ID');
			return;
		}
		
		if (!itemState.selectedItem) {
			console.log('❌ No item selected');
			return;
		}

		if (!itemState.selectedProductionType) {
			console.log('❌ No production type selected');
			return;
		}
		
		if (!selectedBuildingId) {
			console.log('❌ No building selected');
			return;
		}
		
		if (buildingCount <= 0) {
			console.log('❌ Invalid building count:', buildingCount);
			return;
		}

		// Determine recipeVersionId based on production type
		let recipeVersionId: string;
		
		switch (itemState.selectedProductionType) {
			case 'craft':
				if (!itemState.selectedRecipe?.recipeVersionId) {
					console.log('❌ No recipe selected for crafting');
					return;
				}
				recipeVersionId = itemState.selectedRecipe.recipeVersionId;
				break;
				
			case 'extract':
			case 'power':
				// For now, these are not fully implemented
				// TODO: Create proper extraction/power generation logic
				console.log('🚧 Production type not fully implemented yet:', itemState.selectedProductionType);
				return;
				
			default:
				console.log('❌ Unknown production type:', itemState.selectedProductionType);
				return;
		}

		console.log('✅ Validation passed, creating production instance...');

		try {
			await gameState.createRecipeInstance(currentSiteId, {
				recipeVersionId: recipeVersionId,
				buildingId: selectedBuildingId,
				buildingCount: buildingCount,
				efficiencyRatio: efficiencyRatio,
				notes: notes.trim() || undefined
			});
			
			console.log('✅ Production instance created successfully');
			fullReset();
			dialog?.close();
		} catch (error) {
			console.error('❌ Failed to create recipe instance:', error);
		}
	}

	// Expose methods for external use using Svelte 5 syntax
	export async function open(siteId: string): Promise<void> {
		console.log('🔍 AddRecipeInstanceDialog.open() called with siteId:', siteId);
		currentSiteId = siteId;
		resetForm();
		dialog?.showModal();
		console.log('🔍 Dialog should now be open, dialog element:', dialog);
	}
</script>

<dialog bind:this={dialog} id="add_recipe_instance_modal" class="modal">
	<div class="modal-box w-11/12 max-w-2xl">
		<h3 class="mb-4 text-lg font-bold">Add Production Instance</h3>
		
		<form onsubmit={handleSubmit} class="flex flex-col gap-4">
			<!-- Item Search -->
			<div class="form-control">
				<label class="label" for="item-search">
					<span class="label-text">Item to Produce<span class="text-error">*</span></span>
				</label>
				<div class="relative">
					<input
						id="item-search"
						type="text"
						class="input input-bordered w-full"
						placeholder="Search for items to produce (e.g., Iron Ore, Iron Ingot)"
						bind:value={searchQuery}
						oninput={handleSearchInput}
						onfocus={() => showSearchResults = searchQuery.trim().length > 0 || itemState.searchResults.length > 0}
						onkeydown={handleKeydown}
						autocomplete="off"
					/>
					
					{#if itemState.isSearching}
						<div class="absolute right-3 top-1/2 transform -translate-y-1/2">
							<span class="loading loading-spinner loading-sm"></span>
						</div>
					{/if}
					
					<!-- Search Results Dropdown -->
					{#if showSearchResults}
						<div class="absolute z-10 w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
							{#if itemState.isSearching}
								<div class="p-3 text-center text-base-content/70">
									<div class="flex items-center justify-center gap-2">
										<span class="loading loading-spinner loading-sm"></span>
										Searching items...
									</div>
								</div>
							{:else if searchQuery.trim().length === 0}
								<div class="p-3 text-center text-base-content/70">
									Start typing to search for items
								</div>
							{:else if itemState.searchResults.length === 0}
								<div class="p-3 text-center text-base-content/70">
									No items found
								</div>
							{:else}
								{#each itemState.searchResults as item}
									<button
										type="button"
										class="w-full p-3 text-left hover:bg-base-200 border-b border-base-300 last:border-b-0"
										onclick={() => selectItem(item)}
									>
										<div class="font-medium">{item.displayName}</div>
										<div class="text-sm text-base-content/70 flex items-center gap-2">
											<span class="badge badge-xs badge-outline">{item.form}</span>
											{item.moduleVersion.module.name} v{item.moduleVersion.version}
											{#if parseFloat(item.energyValue) > 0}
												<span class="badge badge-xs badge-secondary">⚡ {item.energyValue} MJ</span>
											{/if}
										</div>
									</button>
								{/each}
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<!-- Selected Item Display -->
			{#if itemState.selectedItem}
				<div class="form-control">
					<div class="bg-base-200 rounded-lg p-3">
						<div class="font-medium flex items-center gap-2">
							{itemState.selectedItem.displayName}
							<span class="badge badge-xs badge-outline">{itemState.selectedItem.form}</span>
							{#if parseFloat(itemState.selectedItem.energyValue) > 0}
								<span class="badge badge-xs badge-secondary">⚡ {itemState.selectedItem.energyValue} MJ</span>
							{/if}
						</div>
						<div class="text-sm text-base-content/70">
							{itemState.selectedItem.moduleVersion.module.name} v{itemState.selectedItem.moduleVersion.version}
						</div>
					</div>
				</div>
			{/if}

			<!-- Production Options -->
			{#if itemState.selectedItem && itemState.productionOptions}
				<div class="form-control">
					<label class="label">
						<span class="label-text">How do you want to produce this item?<span class="text-error">*</span></span>
					</label>
					
					{#if itemState.isLoadingProductionOptions}
						<div class="flex items-center justify-center p-4">
							<span class="loading loading-spinner loading-sm"></span>
							<span class="ml-2">Loading production options...</span>
						</div>
					{:else}
						<div class="flex flex-col gap-2">
							{#if itemState.productionOptions.canCraft}
								<label class="cursor-pointer">
									<input 
										type="radio" 
										class="radio radio-primary" 
										bind:group={itemState.selectedProductionType}
										value="craft"
										onchange={() => selectProductionType('craft')}
									>
									<span class="ml-2">🏭 Craft via Recipe ({itemState.productionOptions.recipes.length} recipes available)</span>
								</label>
							{/if}
							
							{#if itemState.productionOptions.canExtract}
								<label class="cursor-pointer">
									<input 
										type="radio" 
										class="radio radio-primary" 
										bind:group={itemState.selectedProductionType}
										value="extract"
										onchange={() => selectProductionType('extract')}
										disabled
									>
									<span class="ml-2 text-base-content/50">⛏️ Extract from deposits ({itemState.productionOptions.extractors.length} extractors available) - Coming soon</span>
								</label>
							{/if}
							
							{#if itemState.productionOptions.canGeneratePower}
								<label class="cursor-pointer">
									<input 
										type="radio" 
										class="radio radio-primary" 
										bind:group={itemState.selectedProductionType}
										value="power"
										onchange={() => selectProductionType('power')}
										disabled
									>
									<span class="ml-2 text-base-content/50">⚡ Generate Power ({itemState.productionOptions.generators.length} generators available) - Coming soon</span>
								</label>
							{/if}
							
							{#if !itemState.productionOptions.canCraft && !itemState.productionOptions.canExtract && !itemState.productionOptions.canGeneratePower}
								<div class="text-center text-base-content/70 p-4">
									No production methods available for this item in the current game configuration.
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Recipe Selection (only shown for craft production type) -->
			{#if itemState.selectedProductionType === 'craft' && itemState.productionOptions?.recipes}
				<div class="form-control">
					<label class="label" for="recipe-select">
						<span class="label-text">Select Recipe<span class="text-error">*</span></span>
					</label>
					<select 
						id="recipe-select"
						class="select select-bordered w-full"
						onchange={(e) => {
							const recipeId = (e.target as HTMLSelectElement)?.value;
							const recipe = itemState.productionOptions?.recipes.find(r => r.id === recipeId) || null;
							selectRecipe(recipe);
						}}
						required
					>
						<option value="">Select a recipe...</option>
						{#each itemState.productionOptions.recipes as recipe}
							<option value={recipe.id}>{recipe.displayName} ({recipe.manufacturingDuration}s)</option>
						{/each}
					</select>
				</div>
			{/if}

			<!-- Building Selection -->
			{#if itemState.selectedProductionType}
				<div class="form-control">
					<label class="label" for="building-select">
						<span class="label-text">
							{#if itemState.selectedProductionType === 'craft'}
								Building for Recipe<span class="text-error">*</span>
							{:else if itemState.selectedProductionType === 'extract'}
								Extractor<span class="text-error">*</span>
							{:else if itemState.selectedProductionType === 'power'}
								Generator<span class="text-error">*</span>
							{/if}
						</span>
					</label>
					<select 
						id="building-select"
						class="select select-bordered w-full"
						bind:value={selectedBuildingId}
						disabled={itemState.availableBuildings.length === 0}
						required
					>
						<option value="">Select a building...</option>
						{#each itemState.availableBuildings as building}
							<option value={building.id}>
								{building.name} ({building.type})
							</option>
						{/each}
					</select>
					{#if itemState.selectedProductionType && itemState.availableBuildings.length === 0 && !itemState.isLoadingBuildings}
						<div class="label">
							<span class="label-text-alt text-warning">No compatible buildings available</span>
						</div>
					{/if}
					{#if itemState.isLoadingBuildings}
						<div class="label">
							<span class="label-text-alt">Loading buildings...</span>
						</div>
					{/if}
				</div>
			{/if}

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<!-- Building Count -->
				<div class="form-control">
					<label class="label" for="building-count">
						<span class="label-text">{$t('recipeInstances.building_count')}<span class="text-error">*</span></span>
					</label>
					<input
						id="building-count"
						type="number"
						class="input input-bordered w-full"
						bind:value={buildingCount}
						min="0.1"
						max="1000"
						step="0.1"
						required
					/>
				</div>

				<!-- Efficiency Ratio -->
				<div class="form-control">
					<label class="label" for="efficiency-ratio">
						<span class="label-text">{$t('recipeInstances.efficiency_ratio')}</span>
					</label>
					<input
						id="efficiency-ratio"
						type="number"
						class="input input-bordered w-full"
						bind:value={efficiencyRatio}
						min="0.1"
						max="2.5"
						step="0.01"
						placeholder="1.00"
					/>
					<div class="label">
						<span class="label-text-alt">0.1 - 2.5 (1.0 = 100%)</span>
					</div>
				</div>
			</div>

			<!-- Notes -->
			<div class="form-control">
				<label class="label" for="notes">
					<span class="label-text">{$t('recipeInstances.notes')}</span>
				</label>
				<textarea
					id="notes"
					class="textarea textarea-bordered"
					placeholder={$t('recipeInstances.notes_placeholder')}
					bind:value={notes}
					rows="3"
					maxlength="1000"
				></textarea>
				<div class="label">
					<span class="label-text-alt">{notes.length}/1000 characters</span>
				</div>
			</div>

			<div class="modal-action">
				<button 
					type="button" 
					class="btn" 
					onclick={() => {
						fullReset();
						dialog?.close();
					}}
				>
					{$t('common.cancel')}
				</button>
				<button 
					type="submit" 
					class="btn btn-primary"
					disabled={gameState.isLoading || !itemState.selectedItem || !itemState.selectedProductionType || !selectedBuildingId || buildingCount <= 0 || (itemState.selectedProductionType === 'craft' && !itemState.selectedRecipe)}
				>
					{#if gameState.isLoading}
						<span class="loading loading-spinner loading-xs"></span>
					{/if}
					Add Production Instance
				</button>
			</div>
		</form>
	</div>
	
	<form method="dialog" class="modal-backdrop">
		<button aria-label={$t('common.close')} onclick={() => fullReset()}>{$t('common.close')}</button>
	</form>
</dialog>

<style>
	dialog:not([open]) {
		display: none;
	}
</style>