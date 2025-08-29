<script lang="ts">
	import { getGameState, type ProductionInstanceData } from '$lib/states/gameState.svelte';
	import { getAuthState } from '$lib/states/authState.svelte';
	import {
		Icon,
		PencilSquare,
		Trash,
		Cog6Tooth,
		CheckBadge,
		ChevronDown,
		ChevronRight
	} from 'svelte-hero-icons';
	import { t } from '$lib/i18n';
	import { slide } from 'svelte/transition';
	import ProductionInstanceCard from './ProductionInstanceCard.svelte';

	// Import the GroupedProductionInstance interface from parent
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

	interface Props {
		group: GroupedProductionInstance;
		onEditInstance?: (instance: ProductionInstanceData) => void;
		onDeleteInstance?: (instance: ProductionInstanceData) => void;
	}

	let { group, onEditInstance, onDeleteInstance }: Props = $props();

	const gameState = getGameState();
	const authState = getAuthState();

	// Local state for expansion
	let isExpanded = $state(false);

	// Check if current user can edit instances
	let canEdit = $derived(() => {
		if (!authState.isAuthenticated || !authState.user?.email) return false;
		return gameState.canManageSites(authState.user.email);
	});

	// Helper to determine instance type
	function getInstanceType(
		buildingType: 'Constructor' | 'Generator' | 'Miner'
	): 'craft' | 'extract' | 'power' {
		if (buildingType === 'Generator') return 'power';
		if (buildingType === 'Miner') return 'extract';
		return 'craft';
	}

	// Calculate efficiency color
	let utilizationColor = $derived(() => {
		const percent = Math.round(group.averageEfficiency * 100);
		if (percent >= 100) return 'text-success';
		if (percent >= 75) return 'text-warning';
		return 'text-error';
	});

	// Count of built vs unbuilt instances
	let builtStats = $derived(() => {
		const builtCount = group.instances.filter((i) => i.isBuilt).length;
		const totalCount = group.instances.length;
		return { built: builtCount, total: totalCount, unbuilt: totalCount - builtCount };
	});

	function formatRate(rate: number): string {
		return rate < 10 ? rate.toFixed(2) : rate.toFixed(1);
	}

	function formatPower(power: number): string {
		return power < 100 ? power.toFixed(1) : power.toFixed(0);
	}

	// Helper function to get net balance for a specific item with visual indicators
	function getNetBalance(itemName: string): {
		balance: number;
		balanceText: string;
		cssClass: string;
		symbol: string;
	} {
		const overview = gameState.siteProductionOverview;
		const netBalanceItem = overview?.netBalance.find((item) => item.itemName === itemName);

		if (netBalanceItem) {
			const balance = netBalanceItem.balance;
			const sign = balance >= 0 ? '+' : '';
			const balanceText = `${sign}${formatRate(balance)}${$t('resourceBalance.per_minute')}`;

			// Determine CSS class and symbol based on balance
			let cssClass: string;
			let symbol: string;

			if (balance > 0) {
				cssClass = 'text-success font-semibold';
				symbol = '▲';
			} else if (balance < 0) {
				cssClass = 'text-error font-semibold';
				symbol = '▼';
			} else {
				cssClass = 'text-warning font-semibold';
				symbol = '●';
			}

			return { balance, balanceText, cssClass, symbol };
		} else {
			const balanceText = `0${$t('resourceBalance.per_minute')}`;
			return { balance: 0, balanceText, cssClass: 'text-warning font-semibold', symbol: '●' };
		}
	}

	// Get inline display text for production with net balance
	function getProductionDisplayText(): string {
		if (!group.primaryProduct) return '';

		const itemName = group.primaryProduct.item.displayName;
		const productionRate = `${formatRate(group.primaryProduct.actualRate)}/${$t('common.minute')}`;
		const netBalance = getNetBalance(itemName);

		return `${itemName} ${productionRate} <span class="${netBalance.cssClass}">${netBalance.symbol}${netBalance.balanceText}</span>`;
	}

	// Get inline display text for ingredients with net balance
	function getIngredientDisplayText(ingredient: {
		item: { displayName: string };
		actualRate: number;
	}): string {
		const itemName = ingredient.item.displayName;
		const consumptionRate = `${formatRate(ingredient.actualRate)}/${$t('common.minute')}`;
		const netBalance = getNetBalance(itemName);

		return `${itemName} ${consumptionRate} <span class="${netBalance.cssClass}">${netBalance.symbol}${netBalance.balanceText}</span>`;
	}

	function toggleExpansion() {
		isExpanded = !isExpanded;
	}
