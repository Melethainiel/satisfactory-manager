<script lang="ts">
	import { getGameState, type ProductionInstanceData } from '$lib/states/gameState.svelte';
	import { getAuthState } from '$lib/states/authState.svelte';
	import { Icon, Plus, ChartBarSquare, ChevronDown, ChevronRight } from 'svelte-hero-icons';
	import { t } from '$lib/i18n';
	import { onMount } from 'svelte';
	import ProductionInstanceCard from './ProductionInstanceCard.svelte';
	import AddProductionInstanceDialog from '$lib/dialogs/AddProductionInstanceDialog.svelte';
	import type { AddProductionInstanceDialogHandle } from '$lib/dialogs/AddProductionInstanceDialogHandle';
	import EditProductionInstanceDialog from '$lib/dialogs/EditProductionInstanceDialog.svelte';
	import type { EditProductionInstanceDialogHandle } from '$lib/dialogs/EditProductionInstanceDialogHandle';
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
	let editInstanceDialogRef: EditProductionInstanceDialogHandle | null = $state(null);
	let confirmDialogRef: ConfirmDialogHandle | null = $state(null);

	// Check permissions
	let canManage = $derived(() => {
		if (!authState.isAuthenticated || !authState.user?.email) return false;
		return gameState.canManageSites(authState.user.email);
	});

	// Removed unused productionStats

	// Resource balance data with production and consumption values
	let resourceBalance = $derived(() => {
		const overview = gameState.siteProductionOverview;
		if (!overview) return null;

		// Get all unique item IDs from production, consumption, and net balance
		const allItemIds = new Set([
			...overview.totalProduction.map((item) => item.itemId),
			...overview.totalConsumption.map((item) => item.itemId),
			...overview.netBalance.map((item) => item.itemId)
		]);

		// Create production and consumption maps for quick lookup
		const productionMap = new Map(overview.totalProduction.map((item) => [item.itemId, item]));
		const consumptionMap = new Map(overview.totalConsumption.map((item) => [item.itemId, item]));
		const balanceMap = new Map(overview.netBalance.map((item) => [item.itemId, item]));

		// Build complete resource data including all items (even those with 0 values)
		const allResources = Array.from(allItemIds)
			.map((itemId) => {
				const production = productionMap.get(itemId);
				const consumption = consumptionMap.get(itemId);
				const balance = balanceMap.get(itemId);

				const productionRate = production?.rate || 0;
				const consumptionRate = consumption?.rate || 0;
				const netBalance = balance?.balance || productionRate - consumptionRate;

				// Determine type based on balance
				let type: string;
				if (Math.abs(netBalance) <= 0.001) {
					type = 'balanced';
				} else if (netBalance > 0) {
					type = 'overflow';
				} else {
					type = 'underflow';
				}

				return {
					itemId,
					itemName: production?.itemName || consumption?.itemName || balance?.itemName || 'Unknown',
					productionRate,
					consumptionRate,
					netBalance,
					absBalance: Math.abs(netBalance),
					type
				};
			})
			.sort((a, b) => b.absBalance - a.absBalance); // Sort by magnitude of balance

		return {
			resources: allResources,
			hasOverflow: allResources.some((item) => item.type === 'overflow'),
			hasUnderflow: allResources.some((item) => item.type === 'underflow'),
			hasBalanced: allResources.some((item) => item.type === 'balanced'),
			isEmpty: allResources.length === 0
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
		if (editInstanceDialogRef?.open) {
			editInstanceDialogRef.open(instance);
		}
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

	// State for details expander
	let isResourceDetailsOpen = $state(false);

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

	<!-- Resource Balance Section -->
	{#if resourceBalance() && !gameState.isLoading}
		{@const balance = resourceBalance()}
		<div class="card border border-base-300 bg-base-100">
			<div class="card-body">
				<!-- Collapsible header -->
				<details bind:open={isResourceDetailsOpen} class="group">
					<summary class="cursor-pointer list-none">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<h3 class="card-title text-lg">{$t('resourceBalance.title')}</h3>
								{#if balance?.resources && balance.resources.length > 0}
									<span class="badge badge-sm badge-neutral">
										{$t(
											balance.resources.length === 1
												? 'resourceBalance.resource_count_singular'
												: 'resourceBalance.resource_count',
											{
												values: { count: balance.resources.length }
											}
										)}
									</span>
								{/if}
							</div>
							<Icon
								src={isResourceDetailsOpen ? ChevronDown : ChevronRight}
								class="size-5 transition-transform group-hover:text-primary"
							/>
						</div>
					</summary>

					<!-- Collapsible content -->
					<div class="mt-4">
						{#if balance?.isEmpty}
							<div class="py-4 text-center">
								<p class="font-medium text-success">{$t('resourceBalance.no_resources')}</p>
								<p class="mt-1 text-sm text-base-content/70">
									{$t('resourceBalance.no_resources_description')}
								</p>
							</div>
						{:else if balance?.resources}
							<div class="overflow-x-auto">
								<table class="table table-zebra">
									<thead>
										<tr>
											<th>{$t('resourceBalance.resource')}</th>
											<th class="text-right">{$t('resourceBalance.production')}</th>
											<th class="text-right">{$t('resourceBalance.consumption')}</th>
											<th class="text-right">{$t('resourceBalance.net_balance')}</th>
											<th class="text-center">{$t('resourceBalance.status')}</th>
										</tr>
									</thead>
									<tbody>
										{#each balance.resources as resource (resource.itemId)}
											<tr>
												<td class="font-medium">{resource.itemName}</td>
												<td class="text-right font-mono">
													{formatRate(resource.productionRate)}{$t('resourceBalance.per_minute')}
												</td>
												<td class="text-right font-mono">
													{formatRate(resource.consumptionRate)}{$t('resourceBalance.per_minute')}
												</td>
												<td
													class="text-right font-mono {resource.type === 'overflow'
														? 'text-success'
														: resource.type === 'underflow'
															? 'text-error'
															: 'text-warning'}"
												>
													{resource.type === 'overflow'
														? '+'
														: resource.type === 'underflow'
															? '-'
															: '±'}{formatRate(resource.absBalance)}{$t(
														'resourceBalance.per_minute'
													)}
												</td>
												<td class="text-center">
													<div
														class="badge badge-sm {resource.type === 'overflow'
															? 'badge-success'
															: resource.type === 'underflow'
																? 'badge-error'
																: 'badge-warning'}"
													>
														{resource.type === 'overflow'
															? $t('resourceBalance.overflow')
															: resource.type === 'underflow'
																? $t('resourceBalance.underflow')
																: $t('resourceBalance.balanced')}
													</div>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					</div>
				</details>
			</div>
		</div>
	{/if}

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
<EditProductionInstanceDialog bind:this={editInstanceDialogRef} />
<ConfirmDialog bind:this={confirmDialogRef} />
