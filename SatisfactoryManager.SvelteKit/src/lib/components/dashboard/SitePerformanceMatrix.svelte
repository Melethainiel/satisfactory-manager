<script lang="ts">
	import { Icon, Trophy, ChartBar, Cog6Tooth } from 'svelte-hero-icons';
	import { t } from '$lib/i18n';
	import type {
		GameDashboardSiteData,
		GameDashboardPerformanceData
	} from '$lib/states/gameState.svelte';

	let {
		sites,
		performance
	}: {
		sites: GameDashboardSiteData[];
		performance: GameDashboardPerformanceData;
	} = $props();

	// Combine site data with performance metrics
	let enrichedSites = $derived.by(() => {
		return sites
			.map((site) => {
				const performanceData = performance.topProducingSites.find((p) => p.siteId === site.siteId);
				const efficiencyData = performance.powerEfficiencyBySite.find(
					(e) => e.siteId === site.siteId
				);

				return {
					...site,
					productionScore: performanceData?.productionScore || 0,
					powerEfficiency: efficiencyData?.efficiency || 0,
					rank: performanceData
						? performance.topProducingSites.indexOf(performanceData) + 1
						: sites.length + 1
				};
			})
			.sort((a, b) => a.rank - b.rank);
	});

	function formatRate(rate: number): string {
		if (rate >= 1000) return `${(rate / 1000).toFixed(1)}k`;
		return rate.toFixed(0);
	}

	function formatPower(mw: number): string {
		if (mw >= 1000) return `${(mw / 1000).toFixed(1)} GW`;
		return `${mw.toFixed(0)} MW`;
	}

	function formatProductivity(value: number): string {
		if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
		if (value >= 10) return value.toFixed(1);
		return value.toFixed(2);
	}

	function formatEnergyBalance(balance: number): string {
		const absBalance = Math.abs(balance);
		if (absBalance >= 1000) {
			return `${balance >= 0 ? '+' : ''}${(balance / 1000).toFixed(1)} GW`;
		}
		if (absBalance < 0.1) {
			return '±0 MW';
		}
		return `${balance >= 0 ? '+' : ''}${balance.toFixed(1)} MW`;
	}

	function getEnergyBalanceColor(balance: number): string {
		if (balance > 50) return 'text-success';
		if (balance > 0) return 'text-info';
		if (balance > -50) return 'text-warning';
		return 'text-error';
	}

	function getEfficiencyColor(efficiency: number): string {
		if (efficiency >= 95) return 'text-success';
		if (efficiency >= 80) return 'text-info';
		if (efficiency >= 60) return 'text-warning';
		return 'text-error';
	}

	function getPerformanceColor(score: number): string {
		const maxScore = Math.max(...enrichedSites.map((s) => s.productionScore));
		if (maxScore === 0) return 'text-base-content';

		const ratio = score / maxScore;
		if (ratio >= 0.8) return 'text-success';
		if (ratio >= 0.6) return 'text-info';
		if (ratio >= 0.4) return 'text-warning';
		return 'text-error';
	}

	function getRankBadgeColor(rank: number): string {
		if (rank === 1) return 'badge-warning'; // Gold
		if (rank === 2) return 'badge-neutral'; // Silver
		if (rank === 3) return 'badge-accent'; // Bronze
		return 'badge-outline';
	}

	function getTotalProductionItems(site: GameDashboardSiteData): number {
		return site.totalProduction.length;
	}
</script>

