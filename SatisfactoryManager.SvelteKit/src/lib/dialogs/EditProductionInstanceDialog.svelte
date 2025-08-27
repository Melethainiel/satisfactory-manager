<script lang="ts">
	import { getGameState, type ProductionInstanceData } from '$lib/states/gameState.svelte';
	import { t } from '$lib/i18n';
	import type { EditProductionInstanceDialogHandle } from './EditProductionInstanceDialogHandle';

	const gameState = getGameState();

	// Dialog state
	let dialog: HTMLDialogElement | null = null;
	let currentInstance: ProductionInstanceData | null = $state(null);

	// Form state - only editable fields
	let buildingCount = $state(1);
	let efficiencyRatio = $state(1.0);
	let extractorPurity = $state('Normal');
	let isBuilt = $state(false);
	let notes = $state('');

	// Auto-calculation state
	let autoCalculateMode = $state(false);
	let desiredItemsPerMin = $state(0);

	// Reset form with instance data
	function resetForm(instance: ProductionInstanceData) {
		buildingCount = parseFloat(instance.buildingCount);
		efficiencyRatio = parseFloat(instance.efficiencyRatio);
		extractorPurity = instance.extractorPurity || 'Normal';
		isBuilt = instance.isBuilt;
		notes = instance.notes || '';
	}

	async function handleSubmit(e?: Event) {
		e?.preventDefault();
		if (!currentInstance) return;

		if (buildingCount <= 0) {
			console.log('❌ Invalid building count:', buildingCount);
			return;
		}

		if (efficiencyRatio <= 0 || efficiencyRatio > 2.5) {
			console.log('❌ Invalid efficiency ratio:', efficiencyRatio);
			return;
		}

		try {
			const updateData: any = {
				buildingCount: buildingCount,
				efficiencyRatio: efficiencyRatio,
				isBuilt: isBuilt,
				notes: notes.trim() || undefined
			};

			// Add purity for extractors
			if (currentInstance.extractedItemVersionId) {
				updateData.extractorPurity = extractorPurity;
			}

			await gameState.updateProductionInstance(currentInstance.id, updateData);

			console.log('✅ Production instance updated successfully');
			currentInstance = null;
			dialog?.close();
		} catch (error) {
			console.error('❌ Failed to update production instance:', error);
		}
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
		if (!desiredItemsPerMin || desiredItemsPerMin <= 0 || !currentInstance) return 1;

		let ratePerBuilding = 0;

		if (currentInstance.extractedItemVersionId && currentInstance.buildingVersion) {
			// Extraction
			const buildingOutput = parseFloat(currentInstance.buildingVersion.output || '0');
			const purityMultiplier = getPurityMultiplier(extractorPurity);
			ratePerBuilding = buildingOutput * efficiencyRatio * purityMultiplier;
		} else if (currentInstance.recipe && currentInstance.products && currentInstance.products.length > 0) {
			// Crafting - use the production calculation from existing instance
			// We can derive the rate from the current setup
			const currentRate = parseFloat(currentInstance.buildingCount) * efficiencyRatio;
			// Get base rate per building at 100% efficiency
			const baseRate = currentRate / (parseFloat(currentInstance.buildingCount) * parseFloat(currentInstance.efficiencyRatio));
			ratePerBuilding = baseRate * efficiencyRatio;
		}

		if (ratePerBuilding <= 0) return 1;

		return Math.ceil(desiredItemsPerMin / ratePerBuilding);
	}

	function calculateActualProduction(): number {
		if (!currentInstance) return 0;

		let ratePerBuilding = 0;

		if (currentInstance.extractedItemVersionId && currentInstance.buildingVersion) {
			// Extraction
			const buildingOutput = parseFloat(currentInstance.buildingVersion.output || '0');
			const purityMultiplier = getPurityMultiplier(extractorPurity);
			ratePerBuilding = buildingOutput * efficiencyRatio * purityMultiplier;
		} else if (currentInstance.recipe && currentInstance.products && currentInstance.products.length > 0) {
			// Crafting - derive rate from current production data
			const currentRate = parseFloat(currentInstance.buildingCount) * efficiencyRatio;
			const baseRate = currentRate / (parseFloat(currentInstance.buildingCount) * parseFloat(currentInstance.efficiencyRatio));
			ratePerBuilding = baseRate * efficiencyRatio;
		}

		return ratePerBuilding * buildingCount;
	}

	function calculateCurrentProduction(): number {
		if (!currentInstance) return 0;

		let ratePerBuilding = 0;

		if (currentInstance.extractedItemVersionId && currentInstance.buildingVersion) {
			const buildingOutput = parseFloat(currentInstance.buildingVersion.output || '0');
			const purityMultiplier = getPurityMultiplier(currentInstance.extractorPurity || 'Normal');
			ratePerBuilding = buildingOutput * parseFloat(currentInstance.efficiencyRatio) * purityMultiplier;
		} else if (currentInstance.recipe && currentInstance.products && currentInstance.products.length > 0) {
			const currentRate = parseFloat(currentInstance.buildingCount) * parseFloat(currentInstance.efficiencyRatio);
			const baseRate = currentRate / (parseFloat(currentInstance.buildingCount) * parseFloat(currentInstance.efficiencyRatio));
			ratePerBuilding = baseRate * parseFloat(currentInstance.efficiencyRatio);
		}

		return ratePerBuilding * parseFloat(currentInstance.buildingCount);
	}

	// Effect to auto-calculate building count when in auto mode
	$effect(() => {
		if (autoCalculateMode && desiredItemsPerMin > 0 && currentInstance) {
			buildingCount = calculateBuildingCount();
		}
	});

	// Initialize desired items per min with current production when opening
	$effect(() => {
		if (currentInstance && !autoCalculateMode && desiredItemsPerMin === 0) {
			desiredItemsPerMin = calculateCurrentProduction();
		}
	});

	// Expose methods for external use using Svelte 5 syntax
	export const open: EditProductionInstanceDialogHandle['open'] = function (
		instance: ProductionInstanceData
	) {
		currentInstance = instance;
		resetForm(instance);
		dialog?.showModal();
	};
