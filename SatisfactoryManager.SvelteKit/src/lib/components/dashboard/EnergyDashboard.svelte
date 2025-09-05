<script lang="ts">
	import { Bolt, Icon } from 'svelte-hero-icons';
	import { t } from '$lib/i18n';
	import type {
		GameDashboardAggregatedData,
		GameDashboardPerformanceData,
		GameDashboardSiteData
	} from '$lib/states/gameState.svelte';

	const {
		sites,
		aggregated,
		performance
	}: {
		sites: GameDashboardSiteData[];
		aggregated: GameDashboardAggregatedData;
		performance: GameDashboardPerformanceData;
	} = $props();

	// Sort sites by power efficiency
	const sortedSitesByEfficiency = $derived.by(() => {
		return performance.powerEfficiencyBySite
			.map((eff) => ({
				...eff,
				site: sites.find((s) => s.siteId === eff.siteId)
			}))
			.filter((item) => item.site)
			.sort((a, b) => b.efficiency - a.efficiency);
	});

	// Sort sites by power consumption
	const sortedSitesByConsumption = $derived.by(() => {
		return [...sites]
			.filter((site) => site.powerConsumption > 0)
			.sort((a, b) => b.powerConsumption - a.powerConsumption);
	});

	// Sort sites by power production
	const sortedSitesByProduction = $derived.by(() => {
		return [...sites]
			.filter((site) => site.powerProduction > 0)
			.sort((a, b) => b.powerProduction - a.powerProduction);
	});

	function formatPower(mw: number): string {
		if (mw >= 1000) return `${(mw / 1000).toFixed(1)} GW`;
		return `${mw.toFixed(0)} MW`;
	}

	function getPowerStatusColor(balance: number): string {
		if (balance > 100) return 'text-success';
		if (balance > 0) return 'text-info';
		if (balance > -100) return 'text-warning';
		return 'text-error';
	}

	function getEfficiencyColor(efficiency: number): string {
		if (efficiency >= 90) return 'text-success';
		if (efficiency >= 70) return 'text-info';
		if (efficiency >= 50) return 'text-warning';
		return 'text-error';
	}

	function getProgressValue(current: number, max: number): number {
		if (max === 0) return 0;
		return Math.min((current / max) * 100, 100);
	}
</script>

<div class="card border border-base-300 bg-base-100 shadow-sm">
	<div class="card-body p-6">
		<!-- Header -->
		<div class="mb-6 flex items-center gap-3">
			<Icon src={Bolt} class="size-6 text-primary" />
			<div>
				<h2 class="card-title text-xl">{$t('dashboard.energy_dashboard.title')}</h2>
				<p class="text-sm text-base-content/70">{$t('dashboard.energy_dashboard.subtitle')}</p>
			</div>
		</div>

		<!-- Overall Power Status -->
		<div class="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
			<div class="bg-base-50 stat rounded-lg p-3 sm:p-4 lg:p-6">
				<div class="stat-figure text-success">
					<Icon src={Bolt} class="size-6" />
				</div>
				<div class="stat-title text-xs">{$t('dashboard.power_production')}</div>
				<div class="stat-value text-lg text-success">
					{formatPower(aggregated.totalPowerProduction)}
				</div>
			</div>

			<div class="bg-base-50 stat rounded-lg p-3 sm:p-4 lg:p-6">
				<div class="stat-figure text-error">
					<Icon src={Bolt} class="size-6" />
				</div>
				<div class="stat-title text-xs">{$t('dashboard.power_consumption')}</div>
				<div class="stat-value text-lg text-error">
					{formatPower(aggregated.totalPowerConsumption)}
				</div>
			</div>

			<div class="bg-base-50 stat rounded-lg p-3 sm:p-4 lg:p-6">
				<div class="stat-figure {getPowerStatusColor(aggregated.netPowerBalance)}">
					<Icon src={Bolt} class="size-6" />
				</div>
				<div class="stat-title text-xs">{$t('dashboard.net_balance')}</div>
				<div class="stat-value text-lg {getPowerStatusColor(aggregated.netPowerBalance)}">
					{#if aggregated.netPowerBalance >= 0}
						+{formatPower(aggregated.netPowerBalance)}
					{:else}
						{formatPower(aggregated.netPowerBalance)}
					{/if}
				</div>
			</div>
		</div>

		<!-- Sites Power Breakdown -->
		<div class="space-y-6">
			<!-- Power Efficiency by Site -->
			{#if sortedSitesByEfficiency.length > 0}
				<div>
					<h3 class="mb-3 font-semibold">{$t('dashboard.power_efficiency_by_site')}</h3>
					<div class="space-y-2">
						{#each sortedSitesByEfficiency.slice(0, 5) as item}
							<div class="bg-base-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 rounded px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
								<div class="flex items-center gap-3">
									<span class="font-medium">{item.siteName}</span>
									<span class="text-xs text-base-content/70">
										{item.site?.instanceCount} instances
									</span>
								</div>
								<div class="flex items-center gap-3">
									<div class="w-32">
										<progress
											class="progress-sm progress progress-primary"
											value={item.efficiency}
											max={100}
										></progress>
									</div>
									<span class="min-w-0 text-sm font-medium {getEfficiencyColor(item.efficiency)}">
										{item.efficiency.toFixed(1)}%
									</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Top Power Consumers -->
			{#if sortedSitesByConsumption.length > 0}
				<div>
					<h3 class="mb-3 font-semibold">{$t('dashboard.top_power_consumers')}</h3>
					<div class="space-y-2">
						{#each sortedSitesByConsumption.slice(0, 5) as site}
							<div class="bg-base-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 rounded px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
								<div class="flex items-center gap-3">
									<span class="font-medium">{site.siteName}</span>
									<span class="text-xs text-base-content/70">
										{site.buildingCount} buildings
									</span>
								</div>
								<div class="flex items-center gap-3">
									<div class="w-24">
										<progress
											class="progress-sm progress progress-error"
											value={getProgressValue(
												site.powerConsumption,
												aggregated.totalPowerConsumption
											)}
											max={100}
										></progress>
									</div>
									<span class="min-w-0 text-sm font-medium text-error">
										{formatPower(site.powerConsumption)}
									</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Top Power Producers -->
			{#if sortedSitesByProduction.length > 0}
				<div>
					<h3 class="mb-3 font-semibold">{$t('dashboard.top_power_producers')}</h3>
					<div class="space-y-2">
						{#each sortedSitesByProduction.slice(0, 5) as site}
							<div class="bg-base-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 rounded px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
								<div class="flex items-center gap-3">
									<span class="font-medium">{site.siteName}</span>
									<span class="text-xs text-base-content/70">
										{site.buildingCount} buildings
									</span>
								</div>
								<div class="flex items-center gap-3">
									<div class="w-24">
										<progress
											class="progress-sm progress progress-success"
											value={getProgressValue(
												site.powerProduction,
												aggregated.totalPowerProduction
											)}
											max={100}
										></progress>
									</div>
									<span class="min-w-0 text-sm font-medium text-success">
										{formatPower(site.powerProduction)}
									</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Empty state -->
			{#if sortedSitesByEfficiency.length === 0 && sortedSitesByConsumption.length === 0 && sortedSitesByProduction.length === 0}
				<div class="py-8 text-center text-base-content/70">
					<Icon src={Bolt} class="mx-auto mb-2 size-12 opacity-50" />
					<p>{$t('dashboard.no_power_data')}</p>
				</div>
			{/if}
		</div>
	</div>
</div>