<div class="card border border-base-300 bg-base-100 shadow-sm">
	<div class="card-body p-6">
		<!-- Header -->
		<div class="mb-6 flex items-center gap-3">
			<Icon src={Trophy} class="size-6 text-primary" />
			<div>
				<h2 class="card-title text-xl">{$t('dashboard.site_performance.title')}</h2>
				<p class="text-sm text-base-content/70">{$t('dashboard.site_performance.subtitle')}</p>
			</div>
		</div>

		{#if enrichedSites.length > 0}
			<!-- Performance Table -->
			<div class="overflow-x-auto">
				<table class="table table-sm">
					<thead>
						<tr class="border-base-300">
							<th class="w-16">{$t('dashboard.rank')}</th>
							<th>{$t('dashboard.site_name')}</th>
							<th class="text-center">{$t('dashboard.production_score')}</th>
							<th class="text-center">{$t('dashboard.energy_balance')}</th>
							<th class="text-center">{$t('dashboard.energy_productivity')}</th>
							<th class="text-center">{$t('dashboard.power_balance')}</th>
							<th class="text-center">{$t('dashboard.items_produced')}</th>
							<th class="text-center">{$t('dashboard.instances')}</th>
						</tr>
					</thead>
					<tbody>
						{#each enrichedSites as site, index (site.siteId)}
							<tr class="hover:bg-base-50 border-base-300">
								<!-- Rank -->
								<td>
									<div class="badge {getRankBadgeColor(site.rank)} badge-sm">
										{#if site.rank <= 3}
											<Icon src={Trophy} class="mr-1 size-3" />
										{/if}
										#{site.rank}
									</div>
								</td>

								<!-- Site Name -->
								<td>
									<div class="font-medium">{site.siteName}</div>
									<div class="text-xs text-base-content/70">
										{site.buildingCount}
										{$t('dashboard.buildings')}
									</div>
								</td>

								<!-- Production Score -->
								<td class="text-center">
									<div class="flex flex-col items-center">
										<span class="font-medium {getPerformanceColor(site.productionScore)}">
											{formatRate(site.productionScore)}
										</span>
										<div class="mt-1 w-16">
											<progress
												class="progress-sm progress progress-primary"
												value={site.productionScore}
												max={Math.max(...enrichedSites.map((s) => s.productionScore))}
											></progress>
										</div>
									</div>
								</td>

								<!-- Energy Balance -->
								<td class="text-center">
									<div class="flex flex-col items-center">
										<span
											class="font-medium {getEnergyBalanceColor(
												site.powerProduction - site.powerConsumption
											)}"
										>
											{formatEnergyBalance(site.powerProduction - site.powerConsumption)}
										</span>
										<div class="text-xs text-base-content/70">
											{site.powerProduction - site.powerConsumption >= 0 ? 'surplus' : 'déficit'}
										</div>
									</div>
								</td>

								<!-- Energy Productivity -->
								<td class="text-center">
									<div class="flex flex-col items-center">
										<span class="font-medium text-accent">
											{formatProductivity(site.powerEfficiency)}
										</span>
										<div class="text-xs text-base-content/70">
											{site.powerConsumption > 0 ? 'items/MW' : 'MW'}
										</div>
									</div>
								</td>

								<!-- Power Balance -->
								<td class="text-center">
									<div class="text-xs">
										{#if site.powerProduction > 0}
											<div class="text-success">+{formatPower(site.powerProduction)}</div>
										{/if}
										{#if site.powerConsumption > 0}
											<div class="text-error">-{formatPower(site.powerConsumption)}</div>
										{/if}
										{#if site.powerProduction === 0 && site.powerConsumption === 0}
											<span class="text-base-content/70">-</span>
										{/if}
									</div>
								</td>

								<!-- Items Produced -->
								<td class="text-center">
									<span class="font-medium">{getTotalProductionItems(site)}</span>
								</td>

								<!-- Instances -->
								<td class="text-center">
									<span class="text-sm">{site.instanceCount}</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Performance Insights -->
			{#if performance.topProducingSites.length > 0}
				<div class="bg-base-50 mt-6 rounded-lg p-4">
					<h3 class="mb-2 flex items-center gap-2 font-semibold">
						<Icon src={ChartBar} class="size-4" />
						{$t('dashboard.performance_insights')}
					</h3>
					<div class="space-y-1 text-sm">
						<p>
							<span class="font-medium text-success"
								>{performance.topProducingSites[0].siteName}</span
							>
							{$t('dashboard.is_top_performer')}
							({formatRate(performance.topProducingSites[0].productionScore)}
							{$t('dashboard.production_score')})
						</p>
					</div>
				</div>
			{/if}
		{:else}
			<!-- Empty state -->
			<div class="py-8 text-center text-base-content/70">
				<Icon src={Cog6Tooth} class="mx-auto mb-2 size-12 opacity-50" />
				<p>{$t('dashboard.no_sites_data')}</p>
			</div>
		{/if}
	</div>
</div>
