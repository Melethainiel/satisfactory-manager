<script lang="ts">
	import { getGameState } from '$lib/states/gameState.svelte';
	import { getItemState } from '$lib/states/itemState.svelte';
	import { t } from '$lib/i18n';

	const gameState = getGameState();
	const itemState = getItemState();

	// Dialog state
	let dialog: HTMLDialogElement | null = null;
	let currentSiteId: string | null = null;

	// Form state
	let selectedBuildingId = $state('');
	let buildingCount = $state(1);
	let efficiencyRatio = $state(1.0);
	let extractorPurity = $state('Normal');
	let somersloopCount = $state(0);
	let isBuilt = $state(false);
	let notes = $state('');

	// Auto-calculation state
	let autoCalculateMode = $state(false);
	let desiredItemsPerMin = $state(0);

	// Search state - now using recipeState
	let searchQuery = $state('');
	let showSearchResults = $state(false);
	let searchTimeout: NodeJS.Timeout | null = null;

	// Connect authentication when gameState apiFetch is available
	$effect(() => {
		const apiFetch = gameState.getApiFetch();
		if (apiFetch) {
			itemState.attachAuth(apiFetch);
		}
	});

	// Auto-select building when only one is available
	$effect(() => {
		if (
			itemState.availableBuildings.length === 1 &&
			selectedBuildingId === '' &&
			!itemState.isLoadingBuildings
		) {
			selectedBuildingId = itemState.availableBuildings[0].id;
		}
	});

	// Auto-select recipe when only one is available
	$effect(() => {
		if (
			itemState.selectedProductionType === 'craft' &&
			itemState.productionOptions?.recipes.length === 1 &&
			!itemState.selectedRecipe &&
			!itemState.isLoadingProductionOptions
		) {
			selectRecipe(itemState.productionOptions.recipes[0]);
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

		if (!recipe?.recipeVersionId || !itemState.selectedItem?.id || !gameState.selectedGameId)
			return;

		// Load buildings for this recipe
		await itemState.loadBuildingsForProduction(
			gameState.selectedGameId,
			itemState.selectedItem.id,
			'craft',
			recipe.recipeVersionId
		);
	}

	// Auto-calculation functions
	function getPurityMultiplier(purity: string): number {
		switch (purity) {
			case 'Impure':
				return 0.5;
			case 'Pure':
				return 2.0;
			case 'Normal':
			default:
				return 1.0;
		}
	}

	function calculateBuildingCount(): number {
		if (!desiredItemsPerMin || desiredItemsPerMin <= 0) return 1;

		const selectedBuilding = itemState.availableBuildings.find((b) => b.id === selectedBuildingId);
		if (!selectedBuilding) return 1;

		let ratePerBuilding = 0;

		if (itemState.selectedProductionType === 'extract') {
			const buildingOutput = parseFloat(selectedBuilding.output || '0');
			const purityMultiplier = getPurityMultiplier(extractorPurity);
			ratePerBuilding = buildingOutput * efficiencyRatio * purityMultiplier;
		} else if (itemState.selectedProductionType === 'craft' && itemState.selectedRecipe) {
			const recipeOutput = parseFloat(itemState.selectedRecipe.outputCount || '0');
			ratePerBuilding = recipeOutput * efficiencyRatio;
		} else if (itemState.selectedProductionType === 'power') {
			// For power generation, we use consumptionPerMinute if available
			const consumptionRate = selectedBuilding.consumptionPerMinute || 0;
			ratePerBuilding = consumptionRate * efficiencyRatio;
		}

		if (ratePerBuilding <= 0) return 1;

		return Math.ceil(desiredItemsPerMin / ratePerBuilding);
	}

	function calculateActualProduction(): number {
		const selectedBuilding = itemState.availableBuildings.find((b) => b.id === selectedBuildingId);
		if (!selectedBuilding) return 0;

		let ratePerBuilding = 0;

		if (itemState.selectedProductionType === 'extract') {
			const buildingOutput = parseFloat(selectedBuilding.output || '0');
			const purityMultiplier = getPurityMultiplier(extractorPurity);
			ratePerBuilding = buildingOutput * efficiencyRatio * purityMultiplier;
		} else if (itemState.selectedProductionType === 'craft' && itemState.selectedRecipe) {
			const recipeOutput = parseFloat(itemState.selectedRecipe.outputCount || '0');
			ratePerBuilding = recipeOutput * efficiencyRatio;
		} else if (itemState.selectedProductionType === 'power') {
			const consumptionRate = selectedBuilding.consumptionPerMinute || 0;
			ratePerBuilding = consumptionRate * efficiencyRatio;
		}

		return ratePerBuilding * buildingCount;
	}

	// Effect to auto-calculate building count when in auto mode
	$effect(() => {
		if (autoCalculateMode && desiredItemsPerMin > 0 && selectedBuildingId) {
			buildingCount = calculateBuildingCount();
		}
	});

	function resetForm() {
		searchQuery = '';
		selectedBuildingId = '';
		buildingCount = 1;
		efficiencyRatio = 1.0;
		extractorPurity = 'Normal';
		somersloopCount = 0;
		isBuilt = false;
		notes = '';
		autoCalculateMode = false;
		desiredItemsPerMin = 0;
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
		e?.preventDefault();
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
		let recipeVersionId: string | null = null;

		switch (itemState.selectedProductionType) {
			case 'craft':
				if (!itemState.selectedRecipe?.recipeVersionId) {
					console.log('❌ No recipe selected for crafting');
					return;
				}
				recipeVersionId = itemState.selectedRecipe.recipeVersionId;
				break;

			case 'extract':
				console.log('✅ Setting up extraction for:', itemState.selectedItem.displayName);
				recipeVersionId = null;
				break;

			case 'power':
				console.log('✅ Setting up power generation for:', itemState.selectedItem.displayName);
				recipeVersionId = null;
				break;

			default:
				console.log('❌ Unknown production type:', itemState.selectedProductionType);
				return;
		}

		console.log('✅ Validation passed, creating production instance...');

		try {
			const instanceData: any = {
				buildingVersionId: selectedBuildingId,
				buildingCount: buildingCount,
				efficiencyRatio: efficiencyRatio,
				somersloopCount: somersloopCount,
				isBuilt: isBuilt,
				notes: notes.trim() || undefined
			};

			// Only add recipeVersionId if it's not null (for crafting)
			if (recipeVersionId) {
				instanceData.recipeVersionId = recipeVersionId;
			}

			// For extraction, include the extracted item version ID and purity
			if (itemState.selectedProductionType === 'extract' && itemState.selectedItem?.itemVersionId) {
				instanceData.extractedItemVersionId = itemState.selectedItem.itemVersionId;
				instanceData.extractorPurity = extractorPurity;
			}

			// For power generation, include the fuel item version ID
			if (itemState.selectedProductionType === 'power' && itemState.selectedItem?.itemVersionId) {
				instanceData.fuelItemVersionId = itemState.selectedItem.itemVersionId;
			}

			await gameState.createProductionInstance(currentSiteId, instanceData);

			console.log('✅ Production instance created successfully');
			fullReset();
			dialog?.close();
		} catch (error) {
			console.error('❌ Failed to create recipe instance:', error);
		}
	}

	// Expose methods for external use using Svelte 5 syntax
	export async function open(siteId: string): Promise<void> {
		currentSiteId = siteId;
		resetForm();
		dialog?.showModal();
	}
</script>

<dialog bind:this={dialog} id="add_recipe_instance_modal" class="modal">
	<div class="modal-box">
		<h3 class="mb-4 text-lg font-bold">{$t('production.add_production_instance')}</h3>

		<form onsubmit={handleSubmit} class="flex flex-col gap-4">
			<!-- Item Search -->
			<div class="form-control">
				<label class="label" for="item-search">
					<span class="label-text"
						>{$t('production.item_to_produce')}<span class="text-error">*</span></span
					>
				</label>
				<div class="relative">
					<input
						id="item-search"
						type="text"
						class="input-bordered input w-full text-base"
						placeholder={$t('production.item_search_placeholder')}
						bind:value={searchQuery}
						oninput={handleSearchInput}
						onfocus={() =>
							(showSearchResults =
								searchQuery.trim().length > 0 || itemState.searchResults.length > 0)}
						onkeydown={handleKeydown}
						autocomplete="off"
					/>

					{#if itemState.isSearching}
						<div class="absolute top-1/2 right-3 -translate-y-1/2 transform">
							<span class="loading loading-sm loading-spinner"></span>
						</div>
					{/if}

					<!-- Search Results Dropdown -->
					{#if showSearchResults}
						<div
							class="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-base-300 bg-base-100 shadow-lg"
						>
							{#if itemState.isSearching}
								<div class="p-3 text-center text-base-content/70">
									<div class="flex items-center justify-center gap-2">
										<span class="loading loading-sm loading-spinner"></span>
										Searching items...
									</div>
								</div>
							{:else if searchQuery.trim().length === 0}
								<div class="p-3 text-center text-base-content/70">
									Start typing to search for items
								</div>
							{:else if itemState.searchResults.length === 0}
								<div class="p-3 text-center text-base-content/70">No items found</div>
							{:else}
								{#each itemState.searchResults as item}
									<button
										type="button"
										class="w-full border-b border-base-300 p-3 text-left last:border-b-0 hover:bg-base-200"
										onclick={() => selectItem(item)}
									>
										<div class="font-medium">{item.displayName}</div>
										<div class="flex items-center gap-2 text-sm text-base-content/70">
											<span class="badge badge-outline badge-xs">{item.form}</span>
											{item.moduleVersion.module.name} v{item.moduleVersion.version}
											{#if parseFloat(item.energyValue) > 0}
												<span class="badge badge-xs badge-secondary"
													>⚡ {(parseFloat(item.energyValue) * 1000).toFixed(0)} MJ</span
												>
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
					<div class="rounded-lg bg-base-200 p-3">
						<div class="flex items-center gap-2 font-medium">
							{itemState.selectedItem.displayName}
							<span class="badge badge-outline badge-xs">{itemState.selectedItem.form}</span>
							{#if parseFloat(itemState.selectedItem.energyValue) > 0}
								<span class="badge badge-xs badge-secondary"
									>⚡ {(parseFloat(itemState.selectedItem.energyValue) * 1000).toFixed(0)} MJ</span
								>
							{/if}
						</div>
						<div class="text-sm text-base-content/70">
							{itemState.selectedItem.moduleVersion.module.name} v{itemState.selectedItem
								.moduleVersion.version}
						</div>
					</div>
				</div>
			{/if}

			<!-- Production Options -->
			{#if itemState.selectedItem && itemState.productionOptions}
				<div class="form-control">
					{#if itemState.isLoadingProductionOptions}
						<div class="flex items-center justify-center p-4">
							<span class="loading loading-sm loading-spinner"></span>
							<span class="ml-2">{$t('production.loading_production_options')}</span>
						</div>
					{:else}
						<fieldset>
							<legend class="label-text mb-2 font-medium"
								>{$t('production.how_to_produce')}<span class="text-error">*</span></legend
							>
							<div class="flex flex-col gap-2">
								{#if itemState.productionOptions.canCraft}
									<label class="cursor-pointer">
										<input
											type="radio"
											class="radio radio-primary"
											bind:group={itemState.selectedProductionType}
											value="craft"
											onchange={() => selectProductionType('craft')}
										/>
										<span class="ml-2"
											>🏭 {$t('production.craft_via_recipe')} ({itemState.productionOptions.recipes
												.length}
											{$t('production.recipes_available')})</span
										>
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
										/>
										<span class="ml-2"
											>⛏️ {$t('production.extract_from_deposits')} ({itemState.productionOptions
												.extractors.length}
											{$t('production.extractors_available')})</span
										>
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
										/>
										<span class="ml-2"
											>⚡ {$t('production.generate_power')} ({itemState.productionOptions.generators
												.length}
											{$t('production.generators_available')})</span
										>
									</label>
								{/if}

								{#if !itemState.productionOptions.canCraft && !itemState.productionOptions.canExtract && !itemState.productionOptions.canGeneratePower}
									<div class="p-4 text-center text-base-content/70">
										{$t('production.no_production_methods')}
									</div>
								{/if}
							</div>
						</fieldset>
					{/if}
				</div>
			{/if}

			<!-- Recipe Selection (only shown for craft production type) -->
			{#if itemState.selectedProductionType === 'craft' && itemState.productionOptions?.recipes}
				<div class="form-control">
					<label class="label" for="recipe-select">
						<span class="label-text"
							>{$t('production.select_recipe')}<span class="text-error">*</span></span
						>
					</label>
					<select
						id="recipe-select"
						class="select-bordered select w-full"
						onchange={(e) => {
							const recipeId = (e.target as HTMLSelectElement)?.value;
							const recipe =
								itemState.productionOptions?.recipes.find((r) => r.id === recipeId) || null;
							selectRecipe(recipe);
						}}
						required
					>
						<option value="">Select a recipe...</option>
						{#each itemState.productionOptions.recipes as recipe}
							<option value={recipe.id}
								>{recipe.displayName} ({recipe.manufacturingDuration}s)</option
							>
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
								{$t('production.building_for_recipe')}<span class="text-error">*</span>
							{:else if itemState.selectedProductionType === 'extract'}
								{$t('production.extractor')}<span class="text-error">*</span>
							{:else if itemState.selectedProductionType === 'power'}
								{$t('production.generator')}<span class="text-error">*</span>
							{/if}
						</span>
					</label>
					<select
						id="building-select"
						class="select-bordered select w-full text-base"
						bind:value={selectedBuildingId}
						disabled={itemState.availableBuildings.length === 0}
						required
					>
						<option value="">Select a building...</option>
						{#each itemState.availableBuildings as building}
							<option value={building.id}>
								{building.name} ({building.type})
								{#if building.energyProductionMW && building.consumptionPerMinute}
									- {building.energyProductionMW.toFixed(0)} MW - {building.consumptionPerMinute.toFixed(
										2
									)} items/min
								{/if}
							</option>
						{/each}
					</select>
					{#if itemState.selectedProductionType && itemState.availableBuildings.length === 0 && !itemState.isLoadingBuildings}
						<div class="label">
							<span class="label-text-alt text-warning"
								>{$t('production.no_compatible_buildings')}</span
							>
						</div>
					{/if}
					{#if itemState.isLoadingBuildings}
						<div class="label">
							<span class="label-text-alt">{$t('production.loading_buildings')}</span>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Purity Selection (only shown for extraction) -->
			{#if itemState.selectedProductionType === 'extract'}
				<div class="form-control">
					<label class="label" for="purity-select">
						<span class="label-text">{$t('production.purity')}</span>
					</label>
					<select
						id="purity-select"
						class="select-bordered select w-full"
						bind:value={extractorPurity}
					>
						<option value="Impure">{$t('production.purity_impure')} (×0.5)</option>
						<option value="Normal">{$t('production.purity_normal')} (×1.0)</option>
						<option value="Pure">{$t('production.purity_pure')} (×2.0)</option>
					</select>
					<div class="label">
						<span class="label-text-alt">{$t('production.purity_affects_extraction')}</span>
					</div>
				</div>
			{/if}

			<!-- Configuration Somersloop (seulement si le bâtiment supporte les shards) -->
			{#if selectedBuildingId}
				{@const selectedBuilding = itemState.availableBuildings.find(b => b.id === selectedBuildingId)}
				{#if selectedBuilding && selectedBuilding.productionShardSlotSize && selectedBuilding.productionShardSlotSize > 0}
					<div class="form-control">
						<label class="label" for="somersloop-count">
							<span class="label-text">Nombre de Somersloop</span>
						</label>
						<input
							id="somersloop-count"
							type="number"
							class="input-bordered input w-full"
							bind:value={somersloopCount}
							min="0"
							max={selectedBuilding.productionShardSlotSize}
							step="1"
						/>
						<div class="label">
							<span class="label-text-alt">Max: {selectedBuilding.productionShardSlotSize} shard slots</span>
						</div>
					</div>
				{/if}
			{/if}

			<!-- Auto-calculation toggle -->
			{#if selectedBuildingId && (itemState.selectedProductionType === 'extract' || itemState.selectedProductionType === 'craft')}
				<div class="form-control">
					<label class="label cursor-pointer">
						<span class="label-text">Calcul automatique du nombre de bâtiments</span>
						<input
							type="checkbox"
							bind:checked={autoCalculateMode}
							class="checkbox checkbox-primary"
						/>
					</label>
				</div>
			{/if}

			<!-- Desired production rate (only shown in auto mode) -->
			{#if autoCalculateMode}
				<div class="form-control">
					<label class="label" for="desired-rate">
						<span class="label-text"
							>Production souhaitée (items/min)<span class="text-error">*</span></span
						>
					</label>
					<input
						id="desired-rate"
						type="number"
						class="input-bordered input w-full text-base"
						bind:value={desiredItemsPerMin}
						min="0.1"
						step="0.1"
						placeholder="60"
						required
					/>
					{#if selectedBuildingId && desiredItemsPerMin > 0}
						<div class="label">
							<span class="label-text-alt text-info">
								→ {buildingCount} bâtiments = {calculateActualProduction().toFixed(1)} items/min
							</span>
						</div>
					{/if}
				</div>
			{/if}

			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<!-- Building Count -->
				<div class="form-control">
					<label class="label" for="building-count">
						<span class="label-text"
							>{$t('recipeInstances.building_count')}<span class="text-error">*</span></span
						>
					</label>
					<input
						id="building-count"
						type="number"
						class="input-bordered input w-full text-base"
						class:input-disabled={autoCalculateMode}
						bind:value={buildingCount}
						min="1"
						max="1000"
						step="1"
						readonly={autoCalculateMode}
						required
					/>
					{#if autoCalculateMode}
						<div class="label">
							<span class="label-text-alt text-warning">Calculé automatiquement</span>
						</div>
					{/if}
				</div>

				<!-- Efficiency Ratio -->
				<div class="form-control">
					<label class="label" for="efficiency-ratio">
						<span class="label-text">{$t('recipeInstances.efficiency_ratio')}</span>
					</label>
					<input
						id="efficiency-ratio"
						type="number"
						class="input-bordered input w-full text-base"
						bind:value={efficiencyRatio}
						min="0.1"
						max="2.5"
						step="0.001"
						placeholder="1.00"
					/>
					<div class="label">
						<span class="label-text-alt">0.1 - 2.5 (1.0 = 100%)</span>
					</div>
				</div>
			</div>

			<!-- Built Status -->
			<div class="form-control">
				<label class="label cursor-pointer">
					<span class="label-text">Marquer comme construite</span>
					<input type="checkbox" bind:checked={isBuilt} class="checkbox checkbox-success" />
				</label>
			</div>

			<!-- Notes -->
			<div class="form-control">
				<label class="label" for="notes">
					<span class="label-text">{$t('recipeInstances.notes')}</span>
				</label>
				<textarea
					id="notes"
					class="textarea-bordered textarea"
					placeholder={$t('recipeInstances.notes_placeholder')}
					bind:value={notes}
					rows="3"
					maxlength="1000"
				></textarea>
				<div class="label">
					<span class="label-text-alt">{notes.length}/1000 characters</span>
				</div>
			</div>

			<div class="modal-action flex-col gap-2 sm:flex-row">
				<button
					type="button"
					class="btn order-2 sm:order-1"
					onclick={() => {
						fullReset();
						dialog?.close();
					}}
				>
					{$t('common.cancel')}
				</button>
				<button
					type="submit"
					class="btn order-1 btn-primary sm:order-2"
					disabled={gameState.isLoading ||
						!itemState.selectedItem ||
						!itemState.selectedProductionType ||
						!selectedBuildingId ||
						buildingCount <= 0 ||
						(itemState.selectedProductionType === 'craft' && !itemState.selectedRecipe)}
				>
					{#if gameState.isLoading}
						<span class="loading loading-xs loading-spinner"></span>
					{/if}
					{$t('production.add_production_instance')}
				</button>
			</div>
		</form>
	</div>

	<form method="dialog" class="modal-backdrop">
		<button aria-label={$t('common.close')} onclick={() => fullReset()}>{$t('common.close')}</button
		>
	</form>
</dialog>

<style>
	dialog:not([open]) {
		display: none;
	}
</style>
