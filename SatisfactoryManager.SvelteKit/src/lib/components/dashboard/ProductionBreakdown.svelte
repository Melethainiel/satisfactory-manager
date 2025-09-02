<script lang="ts">
	import { Icon, ChevronDown, ChevronRight, Bars3BottomRight } from 'svelte-hero-icons';
	import { t } from '$lib/i18n';
	import type { GameDashboardAggregatedData } from '$lib/states/gameState.svelte';

	let { data }: { data: GameDashboardAggregatedData } = $props();

	type SortField = 'itemName' | 'totalRate' | 'siteCount';
	type SortDirection = 'asc' | 'desc';

	let sortField = $state<SortField>('totalRate');
	let sortDirection = $state<SortDirection>('desc');
	let expandedItems = $state<Set<string>>(new Set());
	let searchTerm = $state('');

	// Combine production and consumption data for comprehensive view
	let combinedItemData = $derived.by(() => {
		const itemMap = new Map<
			string,
			{
				itemId: string;
				itemName: string;
				totalProduction: number;
				totalConsumption: number;
				netBalance: number;
				productionSites: Array<{ siteId: string; siteName: string; rate: number }>;
				consumptionSites: Array<{ siteId: string; siteName: string; rate: number }>;
			}
		>();

		// Add production data
		data.totalProduction.forEach((item) => {
			if (!itemMap.has(item.itemId)) {
				itemMap.set(item.itemId, {
					itemId: item.itemId,
					itemName: item.itemName,
					totalProduction: 0,
					totalConsumption: 0,
					netBalance: 0,
					productionSites: [],
					consumptionSites: []
				});
			}
			const entry = itemMap.get(item.itemId)!;
			entry.totalProduction = item.rate;
			entry.productionSites = item.sites;
		});

		// Add consumption data
		data.totalConsumption.forEach((item) => {
			if (!itemMap.has(item.itemId)) {
				itemMap.set(item.itemId, {
					itemId: item.itemId,
					itemName: item.itemName,
					totalProduction: 0,
					totalConsumption: 0,
					netBalance: 0,
					productionSites: [],
					consumptionSites: []
				});
			}
			const entry = itemMap.get(item.itemId)!;
			entry.totalConsumption = item.rate;
			entry.consumptionSites = item.sites;
		});

		// Add net balance
		data.netBalance.forEach((item) => {
			const entry = itemMap.get(item.itemId);
			if (entry) {
				entry.netBalance = item.balance;
			}
		});

		return Array.from(itemMap.values());
	});

	// Filter and sort items
	let filteredAndSortedItems = $derived.by(() => {
		let filtered = combinedItemData;

		// Apply search filter
		if (searchTerm.trim()) {
			const term = searchTerm.toLowerCase();
			filtered = filtered.filter((item) => item.itemName.toLowerCase().includes(term));
		}

		// Apply sorting
		return filtered.sort((a, b) => {
			let aValue: number | string;
			let bValue: number | string;

			switch (sortField) {
				case 'itemName':
					aValue = a.itemName;
					bValue = b.itemName;
					break;
				case 'totalRate':
					aValue = Math.max(a.totalProduction, a.totalConsumption);
					bValue = Math.max(b.totalProduction, b.totalConsumption);
					break;
				case 'siteCount':
					aValue = new Set([
						...a.productionSites.map((s) => s.siteId),
						...a.consumptionSites.map((s) => s.siteId)
					]).size;
					bValue = new Set([
						...b.productionSites.map((s) => s.siteId),
						...b.consumptionSites.map((s) => s.siteId)
					]).size;
					break;
				default:
					aValue = 0;
					bValue = 0;
			}

			if (typeof aValue === 'string' && typeof bValue === 'string') {
				return sortDirection === 'asc'
					? aValue.localeCompare(bValue)
					: bValue.localeCompare(aValue);
			}

			const numA = Number(aValue);
			const numB = Number(bValue);
			return sortDirection === 'asc' ? numA - numB : numB - numA;
		});
	});

	function handleSort(field: SortField) {
		if (sortField === field) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDirection = field === 'itemName' ? 'asc' : 'desc';
		}
	}

	function toggleExpanded(itemId: string) {
		if (expandedItems.has(itemId)) {
			expandedItems.delete(itemId);
		} else {
			expandedItems.add(itemId);
		}
		expandedItems = new Set(expandedItems);
	}

	function formatRate(rate: number): string {
		if (rate >= 1000) return `${(rate / 1000).toFixed(1)}k`;
		return rate.toFixed(1);
	}

	function getBalanceColor(balance: number): string {
		if (balance > 10) return 'text-success';
		if (balance < -10) return 'text-error';
		if (balance !== 0) return 'text-warning';
		return 'text-base-content';
	}

	function getSortIcon(field: SortField) {
		if (sortField !== field) return '';
		return sortDirection === 'asc' ? '↑' : '↓';
	}
</script>