</script>

<div
	class="card-compact card flex h-full flex-col border border-base-300 bg-base-100 shadow-sm transition-shadow hover:shadow-md"
>
	<div class="card-body flex flex-1 flex-col">
		<!-- Header with Group Name and Expand Button -->
		<div class="flex items-start justify-between gap-2">
			<div class="min-w-0 flex-1">
				<h4 class="truncate text-base font-semibold">
					{group.groupKey}
				</h4>
				<div class="flex items-center gap-2 text-sm opacity-70">
					<Icon src={Cog6Tooth} class="size-4 flex-shrink-0" />
					<span class="truncate">
						{group.instances.length}
						{group.instances.length === 1 ? $t('ui.instance') : $t('ui.instances')}
					</span>
				</div>
				<!-- Built Status Indicator -->
				<div class="mt-1 flex items-center gap-2">
					{#if builtStats().built === builtStats().total}
						<span class="badge gap-1 badge-sm badge-success">
							<Icon src={CheckBadge} class="size-3" />
							{$t('ui.all_built')}
						</span>
					{:else if builtStats().built === 0}
						<span class="badge badge-sm badge-warning">{$t('ui.none_built')}</span>
					{:else}
						<span class="badge badge-sm badge-info">
							{$t('ui.built_count', { values: { built: builtStats().built, total: builtStats().total } })}
						</span>
					{/if}
				</div>
			</div>

			<!-- Expand/Collapse Button -->
			<button
				class="btn btn-square btn-ghost btn-xs"
				onclick={toggleExpansion}
				title={isExpanded ? $t('ui.collapse') : $t('ui.expand_instances')}
			>
				<Icon src={isExpanded ? ChevronDown : ChevronRight} class="size-4" />
			</button>
		</div>

		<!-- Aggregated Production Information -->
		<div class="flex flex-1 flex-col justify-start">
			{#if getInstanceType(group.buildingType) === 'craft'}
				<!-- CRAFT: Show primary production + ingredients + power consumption -->
				{#if group.primaryProduct}
					<div class="mt-3 grid grid-cols-1 gap-3">
						<!-- Primary Production (Aggregated) -->
						<div class="rounded bg-base-200 p-3">
							<div class="mb-1 text-xs font-medium opacity-70">
								{$t('productionInstances.production_rate')} (Total)
							</div>
							<div class="font-mono text-sm">
								<span class="font-semibold">{formatRate(group.primaryProduct.actualRate)}</span>
								<span class="opacity-70">/{$t('common.minute')}</span>
							</div>
							<div class="mt-1 text-xs opacity-60">
								{@html getProductionDisplayText()}
							</div>
						</div>

						<!-- Total Ingredients -->
						{#if group.totalIngredients && group.totalIngredients.length > 0}
							<div class="rounded bg-base-200 p-3">
								<div class="mb-1 text-xs font-medium opacity-70">
									{$t('productionInstances.total_ingredients')}
								</div>
								<div class="flex flex-col gap-1">
									{#each group.totalIngredients as ingredient (ingredient.item.displayName)}
										<div class="text-xs">
											{@html getIngredientDisplayText(ingredient)}
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Power Consumption -->
						{#if group.totalPowerConsumption > 0}
							<div class="rounded bg-base-200 p-3">
								<div class="mb-1 text-xs font-medium opacity-70">
									⚡ {$t('productionInstances.power_consumption')} (Total)
								</div>
								<div class="font-mono text-sm font-semibold text-warning">
									{formatPower(group.totalPowerConsumption)} MW
								</div>
							</div>
						{/if}
					</div>
				{/if}
			{:else if getInstanceType(group.buildingType) === 'extract'}
				<!-- EXTRACT: Show extraction rate + power consumption -->
				{#if group.primaryProduct}
					<div class="mt-3 grid grid-cols-1 gap-3">
						<!-- Extraction Rate (Aggregated) -->
						<div class="rounded bg-base-200 p-3">
							<div class="mb-1 text-xs font-medium opacity-70">
								⛏️ {$t('productionInstances.extraction_rate')} (Total)
							</div>
							<div class="font-mono text-sm">
								<span class="font-semibold">{formatRate(group.primaryProduct.actualRate)}</span>
								<span class="opacity-70">/{$t('common.minute')}</span>
							</div>
							<div class="mt-1 text-xs opacity-60">
								{@html getProductionDisplayText()}
							</div>
						</div>

						<!-- Power Consumption -->
						{#if group.totalPowerConsumption > 0}
							<div class="rounded bg-base-200 p-3">
								<div class="mb-1 text-xs font-medium opacity-70">
									⚡ {$t('productionInstances.power_consumption')} (Total)
								</div>
								<div class="font-mono text-sm font-semibold text-warning">
									{formatPower(group.totalPowerConsumption)} MW
								</div>
							</div>
						{/if}
					</div>
				{/if}
			{:else if getInstanceType(group.buildingType) === 'power'}
				<!-- POWER: Show power production + fuel consumption -->
				<div class="mt-3 grid grid-cols-1 gap-3">
					<!-- Power Production -->
					{#if group.totalPowerProduction > 0}
						<div class="rounded bg-base-200 p-3">
							<div class="mb-1 text-xs font-medium opacity-70">
								⚡ {$t('productionInstances.power_production')} (Total)
							</div>
							<div class="font-mono text-sm font-semibold text-success">
								{formatPower(group.totalPowerProduction)} MW
							</div>
						</div>
					{/if}

					<!-- Fuel Consumption -->
					{#if group.totalIngredients && group.totalIngredients.length > 0}
						<div class="rounded bg-base-200 p-3">
							<div class="mb-1 text-xs font-medium opacity-70">
								🔥 {$t('productionInstances.fuel_consumption')} (Total)
							</div>
							<div class="flex flex-col gap-1">
								{#each group.totalIngredients as ingredient (ingredient.item.displayName)}
									<div class="text-xs">
										{@html getIngredientDisplayText(ingredient)}
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Building Details -->
			<div class="mt-3 grid grid-cols-2 gap-3">
				<div>
					<div class="text-xs font-medium opacity-70">
						{$t('productionInstances.building_count')} (Total)
					</div>
					<div class="font-mono text-sm font-semibold">
						{formatRate(group.totalBuildingCount)}
					</div>
				</div>
				<div>
					<div class="text-xs font-medium opacity-70">
						{$t('productionInstances.efficiency')} (Moyenne)
					</div>
					<div class="font-mono text-sm font-semibold {utilizationColor()}">
						{Math.round(group.averageEfficiency * 100)}%
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Expandable Individual Instances -->
	{#if isExpanded}
		<div class="border-t border-base-300" transition:slide={{ duration: 300 }}>
			<div class="p-4">
				<h5 class="mb-3 text-sm font-medium opacity-70">Instances individuelles:</h5>
				<div class="space-y-3">
					{#each group.instances as instance (instance.id)}
						<div class="bg-base-50 rounded border border-base-300 p-3">
							<div class="flex items-center justify-between">
								<div class="min-w-0 flex-1">
									<div class="truncate text-sm font-medium">
										{#if instance.recipe?.displayName}
											{instance.recipe.displayName}
										{:else}
											{instance.building?.name || 'Unknown'}
										{/if}
									</div>
									<div class="mt-1 text-xs opacity-70">
										{parseFloat(instance.buildingCount)} {$t('ui.buildings')} •
										{Math.round(parseFloat(instance.efficiencyRatio) * 100)}% {$t('ui.efficiency')}
									</div>
									{#if instance.isBuilt}
										<span class="mt-1 badge badge-xs badge-success">{$t('ui.built')}</span>
									{:else}
										<span class="mt-1 badge badge-xs badge-warning">Non construite</span>
									{/if}
								</div>
								{#if canEdit()}
									<div class="ml-2 flex gap-1">
										<button
											class="btn btn-square btn-ghost btn-xs"
											onclick={() => onEditInstance?.(instance)}
											title={$t('productionInstances.edit_instance')}
										>
											<Icon src={PencilSquare} class="size-3" />
										</button>
										<button
											class="btn btn-square text-error btn-ghost btn-xs hover:bg-error hover:text-error-content"
											onclick={() => onDeleteInstance?.(instance)}
											title={$t('productionInstances.delete_instance')}
										>
											<Icon src={Trash} class="size-3" />
										</button>
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>
