<script lang="ts">
	import { getGameState, type RecipeInstanceData } from '$lib/states/gameState.svelte';
	import { getAuthState } from '$lib/states/authState.svelte';
	import { Icon, Plus, ChartBarSquare } from 'svelte-hero-icons';
	import { t } from '$lib/i18n';
	import { onMount } from 'svelte';
	import RecipeInstanceCard from './RecipeInstanceCard.svelte';
	import AddRecipeInstanceDialog from '$lib/dialogs/AddRecipeInstanceDialog.svelte';
	import type { AddRecipeInstanceDialogHandle } from '$lib/dialogs/AddRecipeInstanceDialogHandle';
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
	let addRecipeDialogRef: AddRecipeInstanceDialogHandle | null = $state(null);
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
		const imbalances = overview.netBalance.filter(item => Math.abs(item.balance) > 0.001).length;

		return {
			inputs: totalInputs,
			outputs: totalOutputs,
			imbalances: imbalances
		};
	});

	onMount(async () => {
		// Load recipe instances and production overview for this site
		await Promise.all([
			gameState.loadSiteRecipeInstances(siteId),
			gameState.loadSiteProductionOverview(siteId)
		]);
	});

	// Watch for site changes and reload data
	$effect(() => {
		if (siteId) {
			gameState.loadSiteRecipeInstances(siteId);
			gameState.loadSiteProductionOverview(siteId);
		}
	});

	function handleAddRecipe() {
		addRecipeDialogRef?.open(siteId);
	}

	function handleEditInstance(instance: RecipeInstanceData) {
		// TODO: Open edit dialog
		console.log('Edit instance:', instance);
	}

	function handleDeleteInstance(instance: RecipeInstanceData) {
		confirmDialogRef?.open({
			title: $t('recipeInstances.delete_instance'),
			message: $t('recipeInstances.delete_instance_confirm', { 
				values: { name: instance.recipe?.displayName || 'Unknown Recipe' }
			}),
			confirmText: $t('recipeInstances.delete_instance'),
			type: 'danger',
			onConfirm: async () => {
				await gameState.deleteRecipeInstance(instance.id);
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
			<p class="text-base-content/70 text-sm mt-1">
				{gameState.siteRecipeInstances.length} 
				{gameState.siteRecipeInstances.length === 1 ? 
					$t('recipeInstances.recipe_instance') : 
					$t('recipeInstances.recipe_instances')
				}
			</p>
		</div>

		{#if canManage()}
			<button
				class="btn btn-primary"
				onclick={handleAddRecipe}
				disabled={gameState.isLoading}
			>
				<Icon src={Plus} class="size-4" />
				{$t('recipeInstances.add_recipe')}
			</button>
		{/if}
	</div>

	<!-- Production Overview Stats -->
	{#if productionStats}
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<div class="stat bg-base-200 rounded-lg">
				<div class="stat-figure text-primary">
					<Icon src={ChartBarSquare} class="size-8" />
				</div>
				<div class="stat-title text-xs">{$t('recipeInstances.total_inputs')}</div>
				<div class="stat-value text-2xl">{productionStats()?.inputs || 0}</div>
			</div>

			<div class="stat bg-base-200 rounded-lg">
				<div class="stat-figure text-secondary">
					<Icon src={ChartBarSquare} class="size-8" />
				</div>
				<div class="stat-title text-xs">{$t('recipeInstances.total_outputs')}</div>
				<div class="stat-value text-2xl">{productionStats()?.outputs || 0}</div>
			</div>

			<div class="stat bg-base-200 rounded-lg">
				<div class="stat-figure {(productionStats()?.imbalances || 0) > 0 ? 'text-warning' : 'text-success'}">
					<Icon src={ChartBarSquare} class="size-8" />
				</div>
				<div class="stat-title text-xs">{$t('recipeInstances.imbalances')}</div>
				<div class="stat-value text-2xl">{productionStats()?.imbalances || 0}</div>
			</div>
		</div>
	{/if}

	<!-- Production Overview Details -->
	{#if gameState.siteProductionOverview && (gameState.siteProductionOverview.totalProduction.length > 0 || gameState.siteProductionOverview.totalConsumption.length > 0)}
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Production -->
			{#if gameState.siteProductionOverview.totalProduction.length > 0}
				<div class="bg-success/10 rounded-lg p-4">
					<h3 class="font-medium text-success mb-3 flex items-center gap-2">
						<div class="size-3 bg-success rounded-full"></div>
						{$t('recipeInstances.total_production')}
					</h3>
					<div class="space-y-2">
						{#each gameState.siteProductionOverview.totalProduction as item}
							<div class="flex justify-between items-center text-sm">
								<span>{item.itemName}</span>
								<span class="font-mono font-semibold">
									{formatRate(item.rate)}/{$t('common.minute')}
								</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Consumption -->
			{#if gameState.siteProductionOverview.totalConsumption.length > 0}
				<div class="bg-warning/10 rounded-lg p-4">
					<h3 class="font-medium text-warning mb-3 flex items-center gap-2">
						<div class="size-3 bg-warning rounded-full"></div>
						{$t('recipeInstances.total_consumption')}
					</h3>
					<div class="space-y-2">
						{#each gameState.siteProductionOverview.totalConsumption as item}
							<div class="flex justify-between items-center text-sm">
								<span>{item.itemName}</span>
								<span class="font-mono font-semibold">
									{formatRate(item.rate)}/{$t('common.minute')}
								</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Net Balance -->
	{#if gameState.siteProductionOverview?.netBalance && gameState.siteProductionOverview.netBalance.length > 0}
		<div class="bg-base-200 rounded-lg p-4">
			<h3 class="font-medium mb-3">{$t('recipeInstances.net_balance')}</h3>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
				{#each gameState.siteProductionOverview.netBalance as item}
					<div class="flex justify-between items-center text-sm p-2 rounded {item.balance > 0 ? 'bg-success/20' : 'bg-error/20'}">
						<span>{item.itemName}</span>
						<span class="font-mono font-semibold {item.balance > 0 ? 'text-success' : 'text-error'}">
							{item.balance > 0 ? '+' : ''}{formatRate(item.balance)}/{$t('common.minute')}
						</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Recipe Instances List -->
	{#if gameState.isLoading}
		<div class="flex items-center justify-center py-8">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if gameState.siteRecipeInstances.length === 0}
		<div class="text-center py-12">
			<div class="mb-4 opacity-50">
				<Icon src={ChartBarSquare} class="size-16 mx-auto" />
			</div>
			<h3 class="font-semibold mb-2">{$t('recipeInstances.no_instances')}</h3>
			<p class="text-base-content/70 mb-6">{$t('recipeInstances.no_instances_description')}</p>
			{#if canManage()}
				<button class="btn btn-primary" onclick={handleAddRecipe}>
					<Icon src={Plus} class="size-4" />
					{$t('recipeInstances.add_first_recipe')}
				</button>
			{/if}
		</div>
	{:else}
		<div>
			<h3 class="font-medium mb-4">{$t('recipeInstances.recipe_instances')}</h3>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each gameState.siteRecipeInstances as instance (instance.id)}
					<RecipeInstanceCard 
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
<AddRecipeInstanceDialog bind:this={addRecipeDialogRef} />
<ConfirmDialog bind:this={confirmDialogRef} />