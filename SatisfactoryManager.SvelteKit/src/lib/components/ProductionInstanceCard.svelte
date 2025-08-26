<script lang="ts">
	import { getGameState, type ProductionInstanceData } from '$lib/states/gameState.svelte';
	import { getAuthState } from '$lib/states/authState.svelte';
	import { Icon, PencilSquare, Trash, Cog6Tooth } from 'svelte-hero-icons';
	import { t } from '$lib/i18n';

	interface Props {
		instance: ProductionInstanceData;
		onEdit?: (instance: ProductionInstanceData) => void;
		onDelete?: (instance: ProductionInstanceData) => void;
	}

	let { instance, onEdit, onDelete }: Props = $props();

	const gameState = getGameState();
	const authState = getAuthState();

	// Check if current user can edit this instance
	let canEdit = $derived(() => {
		if (!authState.isAuthenticated || !authState.user?.email) return false;
		return gameState.canManageSites(authState.user.email);
	});

	// Helper to determine instance type
	function getInstanceType(instance: ProductionInstanceData): 'craft' | 'extract' | 'power' {
		if (instance.building?.type === 'Generator') return 'power';
		if (instance.extractedItemId) return 'extract';
		return 'craft';
	}

	// Get production info from pre-calculated data
	let productionInfo = $derived(() => {
		if (!instance.products || instance.products.length === 0) return null;

		const primaryProduct = instance.products[0];

		return {
			item: primaryProduct.item,
			baseRate: parseFloat(primaryProduct.count), // Base recipe count
			actualRate: primaryProduct.actualRate // Pre-calculated actual rate
		};
	});

	// Calculate efficiency percentage
	let efficiencyPercent = $derived(() => Math.round(parseFloat(instance.efficiencyRatio) * 100));

	// Building utilization color
	let utilizationColor = $derived(() => {
		const percent = efficiencyPercent();
		if (percent >= 100) return 'text-success';
		if (percent >= 75) return 'text-warning';
		return 'text-error';
	});

	// Display name logic: item name + recipe name if exists, or just item/building name for extraction
	let displayName = $derived(() => {
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
		return instance.recipe?.displayName || instance.building?.name || 'Unknown Production';
	});

	function formatRate(rate: number): string {
		return rate < 10 ? rate.toFixed(2) : rate.toFixed(1);
	}

	function formatPower(power: number): string {
		return power < 100 ? power.toFixed(1) : power.toFixed(0);
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
</script>

<div
	class="card-compact card border border-base-300 bg-base-100 shadow-sm transition-shadow hover:shadow-md"
>
	<div class="card-body">
		<!-- Header with Recipe Name and Actions -->
		<div class="flex items-start justify-between gap-2">
			<div class="min-w-0 flex-1">
				<h4 class="truncate text-base font-semibold">
					{displayName()}
				</h4>
				<div class="flex items-center gap-2 text-sm opacity-70">
					<Icon src={Cog6Tooth} class="size-4 flex-shrink-0" />
					<span class="truncate">
						{instance.building?.name || 'Unknown Building'}
					</span>
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
							{productionInfo()?.item.displayName || 'Unknown'}
						</div>
					</div>

					<!-- Total Ingredients -->
					{#if instance.ingredients && instance.ingredients.length > 0}
						<div class="rounded bg-base-200 p-3">
							<div class="mb-1 text-xs font-medium opacity-70">
								{$t('productionInstances.total_ingredients')}
							</div>
							<div class="flex flex-col gap-1">
								{#each instance.ingredients as ingredient}
									<div class="flex justify-between text-xs">
										<span>{ingredient.item.displayName}</span>
										<span class="font-mono font-semibold">
											{formatRate(ingredient.actualRate)}/{$t('common.minute')}
										</span>
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
								{#each instance.products as product}
									<div class="flex justify-between text-xs">
										<span>{product.item.displayName}</span>
										<span class="font-mono font-semibold">
											{formatRate(product.actualRate)}/{$t('common.minute')}
										</span>
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
							{productionInfo()?.item.displayName || 'Unknown'}
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
							{#each instance.ingredients as ingredient}
								<div class="flex justify-between text-xs">
									<span>{ingredient.item.displayName}</span>
									<span class="font-mono font-semibold">
										{formatRate(ingredient.actualRate)}/{$t('common.minute')}
									</span>
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

		<!-- Timestamp -->
		<div class="mt-3 border-t border-base-300 pt-3">
			<div class="text-xs opacity-50">
				{$t('common.created')}: {instance.createdAt.toLocaleDateString()}
			</div>
		</div>
	</div>
</div>
