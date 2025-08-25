<script lang="ts">
	import { getGameState, type ProductionInstanceData } from '$lib/states/gameState.svelte';
	import { getAuthState } from '$lib/states/authState.svelte';
	import { Icon, Plus, ChartBarSquare } from 'svelte-hero-icons';
	import { t } from '$lib/i18n';
	import { onMount } from 'svelte';
	import ProductionInstanceCard from './ProductionInstanceCard.svelte';
	import AddProductionInstanceDialog from '$lib/dialogs/AddProductionInstanceDialog.svelte';
	import type { AddProductionInstanceDialogHandle } from '$lib/dialogs/AddProductionInstanceDialogHandle';
	import ConfirmDialog from '$lib/dialogs/ConfirmDialog.svelte';
	import type { ConfirmDialogHandle } from '$lib/dialogs/ConfirmDialogHandle';

	interface Props {
		siteId: string;
		siteName: string;
	}

	let { siteId, siteName }: Props = $props();

	const gameState = getGameState();
	const authState = getAuthState();

	// Dialog refs
	let addRecipeDialogRef: AddProductionInstanceDialogHandle | null = $state(null);
	let confirmDialogRef: ConfirmDialogHandle | null = $state(null);

	// Check permissions
	let canManage = $derived(() => {
		if (!authState.isAuthenticated || !authState.user?.email) return false;
		return gameState.canManageSites(authState.user.email);
	});

	// Production overview stats
	let productionStats = $derived(() => {
		const overview = gameState.siteProductionOverview;
		if (!overview) return null;

		const totalInputs = overview.totalConsumption.length;
		const totalOutputs = overview.totalProduction.length;
		const imbalances = overview.netBalance.filter((item) => Math.abs(item.balance) > 0.001).length;

		return {
			inputs: totalInputs,
			outputs: totalOutputs,
			imbalances: imbalances
		};
	});

	onMount(async () => {
		// Load consolidated production summary for this site
		await gameState.loadSiteProductionSummary(siteId);
	});

	// Watch for site changes and reload data
	$effect(() => {
		if (siteId) {
			gameState.loadSiteProductionSummary(siteId);
		}
	});

	function handleAddRecipe() {
		if (addRecipeDialogRef?.open) {
			addRecipeDialogRef.open(siteId);
		}
	}

	function handleEditInstance(instance: ProductionInstanceData) {
		// TODO: Open edit dialog
		console.log('Edit instance:', instance);
	}

	function handleDeleteInstance(instance: ProductionInstanceData) {
		confirmDialogRef?.open({
			title: $t('productionInstances.delete_instance'),
			message: $t('productionInstances.delete_instance_confirm', {
				values: { name: instance.recipe?.displayName || 'Unknown Recipe' }
			}),
			confirmText: $t('productionInstances.delete_instance'),
			type: 'danger',
			onConfirm: async () => {
				await gameState.deleteProductionInstance(instance.id);
			}
		});
	}

	function formatRate(rate: number): string {
		return rate < 10 ? rate.toFixed(2) : rate.toFixed(1);
	}
</script>

<div class="flex flex-col gap-6">
	<!-- Site Header with Actions -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-xl font-semibold">{siteName}</h2>
			<p class="mt-1 text-sm text-base-content/70">
				{gameState.siteProductionInstances.length}
				{gameState.siteProductionInstances.length === 1
					? $t('productionInstances.recipe_instance')
					: $t('productionInstances.recipe_instances')}
			</p>
		</div>

		{#if canManage()}
			<button
				class="btn btn-primary"
				onclick={() => {
					console.log('🔍 Add Recipe button clicked');
					handleAddRecipe();
				}}
				disabled={gameState.isLoading}
			>
				<Icon src={Plus} class="size-4" />
				{$t('productionInstances.add_recipe')}
			</button>
		{/if}
	</div>

	<!-- Recipe Instances List -->
	{#if gameState.isLoading}
		<div class="flex items-center justify-center py-8">
			<span class="loading loading-lg loading-spinner"></span>
		</div>
	{:else if gameState.siteProductionInstances.length === 0}
		<div class="py-12 text-center">
			<div class="mb-4 opacity-50">
				<Icon src={ChartBarSquare} class="mx-auto size-16" />
			</div>
			<h3 class="mb-2 font-semibold">{$t('productionInstances.no_instances')}</h3>
			<p class="mb-6 text-base-content/70">{$t('productionInstances.no_instances_description')}</p>
			{#if canManage()}
				<button class="btn btn-primary" onclick={handleAddRecipe}>
					<Icon src={Plus} class="size-4" />
					{$t('productionInstances.add_first_recipe')}
				</button>
			{/if}
		</div>
	{:else}
		<div>
			<h3 class="mb-4 font-medium">{$t('productionInstances.recipe_instances')}</h3>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each gameState.siteProductionInstances as instance (instance.id)}
					<ProductionInstanceCard
						{instance}
						onEdit={handleEditInstance}
						onDelete={handleDeleteInstance}
					/>
				{/each}
			</div>
		</div>
	{/if}
</div>

<!-- Dialogs -->
<AddProductionInstanceDialog bind:this={addRecipeDialogRef} />
<ConfirmDialog bind:this={confirmDialogRef} />
