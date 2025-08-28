<script lang="ts">
	import { getGameState, type ProductionInstanceData } from '$lib/states/gameState.svelte';
	import { getAuthState } from '$lib/states/authState.svelte';
	import {
		Icon,
		Plus,
		ChartBarSquare,
		ChevronDown,
		ChevronRight,
		MagnifyingGlass,
		XMark
	} from 'svelte-hero-icons';
	import { t } from '$lib/i18n';
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import ProductionInstanceCard from './ProductionInstanceCard.svelte';
	import GroupedProductionInstanceCard from './GroupedProductionInstanceCard.svelte';
	import AddProductionInstanceDialog from '$lib/dialogs/AddProductionInstanceDialog.svelte';
	import type { AddProductionInstanceDialogHandle } from '$lib/dialogs/AddProductionInstanceDialogHandle';
	import EditProductionInstanceDialog from '$lib/dialogs/EditProductionInstanceDialog.svelte';
	import type { EditProductionInstanceDialogHandle } from '$lib/dialogs/EditProductionInstanceDialogHandle';
	import ConfirmDialog from '$lib/dialogs/ConfirmDialog.svelte';
	import type { ConfirmDialogHandle } from '$lib/dialogs/ConfirmDialogHandle';
	import { formatEnergy, calculateTotalEnergy } from '$lib/utils/energyFormatter';

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

	// Search functionality for production instances
	let searchTerm = $state('');

	// Filter by built status: 'all', 'built', 'not-built'
	let builtStatusFilter = $state<'all' | 'built' | 'not-built'>('all');

	// Filter production instances based on search term and built status
	let filteredInstances = $derived(() => {
		let instances = gameState.siteProductionInstances;

		// Filter by built status first
		if (builtStatusFilter !== 'all') {
			instances = instances.filter((instance) => {
				return builtStatusFilter === 'built' ? instance.isBuilt : !instance.isBuilt;
			});
		}

		// Then filter by search term
		if (!searchTerm.trim()) {
			return instances;
		}

		const term = searchTerm.toLowerCase();
		return instances.filter((instance) => {
			// Search in recipe name
			const recipeName = instance.recipe?.displayName?.toLowerCase() || '';
			if (recipeName.includes(term)) return true;

			// Search in building name
			const buildingName = instance.building?.name?.toLowerCase() || '';
			if (buildingName.includes(term)) return true;

			// Search in products
			const productMatch = instance.products?.some((product) =>
				product.item?.displayName?.toLowerCase().includes(term)
			);
			if (productMatch) return true;

			// Search in ingredients
			const ingredientMatch = instance.ingredients?.some((ingredient) =>
				ingredient.item?.displayName?.toLowerCase().includes(term)
			);
			if (ingredientMatch) return true;

			return false;
		});
	});

	// Helper function to get grouping key based on building type
	function getGroupingKey(instance: ProductionInstanceData): string {
		const buildingType = instance.building?.type;
		
		if (buildingType === 'Constructor' && instance.recipe?.displayName) {
			// For constructors: group by recipe name
			return instance.recipe.displayName;
		} else if (buildingType === 'Miner' && instance.products?.[0]?.item?.displayName) {
			// For miners: group by extracted item name
			return instance.products[0].item.displayName;
		} else if (buildingType === 'Generator' && instance.building?.name) {
			// For generators: group by generator type (building name)
			return instance.building.name;
		}
		
		// Fallback
		return instance.recipe?.displayName || instance.building?.name || 'Unknown';
	}

	// Interface for grouped instances
	interface GroupedProductionInstance {
		groupKey: string;
		buildingType: 'Constructor' | 'Generator' | 'Miner';
		instances: ProductionInstanceData[];
		totalBuildingCount: number;
		averageEfficiency: number;
		totalPowerConsumption: number;
		totalPowerProduction: number;
		primaryProduct?: { item: { displayName: string }; actualRate: number };
		totalIngredients: Array<{ item: { displayName: string }; actualRate: number }>;
	}

	// Group and aggregate instances
	let groupedAndSortedInstances = $derived((): GroupedProductionInstance[] => {
		const filtered = filteredInstances();
		
		// Group by building type and recipe/item
		const grouped: { [key: string]: GroupedProductionInstance } = {};
		
		filtered.forEach((instance) => {
			const buildingType = instance.building?.type as 'Constructor' | 'Generator' | 'Miner';
			const groupKey = getGroupingKey(instance);
			const key = `${buildingType}-${groupKey}`;
			
			if (!grouped[key]) {
				grouped[key] = {
					groupKey,
					buildingType,
					instances: [],
					totalBuildingCount: 0,
					averageEfficiency: 0,
					totalPowerConsumption: 0,
					totalPowerProduction: 0,
					totalIngredients: []
				};
			}
			
			const group = grouped[key];
			group.instances.push(instance);
			group.totalBuildingCount += parseFloat(instance.buildingCount);
			group.totalPowerConsumption += instance.production?.powerConsumption || 0;
			group.totalPowerProduction += instance.production?.powerProduction || 0;
		});
		
		// Calculate averages and aggregated data
		Object.values(grouped).forEach((group) => {
			// Average efficiency
			const totalEfficiency = group.instances.reduce(
				(sum, instance) => sum + parseFloat(instance.efficiencyRatio), 0
			);
			group.averageEfficiency = totalEfficiency / group.instances.length;
			
			// Primary product (first instance's primary product with total rate)
			const firstInstance = group.instances[0];
			if (firstInstance.products?.[0]) {
				const totalRate = group.instances.reduce(
					(sum, instance) => sum + (instance.products?.[0]?.actualRate || 0), 0
				);
				group.primaryProduct = {
					item: firstInstance.products[0].item,
					actualRate: totalRate
				};
			}
			
			// Aggregate ingredients
			const ingredientMap = new Map<string, { item: { displayName: string }; actualRate: number }>();
			group.instances.forEach((instance) => {
				instance.ingredients?.forEach((ingredient) => {
					const key = ingredient.item.displayName;
					if (ingredientMap.has(key)) {
						ingredientMap.get(key)!.actualRate += ingredient.actualRate;
					} else {
						ingredientMap.set(key, {
							item: { displayName: ingredient.item.displayName },
							actualRate: ingredient.actualRate
						});
					}
				});
			});
			group.totalIngredients = Array.from(ingredientMap.values());
		});
		
		// Sort by building type priority, then by group name
		const buildingTypeOrder = { 'Constructor': 0, 'Generator': 1, 'Miner': 2 };
		
		return Object.values(grouped).sort((a, b) => {
			const typeComparison = buildingTypeOrder[a.buildingType] - buildingTypeOrder[b.buildingType];
			if (typeComparison !== 0) return typeComparison;
			return a.groupKey.localeCompare(b.groupKey);
		});
	});

	// Create building type sections
	let buildingTypeSections = $derived(() => {
		const sections: Array<{ type: 'Constructor' | 'Generator' | 'Miner'; groups: GroupedProductionInstance[] }> = [];
		const typeOrder: Array<'Constructor' | 'Generator' | 'Miner'> = ['Constructor', 'Generator', 'Miner'];
		
		typeOrder.forEach((type) => {
			const groups = groupedAndSortedInstances().filter(g => g.buildingType === type);
			if (groups.length > 0) {
				sections.push({ type, groups });
			}
		});
		
		return sections;
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

	function clearSearch() {
		searchTerm = '';
	}

	function clearAllFilters() {
		searchTerm = '';
		builtStatusFilter = 'all';
	}

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
				await gameState.deleteProductionInstanceOptimistic(instance.id);
			}
		});
	}

	function formatRate(rate: number): string {
		return rate < 10 ? rate.toFixed(2) : rate.toFixed(1);
	}

	// Energy consumption data
	let energyConsumption = $derived(() => {
		const overview = gameState.siteProductionOverview;
		if (!overview) return null;

		const totalConsumption = overview.totalPowerConsumption;
		const totalProduction = overview.totalPowerProduction;
		const totalEnergy = calculateTotalEnergy(totalConsumption, totalProduction);

		return {
			consumption: formatEnergy(totalConsumption),
			production: formatEnergy(totalProduction),
			total: formatEnergy(totalEnergy),
			netBalance: totalProduction - totalConsumption
		};
	});

	// State for details expander
	let isResourceDetailsOpen = $state(false);

	// Track if we've completed the first load
	let hasLoadedOnce = $state(false);

	// Conditional loading that only applies during initial load
	let shouldShowInitialLoading = $derived(() => gameState.isLoading && !hasLoadedOnce);

	// Effect pour marquer le premier chargement comme terminé
	$effect(() => {
		if (!hasLoadedOnce && !gameState.isLoading) {
			hasLoadedOnce = true;
		}
	});
