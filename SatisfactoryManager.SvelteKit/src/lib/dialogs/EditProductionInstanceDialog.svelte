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
	let notes = $state('');

	// Reset form with instance data
	function resetForm(instance: ProductionInstanceData) {
		buildingCount = parseFloat(instance.buildingCount);
		efficiencyRatio = parseFloat(instance.efficiencyRatio);
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
			const updateData = {
				buildingCount: buildingCount,
				efficiencyRatio: efficiencyRatio,
				notes: notes.trim() || undefined
			};

			await gameState.updateProductionInstance(currentInstance.id, updateData);

			console.log('✅ Production instance updated successfully');
			currentInstance = null;
			dialog?.close();
		} catch (error) {
			console.error('❌ Failed to update production instance:', error);
		}
	}

	// Expose methods for external use using Svelte 5 syntax
	export const open: EditProductionInstanceDialogHandle['open'] = function (instance: ProductionInstanceData) {
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
					<label class="label">
						<span class="label-text">{$t('production.selected_item')}</span>
					</label>
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
					<label class="label">
						<span class="label-text">{$t('production.production_method')}</span>
					</label>
					<div class="rounded-lg bg-base-200 p-3">
						{#if currentInstance.recipe}
							<span>🏭 {$t('production.craft_via_recipe')}</span>
						{:else if currentInstance.extractedItemId}
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
						<label class="label">
							<span class="label-text">{$t('production.selected_recipe')}</span>
						</label>
						<div class="rounded-lg bg-base-200 p-3">
							<div class="font-medium">{currentInstance.recipe.displayName}</div>
							{#if currentInstance.recipeVersion}
								<div class="text-sm text-base-content/70">
									{$t('production.manufacturing_duration')}: {parseFloat(currentInstance.recipeVersion.manufacturingDuration || '0')}s
								</div>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Read-only Building -->
				<div class="form-control">
					<label class="label">
						<span class="label-text">{$t('production.selected_building')}</span>
					</label>
					<div class="rounded-lg bg-base-200 p-3">
						<div class="font-medium">{currentInstance.building?.name || 'Unknown Building'}</div>
						<div class="text-sm text-base-content/70">
							{$t('production.building_type')}: {currentInstance.building?.type || 'Unknown'}
						</div>
					</div>
				</div>

				<!-- Editable Fields -->
				<div class="divider">{$t('production.editable_settings')}</div>

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
							class="input-bordered input w-full"
							bind:value={buildingCount}
							min="1"
							max="1000"
							step="1"
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
						disabled={gameState.isLoading || buildingCount <= 0 || efficiencyRatio <= 0 || efficiencyRatio > 2.5}
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
			onclick={() => { currentInstance = null; }}
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