</script>

<dialog bind:this={dialog} id="edit_production_instance_modal" class="modal">
	<div class="modal-box w-11/12 max-w-2xl">
		<h3 class="mb-4 text-lg font-bold">{$t('production.edit_production_instance')}</h3>

		{#if currentInstance}
			<form onsubmit={handleSubmit} class="flex flex-col gap-4">
				<!-- Read-only Item Information -->
				<div class="form-control">
					<div class="label">
						<span class="label-text">{$t('production.selected_item')}</span>
					</div>
					<div class="rounded-lg bg-base-200 p-3">
						{#if currentInstance.products && currentInstance.products.length > 0}
							{@const primaryItem = currentInstance.products[0].item}
							<div class="flex items-center gap-2 font-medium">
								{primaryItem.displayName}
								<span class="badge badge-outline badge-xs">{primaryItem.form}</span>
							</div>
						{:else}
							<div class="font-medium text-base-content/70">No item information available</div>
						{/if}
					</div>
				</div>

				<!-- Read-only Production Type -->
				<div class="form-control">
					<div class="label">
						<span class="label-text">{$t('production.production_method')}</span>
					</div>
					<div class="rounded-lg bg-base-200 p-3">
						{#if currentInstance.recipe}
							<span>🏭 {$t('production.craft_via_recipe')}</span>
						{:else if currentInstance.extractedItemVersionId}
							<span>⛏️ {$t('production.extract_from_deposits')}</span>
						{:else if currentInstance.building && currentInstance.building.type === 'Generator'}
							<span>⚡ {$t('production.generate_power')}</span>
						{:else}
							<span>🏭 {$t('production.craft_via_recipe')}</span>
						{/if}
					</div>
				</div>

				<!-- Read-only Recipe (if applicable) -->
				{#if currentInstance.recipe}
					<div class="form-control">
						<div class="label">
							<span class="label-text">{$t('production.selected_recipe')}</span>
						</div>
						<div class="rounded-lg bg-base-200 p-3">
							<div class="font-medium">{currentInstance.recipe.displayName}</div>
							{#if currentInstance.recipeVersion}
								<div class="text-sm text-base-content/70">
									{$t('production.manufacturing_duration')}: {parseFloat(
										currentInstance.recipeVersion.manufacturingDuration || '0'
									)}s
								</div>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Read-only Building -->
				<div class="form-control">
					<div class="label">
						<span class="label-text">{$t('production.selected_building')}</span>
					</div>
					<div class="rounded-lg bg-base-200 p-3">
						<div class="font-medium">{currentInstance.building?.name || 'Unknown Building'}</div>
						<div class="text-sm text-base-content/70">
							{$t('production.building_type')}: {currentInstance.building?.type || 'Unknown'}
						</div>
					</div>
				</div>

				<!-- Editable Fields -->
				<div class="divider">{$t('production.editable_settings')}</div>

				<!-- Current Production Display -->
				{#if currentInstance}
					<div class="form-control">
						<div class="alert alert-info">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								class="h-6 w-6 shrink-0 stroke-current"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								></path>
							</svg>
							<span>Production actuelle : {calculateCurrentProduction().toFixed(1)} items/min</span>
						</div>
					</div>
				{/if}

				<!-- Auto-calculation toggle -->
				{#if currentInstance && (currentInstance.extractedItemVersionId || currentInstance.recipe)}
					<div class="form-control">
						<label class="label cursor-pointer">
							<span class="label-text">Calcul automatique du nombre de bâtiments</span>
							<input type="checkbox" bind:checked={autoCalculateMode} class="checkbox checkbox-primary" />
						</label>
					</div>
				{/if}

				<!-- Desired production rate (only shown in auto mode) -->
				{#if autoCalculateMode}
					<div class="form-control">
						<label class="label" for="desired-rate-edit">
							<span class="label-text">Production souhaitée (items/min)<span class="text-error">*</span></span>
						</label>
						<input
							id="desired-rate-edit"
							type="number"
							class="input-bordered input w-full"
							bind:value={desiredItemsPerMin}
							min="0.1"
							step="0.1"
							placeholder="60"
							required
						/>
						{#if currentInstance && desiredItemsPerMin > 0}
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
							<span class="label-text">
								{$t('recipeInstances.building_count')}<span class="text-error">*</span>
							</span>
						</label>
						<input
							id="building-count"
							type="number"
							class="input-bordered input w-full {autoCalculateMode ? 'input-disabled' : ''}"
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
							class="input-bordered input w-full"
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

				<!-- Purity Selection (only shown for extraction) -->
				{#if currentInstance.extractedItemVersionId}
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

				<div class="modal-action">
					<button
						type="button"
						class="btn"
						onclick={() => {
							currentInstance = null;
							dialog?.close();
						}}
					>
						{$t('common.cancel')}
					</button>
					<button
						type="submit"
						class="btn btn-primary"
						disabled={gameState.isLoading ||
							buildingCount <= 0 ||
							efficiencyRatio <= 0 ||
							efficiencyRatio > 2.5}
					>
						{#if gameState.isLoading}
							<span class="loading loading-xs loading-spinner"></span>
						{/if}
						{$t('common.save')}
					</button>
				</div>
			</form>
		{/if}
	</div>

	<form method="dialog" class="modal-backdrop">
		<button
			aria-label={$t('common.close')}
			onclick={() => {
				currentInstance = null;
			}}
		>
			{$t('common.close')}
		</button>
	</form>
</dialog>

<style>
	dialog:not([open]) {
		display: none;
	}
</style>