</script>

<div class="flex flex-col gap-6">
	<!-- Site Header with Actions -->
	<div class="flex items-center justify-between" in:fly={{ y: -20, duration: 500, delay: 100 }}>
		<div in:fly={{ x: -20, duration: 400, delay: 200 }}>
			<div class="flex items-center gap-3">
				<h2 class="text-xl font-semibold">{siteName}</h2>
				{#if energyConsumption() && !shouldShowInitialLoading()}
					{@const energy = energyConsumption()}
					{#if energy && Math.abs(energy.netBalance) > 0.1}
						<span class="badge {energy.netBalance > 0 ? 'badge-success' : 'badge-error'} font-mono">
							{energy.netBalance > 0 ? '+' : ''}{formatEnergy(energy.netBalance).formatted}
							{formatEnergy(energy.netBalance).unit}
						</span>
					{:else if energy}
						<span class="badge font-mono badge-neutral">
							±{formatEnergy(Math.abs(energy.netBalance)).formatted}
							{formatEnergy(Math.abs(energy.netBalance)).unit}
						</span>
					{/if}
				{/if}
			</div>
			<p class="mt-1 text-sm text-base-content/70">
				{gameState.siteProductionInstances.length}
				{gameState.siteProductionInstances.length === 1
					? $t('productionInstances.recipe_instance')
					: $t('productionInstances.recipe_instances')}
			</p>
		</div>

		{#if canManage()}
			<button
				class="btn transition-transform btn-primary hover:scale-105"
				onclick={() => {
					console.log('🔍 Add Recipe button clicked');
					handleAddRecipe();
				}}
				disabled={gameState.isLoading}
				in:fly={{ x: 20, duration: 400, delay: 300 }}
			>
				<Icon src={Plus} class="size-4" />
				{$t('productionInstances.add_recipe')}
			</button>
		{/if}
	</div>

	<!-- Resource Balance Section -->
	{#if resourceBalance() && !shouldShowInitialLoading()}
		{@const balance = resourceBalance()}
		<div
			class="card border border-base-300 bg-base-100"
			in:fly={{ y: 20, duration: 400, delay: 500 }}
		>
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
	{#if gameState.siteProductionInstances.length === 0}
		{#if shouldShowInitialLoading()}
			<div class="flex items-center justify-center py-8">
				<span class="loading loading-lg loading-spinner"></span>
			</div>
		{:else}
			<div class="py-12 text-center" in:fade={{ duration: 400, delay: 200 }}>
				<div class="mb-4 opacity-50" in:fly={{ y: 30, duration: 400, delay: 300 }}>
					<Icon src={ChartBarSquare} class="mx-auto size-16" />
				</div>
				<h3 class="mb-2 font-semibold" in:fly={{ y: 20, duration: 400, delay: 400 }}>
					{$t('productionInstances.no_instances')}
				</h3>
				<p class="mb-6 text-base-content/70" in:fly={{ y: 20, duration: 400, delay: 500 }}>
					{$t('productionInstances.no_instances_description')}
				</p>
				{#if canManage()}
					<button
						class="btn transition-transform btn-primary hover:scale-105"
						onclick={handleAddRecipe}
						in:fly={{ y: 20, duration: 400, delay: 600 }}
					>
						<Icon src={Plus} class="size-4" />
						{$t('productionInstances.add_first_recipe')}
					</button>
				{/if}
			</div>
		{/if}
	{:else}
		<div class="relative" in:fade={{ duration: 300, delay: 600 }}>
			<!-- Loading overlay -->
			{#if shouldShowInitialLoading()}
				<div
					class="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-base-100/80"
				>
					<span class="loading loading-lg loading-spinner"></span>
				</div>
			{/if}

			<div class={shouldShowInitialLoading() ? 'pointer-events-none opacity-50' : ''}>
				<h3 class="mb-4 font-medium" in:fly={{ x: -20, duration: 400, delay: 700 }}>
					{$t('productionInstances.recipe_instances')}
				</h3>

				<!-- Filter and Search Controls -->
				{#if gameState.siteProductionInstances.length >= 1}
					<div class="mb-6 space-y-4" in:fly={{ y: 20, duration: 400, delay: 800 }}>
						<!-- Built Status Filter Buttons -->
						<div class="flex gap-2">
							<button
								class="btn btn-sm {builtStatusFilter === 'all' ? 'btn-primary' : 'btn-outline'}"
								onclick={() => (builtStatusFilter = 'all')}
							>
								Tout ({gameState.siteProductionInstances.length})
							</button>
							<button
								class="btn btn-sm {builtStatusFilter === 'built' ? 'btn-success' : 'btn-outline'}"
								onclick={() => (builtStatusFilter = 'built')}
							>
								Construit ({gameState.siteProductionInstances.filter((i) => i.isBuilt).length})
							</button>
							<button
								class="btn btn-sm {builtStatusFilter === 'not-built'
									? 'btn-warning'
									: 'btn-outline'}"
								onclick={() => (builtStatusFilter = 'not-built')}
							>
								Non construit ({gameState.siteProductionInstances.filter((i) => !i.isBuilt).length})
							</button>
						</div>

						<!-- Search Bar -->
						<div class="relative">
							<Icon
								src={MagnifyingGlass}
								class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-base-content/50"
							/>
							<input
								type="text"
								bind:value={searchTerm}
								placeholder={$t('productionInstances.search_instances')}
								class="input-bordered input w-full pr-10 pl-10"
							/>
							{#if searchTerm}
								<button
									onclick={clearSearch}
									class="btn absolute top-1/2 right-1 btn-circle -translate-y-1/2 btn-ghost btn-sm hover:bg-base-300"
									title={$t('productionInstances.clear_search')}
									in:fade={{ duration: 150 }}
									out:fade={{ duration: 100 }}
								>
									<Icon src={XMark} class="size-3" />
								</button>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Production Instances Grid -->
				{#if buildingTypeSections().length === 0 && (searchTerm || builtStatusFilter !== 'all')}
					<div class="py-6 text-center" in:fade={{ duration: 200 }}>
						<p class="text-base-content/70">
							{#if searchTerm}
								{$t('productionInstances.no_instances_found')}
							{:else}
								Aucune instance {builtStatusFilter === 'built' ? 'construite' : 'non construite'} trouvée
							{/if}
						</p>
						<button class="btn mt-2 btn-ghost btn-sm" onclick={clearAllFilters}>
							Effacer les filtres
						</button>
					</div>
				{:else}
					{#each buildingTypeSections() as section, sectionIndex (section.type)}
						<div class="mb-8" in:fly={{ y: 20, duration: 400, delay: 900 + sectionIndex * 200 }}>
							<h4 class="text-lg font-semibold mb-4 flex items-center gap-2">
								{$t(`buildingTypes.${section.type}`)}
								<span class="badge badge-sm badge-neutral">
									{section.groups.length}
									{section.groups.length === 1 ? 'groupe' : 'groupes'}
								</span>
							</h4>
							<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
								{#each section.groups as group, groupIndex (group.groupKey + group.buildingType)}
									<div
										animate:flip={{ duration: 300 }}
										in:fly={!hasLoadedOnce
											? {
													y: 30,
													duration: 400,
													delay: 1000 + sectionIndex * 200 + groupIndex * 100,
													easing: cubicOut
												}
											: undefined}
										out:fly={{ y: -10, duration: 200, easing: cubicOut }}
										class="h-full transition-all duration-300 hover:scale-105 hover:shadow-xl"
									>
										{#if group.instances.length === 1}
											<!-- Single instance - use regular card -->
											<ProductionInstanceCard
												instance={group.instances[0]}
												onEdit={handleEditInstance}
												onDelete={handleDeleteInstance}
											/>
										{:else}
											<!-- Multiple instances - use grouped card -->
											<GroupedProductionInstanceCard
												{group}
												onEditInstance={handleEditInstance}
												onDeleteInstance={handleDeleteInstance}
											/>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- Dialogs -->
<AddProductionInstanceDialog bind:this={addRecipeDialogRef} />
<EditProductionInstanceDialog bind:this={editInstanceDialogRef} />
<ConfirmDialog bind:this={confirmDialogRef} />