<div class="card border border-base-300 bg-base-100 shadow-sm">
	<div class="card-body p-6">
		<!-- Header -->
		<div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
			<div class="flex items-center gap-3">
				<Icon src={Bars3BottomRight} class="size-6 text-primary" />
				<div>
					<h2 class="card-title text-xl">{$t('dashboard.production_breakdown.title')}</h2>
					<p class="text-sm text-base-content/70">
						{$t('dashboard.production_breakdown.subtitle')}
					</p>
				</div>
			</div>

			<!-- Search -->
			<div class="form-control max-w-xs">
				<input
					type="text"
					placeholder={$t('dashboard.search_items')}
					class="input-bordered input input-sm"
					bind:value={searchTerm}
				/>
			</div>
		</div>

		<!-- Table -->
		<div class="overflow-x-auto">
			<table class="table table-sm">
				<thead>
					<tr class="border-base-300">
						<th class="w-8"></th>
						<th>
							<button
								class="btn h-auto min-h-0 justify-start p-0 btn-ghost btn-sm"
								onclick={() => handleSort('itemName')}
							>
								{$t('dashboard.item_name')}
								{getSortIcon('itemName')}
							</button>
						</th>
						<th class="text-center">
							<button
								class="btn h-auto min-h-0 justify-center p-0 btn-ghost btn-sm"
								onclick={() => handleSort('totalRate')}
							>
								{$t('dashboard.total_rate')}
								{getSortIcon('totalRate')}
							</button>
						</th>
						<th class="text-center">
							<button
								class="btn h-auto min-h-0 justify-center p-0 btn-ghost btn-sm"
								onclick={() => handleSort('siteCount')}
							>
								{$t('dashboard.sites_count')}
								{getSortIcon('siteCount')}
							</button>
						</th>
						<th class="text-center">{$t('dashboard.balance')}</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredAndSortedItems as item (item.itemId)}
						<tr class="border-base-300">
							<!-- Expand/Collapse -->
							<td>
								{#if item.productionSites.length > 0 || item.consumptionSites.length > 0}
									<button
										class="btn btn-square btn-ghost btn-xs"
										onclick={() => toggleExpanded(item.itemId)}
									>
										{#if expandedItems.has(item.itemId)}
											<Icon src={ChevronDown} class="size-4" />
										{:else}
											<Icon src={ChevronRight} class="size-4" />
										{/if}
									</button>
								{/if}
							</td>

							<!-- Item Name -->
							<td class="font-medium">{item.itemName}</td>

							<!-- Total Rate -->
							<td class="text-center">
								<div class="flex flex-col gap-1">
									{#if item.totalProduction > 0}
										<span class="text-xs text-success">
											+{formatRate(item.totalProduction)}/min
										</span>
									{/if}
									{#if item.totalConsumption > 0}
										<span class="text-xs text-error">
											-{formatRate(item.totalConsumption)}/min
										</span>
									{/if}
								</div>
							</td>

							<!-- Sites Count -->
							<td class="text-center">
								<span class="text-xs">
									{new Set([
										...item.productionSites.map((s) => s.siteId),
										...item.consumptionSites.map((s) => s.siteId)
									]).size}
								</span>
							</td>

							<!-- Balance -->
							<td class="text-center">
								<span class="text-sm font-medium {getBalanceColor(item.netBalance)}">
									{#if item.netBalance > 0}
										+{formatRate(item.netBalance)}
									{:else if item.netBalance < 0}
										{formatRate(item.netBalance)}
									{:else}
										0
									{/if}
								</span>
							</td>
						</tr>

						<!-- Expanded Details -->
						{#if expandedItems.has(item.itemId)}
							<tr class="border-base-300">
								<td colspan="5" class="bg-base-50 p-4">
									<div class="grid gap-4 md:grid-cols-2">
										<!-- Production Sites -->
										{#if item.productionSites.length > 0}
											<div>
												<h4 class="mb-2 font-medium text-success">
													{$t('dashboard.production_sites')} ({item.productionSites.length})
												</h4>
												<div class="space-y-1">
													{#each item.productionSites as site}
														<div
															class="flex items-center justify-between rounded bg-base-100 p-2 text-sm"
														>
															<span>{site.siteName}</span>
															<span class="font-medium">+{formatRate(site.rate)}/min</span>
														</div>
													{/each}
												</div>
											</div>
										{/if}

										<!-- Consumption Sites -->
										{#if item.consumptionSites.length > 0}
											<div>
												<h4 class="mb-2 font-medium text-error">
													{$t('dashboard.consumption_sites')} ({item.consumptionSites.length})
												</h4>
												<div class="space-y-1">
													{#each item.consumptionSites as site}
														<div
															class="flex items-center justify-between rounded bg-base-100 p-2 text-sm"
														>
															<span>{site.siteName}</span>
															<span class="font-medium">-{formatRate(site.rate)}/min</span>
														</div>
													{/each}
												</div>
											</div>
										{/if}
									</div>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>

			{#if filteredAndSortedItems.length === 0}
				<div class="py-8 text-center text-base-content/70">
					{#if searchTerm}
						{$t('dashboard.no_items_found')}
					{:else}
						{$t('dashboard.no_production_data')}
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
