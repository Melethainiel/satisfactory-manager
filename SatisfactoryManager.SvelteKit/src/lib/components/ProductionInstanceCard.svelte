<script lang="ts">
	import { type ProductionInstanceData, getGameState } from '$lib/states/gameState.svelte';
	import { getAuthState } from '$lib/states/authState.svelte';
	import { CheckBadge, Cog6Tooth, Icon, PencilSquare, Trash } from 'svelte-hero-icons';
	import { t } from '$lib/i18n';

	interface Props {
		instance: ProductionInstanceData;
		onEdit?: (instance: ProductionInstanceData) => void;
		onDelete?: (instance: ProductionInstanceData) => void;
	}

	const { instance, onEdit, onDelete }: Props = $props();

	const gameState = getGameState();
	const authState = getAuthState();

	// Local state for built status animation
	let isTogglingBuilt = $state(false);

	// Check if current user can edit this instance
	const canEdit = $derived(() => {
		if (!authState.isAuthenticated || !authState.user?.email) return false;
		return gameState.canManageSites(authState.user.email);
	});

	// Helper to determine instance type
	function getInstanceType(instance: ProductionInstanceData): 'craft' | 'extract' | 'power' {
		if (instance.building?.type === 'Generator') return 'power';
		if (instance.extractedItemVersionId) return 'extract';
		return 'craft';
	}

	// Get production info from pre-calculated data
	const productionInfo = $derived(() => {
		if (!instance.products || instance.products.length === 0) return null;

		const primaryProduct = instance.products[0];

		return {
			item: primaryProduct.item,
			baseRate: parseFloat(primaryProduct.count), // Base recipe count
			actualRate: primaryProduct.actualRate // Pre-calculated actual rate
		};
	});

	// Calculate efficiency percentage
	const efficiencyPercent = $derived(() => Math.round(parseFloat(instance.efficiencyRatio) * 100));

	// Building utilization color
	const utilizationColor = $derived(() => {
		const percent = efficiencyPercent();
		if (percent >= 100) return 'text-success';
		if (percent >= 75) return 'text-warning';
		return 'text-error';
	});

	// Display name logic: item name + recipe name if exists, or just item/building name for extraction
	const displayName = $derived(() => {
		// If we have products (either from recipe or extraction)
		if (instance.products && instance.products.length > 0) {
			const primaryProduct = instance.products[0];
			const itemName = primaryProduct.item.displayName;

			// If we have a recipe, show "Item (Recipe)"
			if (instance.recipe?.displayName) {
				return `${itemName} (${instance.recipe.displayName})`;
			}

			// For extraction, just show the item name
			return itemName;
		}

		// Fallback: show recipe name or building name
		return instance.recipe?.displayName || instance.building?.name || $t('ui.unknown_production');
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

	// Get inline display text for products with net balance
	function getProductDisplayText(product: {
		item: { displayName: string };
		actualRate: number;
	}): string {
		const itemName = product.item.displayName;
		const productionRate = `${formatRate(product.actualRate)}/${$t('common.minute')}`;
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

	function handleEdit() {
		if (canEdit() && onEdit) {
			onEdit(instance);
		}
	}

	function handleDelete() {
		if (canEdit() && onDelete) {
			onDelete(instance);
		}
	}

	async function handleToggleBuiltStatus() {
		if (!canEdit() || isTogglingBuilt) return;

		isTogglingBuilt = true;
		try {
			// Use optimistic update method - no global loading
			const success = await gameState.updateProductionInstanceBuiltStatus(
				instance.id,
				!instance.isBuilt
			);
			if (!success) {
				console.error('Failed to toggle built status');
			}
		} catch (error) {
			console.error('Error toggling built status:', error);
		} finally {
			isTogglingBuilt = false;
		}
	}
</script>

<div
	class="card-compact card flex h-full flex-col border border-base-300 bg-base-100 shadow-sm transition-shadow hover:shadow-md"
>
	<div class="card-body flex flex-1 flex-col">
		<!-- Header with Recipe Name and Actions -->
		<div class="flex items-start justify-between gap-2">
			<div class="min-w-0 flex-1">
				<h4 class="truncate text-base font-semibold">
					{displayName()}
				</h4>
				<div class="flex items-center gap-2 text-sm opacity-70">
					<Icon src={Cog6Tooth} class="size-4 flex-shrink-0" />
					<span class="truncate">
						{instance.building?.name || $t('ui.unknown_building')}
					</span>
				</div>
				<!-- Built Status Indicator -->
				<div class="mt-1 flex items-center gap-2">
					{#if instance.isBuilt}
						<span class="badge gap-1 badge-sm badge-success">
							<Icon src={CheckBadge} class="size-3" />
							{$t('ui.built')}
						</span>
					{:else}
						<span class="badge badge-sm badge-warning">{$t('ui.not_built')}</span>
					{/if}
					{#if canEdit()}
						<button
							class="btn btn-ghost btn-xs"
							class:loading={isTogglingBuilt}
							onclick={handleToggleBuiltStatus}
							disabled={isTogglingBuilt}
							title={instance.isBuilt ? $t('ui.mark_as_not_built') : $t('ui.mark_as_built')}
						>
							{#if isTogglingBuilt}
								<span class="loading loading-xs loading-spinner"></span>
							{:else}
								{instance.isBuilt ? '❌' : '✅'}
							{/if}
						</button>
					{/if}
				</div>
			</div>

			{#if canEdit()}
				<div class="flex gap-1">
					<button
						class="btn btn-square btn-ghost btn-xs"
						onclick={handleEdit}
						title={$t('productionInstances.edit_instance')}
					>
						<Icon src={PencilSquare} class="size-3" />
					</button>
					<button
						class="btn btn-square text-error btn-ghost btn-xs hover:bg-error hover:text-error-content"
						onclick={handleDelete}
						title={$t('productionInstances.delete_instance')}
					>
						<Icon src={Trash} class="size-3" />
					</button>
				</div>
			{/if}
		</div>

		<!-- Production Information - Different display based on type -->
		<div class="flex flex-1 flex-col justify-start">
			{#if getInstanceType(instance) === 'craft'}
				<!-- CRAFT: Show primary production + ingredients/products totals + power consumption -->
				{#if productionInfo}
					<div class="mt-3 grid grid-cols-1 gap-3">
						<!-- Primary Production -->
						<div class="rounded bg-base-200 p-3">
							<div class="mb-1 text-xs font-medium opacity-70">
								{$t('productionInstances.production_rate')}
							</div>
							<div class="font-mono text-sm">
								<span class="font-semibold">{formatRate(productionInfo()?.actualRate || 0)}</span>
								<span class="opacity-70">/{$t('common.minute')}</span>
							</div>
							<div class="mt-1 text-xs opacity-60">
								{#if productionInfo()}
									{@html getProductDisplayText({
										item: productionInfo()!.item,
										actualRate: productionInfo()!.actualRate
									})}
								{/if}
							</div>
						</div>

						<!-- Total Ingredients -->
						{#if instance.ingredients && instance.ingredients.length > 0}
							<div class="rounded bg-base-200 p-3">
								<div class="mb-1 text-xs font-medium opacity-70">
									{$t('productionInstances.total_ingredients')}
								</div>
								<div class="flex flex-col gap-1">
									{#each instance.ingredients as ingredient (ingredient.item.className)}
										<div class="text-xs">
											{@html getIngredientDisplayText(ingredient)}
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Total Products (if multiple) -->
						{#if instance.products && instance.products.length > 1}
							<div class="rounded bg-base-200 p-3">
								<div class="mb-1 text-xs font-medium opacity-70">
									{$t('productionInstances.total_products')}
								</div>
								<div class="flex flex-col gap-1">
									{#each instance.products as product (product.item.className)}
										<div class="text-xs">
											{@html getProductDisplayText(product)}
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Power Consumption -->
						{#if instance.production.powerConsumption > 0}
							<div class="rounded bg-base-200 p-3">
								<div class="mb-1 text-xs font-medium opacity-70">
									⚡ {$t('productionInstances.power_consumption')}
								</div>
								<div class="font-mono text-sm font-semibold text-warning">
									{formatPower(instance.production.powerConsumption)} MW
								</div>
							</div>
						{/if}

						<!-- Building Details -->
						<div class="grid grid-cols-2 gap-3">
							<div>
								<div class="text-xs font-medium opacity-70">
									{$t('productionInstances.building_count')}
								</div>
								<div class="font-mono text-sm font-semibold">
									{parseFloat(instance.buildingCount)}
								</div>
							</div>
							<div>
								<div class="text-xs font-medium opacity-70">
									{$t('productionInstances.efficiency')}
								</div>
								<div class="font-mono text-sm font-semibold {utilizationColor()}">
									{efficiencyPercent()}%
								</div>
							</div>
						</div>
					</div>
				{/if}
			{:else if getInstanceType(instance) === 'extract'}
				<!-- EXTRACT: Show extraction rate + power consumption -->
				{#if productionInfo}
					<div class="mt-3 grid grid-cols-1 gap-3">
						<!-- Extraction Rate -->
						<div class="rounded bg-base-200 p-3">
							<div class="mb-1 text-xs font-medium opacity-70">
								⛏️ {$t('productionInstances.extraction_rate')}
							</div>
							<div class="font-mono text-sm">
								<span class="font-semibold">{formatRate(productionInfo()?.actualRate || 0)}</span>
								<span class="opacity-70">/{$t('common.minute')}</span>
							</div>
							<div class="mt-1 text-xs opacity-60">
								{#if productionInfo()}
									{@html getProductDisplayText({
										item: productionInfo()!.item,
										actualRate: productionInfo()!.actualRate
									})}
								{/if}
								{#if instance.extractorPurity}
									<span
										class="ml-2 rounded bg-primary/20 px-1 py-0.5 text-xs font-medium text-primary"
									>
										{$t(`production.purity_${instance.extractorPurity.toLowerCase()}`)}
									</span>
								{/if}
							</div>
						</div>

						<!-- Power Consumption -->
						{#if instance.production.powerConsumption > 0}
							<div class="rounded bg-base-200 p-3">
								<div class="mb-1 text-xs font-medium opacity-70">
									⚡ {$t('productionInstances.power_consumption')}
								</div>
								<div class="font-mono text-sm font-semibold text-warning">
									{formatPower(instance.production.powerConsumption)} MW
								</div>
							</div>
						{/if}

						<!-- Building Details -->
						<div class="grid grid-cols-2 gap-3">
							<div>
								<div class="text-xs font-medium opacity-70">
									{$t('productionInstances.building_count')}
								</div>
								<div class="font-mono text-sm font-semibold">
									{parseFloat(instance.buildingCount)}
								</div>
							</div>
							<div>
								<div class="text-xs font-medium opacity-70">
									{$t('productionInstances.efficiency')}
								</div>
								<div class="font-mono text-sm font-semibold {utilizationColor()}">
									{efficiencyPercent()}%
								</div>
							</div>
						</div>
					</div>
				{/if}
			{:else if getInstanceType(instance) === 'power'}
				<!-- POWER: Show power production + fuel consumption -->
				<div class="mt-3 grid grid-cols-1 gap-3">
					<!-- Power Production -->
					{#if instance.production.powerProduction > 0}
						<div class="rounded bg-base-200 p-3">
							<div class="mb-1 text-xs font-medium opacity-70">
								⚡ {$t('productionInstances.power_production')}
							</div>
							<div class="font-mono text-sm font-semibold text-success">
								{formatPower(instance.production.powerProduction)} MW
							</div>
						</div>
					{/if}

					<!-- Fuel Consumption -->
					{#if instance.ingredients && instance.ingredients.length > 0}
						<div class="rounded bg-base-200 p-3">
							<div class="mb-1 text-xs font-medium opacity-70">
								🔥 {$t('productionInstances.fuel_consumption')}
							</div>
							<div class="flex flex-col gap-1">
								{#each instance.ingredients as ingredient (ingredient.item.className)}
									<div class="text-xs">
										{@html getIngredientDisplayText(ingredient)}
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Building Details -->
					<div class="grid grid-cols-2 gap-3">
						<div>
							<div class="text-xs font-medium opacity-70">
								{$t('productionInstances.building_count')}
							</div>
							<div class="font-mono text-sm font-semibold">
								{parseFloat(instance.buildingCount)}
							</div>
						</div>
						<div>
							<div class="text-xs font-medium opacity-70">
								{$t('productionInstances.efficiency')}
							</div>
							<div class="font-mono text-sm font-semibold {utilizationColor()}">
								{efficiencyPercent()}%
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- Notes -->
			{#if instance.notes}
				<div class="mt-3 border-t border-base-300 pt-3">
					<div class="mb-1 text-xs font-medium opacity-70">
						{$t('productionInstances.notes')}
					</div>
					<div class="text-sm break-words opacity-80">
						{instance.notes}
					</div>
				</div>
			{/if}
		</div>

		<!-- Timestamp -->
		<div class="mt-3 border-t border-base-300 pt-3">
			<div class="text-xs opacity-50">
				{$t('common.created')}: {instance.createdAt.toLocaleDateString()}
			</div>
		</div>
	</div>
</div>
