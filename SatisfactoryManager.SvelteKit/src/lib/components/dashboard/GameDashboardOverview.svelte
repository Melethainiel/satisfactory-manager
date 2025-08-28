<script lang="ts">
	import { Icon, BoltSlash, Bolt, CubeTransparent, ChartBar } from 'svelte-hero-icons';
	import { t } from '$lib/i18n';
	import type { GameDashboardData } from '$lib/states/gameState.svelte';

	let { data }: { data: GameDashboardData } = $props();

	// Calculate key metrics for display
	let totalItems = $derived(data.aggregated.uniqueItems);
	let totalSites = $derived(data.sites.length);
	let powerStatus = $derived(() => {
		const balance = data.aggregated.netPowerBalance;
		if (balance > 0) return { status: 'surplus', color: 'text-success' };
		if (balance < -50) return { status: 'critical', color: 'text-error' };
		if (balance < 0) return { status: 'deficit', color: 'text-warning' };
		return { status: 'balanced', color: 'text-info' };
	});

	let efficiencyStatus = $derived(() => {
		const efficiency = data.aggregated.averageEfficiency;
		if (efficiency >= 95) return { status: 'excellent', color: 'text-success' };
		if (efficiency >= 80) return { status: 'good', color: 'text-info' };
		if (efficiency >= 60) return { status: 'fair', color: 'text-warning' };
		return { status: 'poor', color: 'text-error' };
	});

	// Format large numbers
	function formatNumber(num: number): string {
		if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
		if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
		return num.toFixed(0);
	}

	// Format power with units
	function formatPower(mw: number): string {
		if (mw >= 1000) return `${(mw / 1000).toFixed(1)} GW`;
		return `${mw.toFixed(0)} MW`;
	}
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
	<!-- Total Production -->
	<div class="stat rounded-lg border border-base-300 bg-base-100 p-4 shadow-sm">
		<div class="stat-figure text-primary">
			<Icon src={ChartBar} class="size-8" />
		</div>
		<div class="stat-title text-sm">{$t('dashboard.total_production')}</div>
		<div class="stat-value text-2xl text-primary">
			{totalItems}
		</div>
		<div class="stat-desc text-xs">
			{$t('dashboard.unique_items')} • {totalSites}
			{$t('dashboard.sites')}
		</div>
	</div>

	<!-- Power Status -->
	<div class="stat rounded-lg border border-base-300 bg-base-100 p-4 shadow-sm">
		<div class="stat-figure {powerStatus().color}">
			{#if powerStatus().status === 'surplus'}
				<Icon src={Bolt} class="size-8" />
			{:else}
				<Icon src={BoltSlash} class="size-8" />
			{/if}
		</div>
		<div class="stat-title text-sm">{$t('dashboard.power_balance')}</div>
		<div class="stat-value text-2xl {powerStatus().color}">
			{#if data.aggregated.netPowerBalance >= 0}
				+{formatPower(data.aggregated.netPowerBalance)}
			{:else}
				{formatPower(data.aggregated.netPowerBalance)}
			{/if}
		</div>
		<div class="stat-desc text-xs">
			{formatPower(data.aggregated.totalPowerProduction)}
			{$t('dashboard.production_short')} •
			{formatPower(data.aggregated.totalPowerConsumption)}
			{$t('dashboard.consumption_short')}
		</div>
	</div>

	<!-- Efficiency -->
	<div class="stat rounded-lg border border-base-300 bg-base-100 p-4 shadow-sm">
		<div class="stat-figure {efficiencyStatus().color}">
			<div
				class="radial-progress {efficiencyStatus().color}"
				style="--value:{data.aggregated.averageEfficiency};"
			>
				{data.aggregated.averageEfficiency.toFixed(0)}%
			</div>
		</div>
		<div class="stat-title text-sm">{$t('dashboard.efficiency')}</div>
		<div class="stat-value text-2xl {efficiencyStatus().color}">
			{$t(`dashboard.efficiency_status.${efficiencyStatus().status}`)}
		</div>
		<div class="stat-desc text-xs">
			{data.aggregated.totalInstances}
			{$t('dashboard.instances')} •
			{data.aggregated.totalBuildings}
			{$t('dashboard.buildings')}
		</div>
	</div>

	<!-- Factory Status -->
	<div class="stat rounded-lg border border-base-300 bg-base-100 p-4 shadow-sm">
		<div class="stat-figure text-accent">
			<Icon src={CubeTransparent} class="size-8" />
		</div>
		<div class="stat-title text-sm">{$t('dashboard.factory_status')}</div>
		<div class="stat-value text-2xl text-accent">
			{#if data.performance.bottlenecks.length === 0}
				{$t('dashboard.status.optimal')}
			{:else if data.performance.bottlenecks.length <= 3}
				{$t('dashboard.status.minor_issues')}
			{:else}
				{$t('dashboard.status.attention_needed')}
			{/if}
		</div>
		<div class="stat-desc text-xs">
			{#if data.performance.bottlenecks.length > 0}
				{data.performance.bottlenecks.length} {$t('dashboard.bottlenecks')}
			{:else}
				{$t('dashboard.no_bottlenecks')}
			{/if}
		</div>
	</div>
</div>
