<script lang="ts">
	import { Icon, ArrowPath, Clock } from 'svelte-hero-icons';
	import { t } from '$lib/i18n';
	import { onMount, onDestroy } from 'svelte';

	let {
		gameId,
		isLoading,
		lastUpdated,
		onRefresh
	}: {
		gameId: string;
		isLoading: boolean;
		lastUpdated?: Date;
		onRefresh: () => Promise<void>;
	} = $props();

	let autoRefreshEnabled = $state(false);
	let autoRefreshInterval = $state(300); // 5 minutes default
	let intervalId: number | null = $state(null);

	// Format last updated timestamp
	function formatLastUpdated(): string {
		if (!lastUpdated) return '';

		try {
			const now = new Date();
			const diffMs = now.getTime() - lastUpdated.getTime();
			const diffMinutes = Math.floor(diffMs / 60000);

			if (diffMinutes < 1) return $t('dashboard.last_updated.just_now');
			if (diffMinutes < 60)
				return $t('dashboard.last_updated.minutes_ago', { values: { minutes: diffMinutes } });

			const diffHours = Math.floor(diffMinutes / 60);
			if (diffHours < 24)
				return $t('dashboard.last_updated.hours_ago', { values: { hours: diffHours } });

			return lastUpdated.toLocaleDateString();
		} catch (error) {
			console.error('Error formatting last updated time:', error);
			return '';
		}
	}

	// Auto-refresh management
	function startAutoRefresh() {
		if (intervalId) clearInterval(intervalId);

		intervalId = window.setInterval(async () => {
			if (!isLoading) {
				await onRefresh();
			}
		}, autoRefreshInterval * 1000);
	}

	function stopAutoRefresh() {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	function toggleAutoRefresh() {
		autoRefreshEnabled = !autoRefreshEnabled;

		if (autoRefreshEnabled) {
			startAutoRefresh();
		} else {
			stopAutoRefresh();
		}
	}

	function handleIntervalChange(newInterval: number) {
		autoRefreshInterval = newInterval;

		// Restart with new interval if currently running
		if (autoRefreshEnabled) {
			startAutoRefresh();
		}
	}

	// Handle manual refresh
	async function handleManualRefresh() {
		await onRefresh();
	}

	// Cleanup on destroy
	onDestroy(() => {
		stopAutoRefresh();
	});

	// Auto refresh intervals in seconds
	let intervalOptions = $derived([
		{ value: 60, label: $t('dashboard.auto_refresh.1_minute') },
		{ value: 300, label: $t('dashboard.auto_refresh.5_minutes') },
		{ value: 600, label: $t('dashboard.auto_refresh.10_minutes') },
		{ value: 1800, label: $t('dashboard.auto_refresh.30_minutes') }
	]);
</script>

<div class="flex flex-col items-start gap-3 lg:flex-row lg:items-center">
	<!-- Last Updated Info -->
	{#if lastUpdated}
		<div class="flex items-center gap-2 text-sm text-base-content/70">
			<Icon src={Clock} class="size-4" />
			<span>{formatLastUpdated()}</span>
		</div>
	{/if}

	<!-- Controls -->
	<div class="flex items-center gap-2">
		<!-- Auto Refresh Toggle -->
		<div class="form-control">
			<label class="label cursor-pointer gap-2 p-0">
				<span class="label-text hidden text-xs lg:inline">{$t('dashboard.auto_refresh.label')}</span
				>
				<input
					type="checkbox"
					class="toggle toggle-primary toggle-sm"
					checked={autoRefreshEnabled}
					onchange={toggleAutoRefresh}
				/>
			</label>
		</div>

		<!-- Auto Refresh Interval Selector -->
		{#if autoRefreshEnabled}
			<select
				class="select-bordered select select-sm"
				bind:value={autoRefreshInterval}
				onchange={(e) => handleIntervalChange(Number(e.currentTarget.value))}
			>
				{#each intervalOptions as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		{/if}

		<!-- Manual Refresh Button -->
		<button
			class="btn btn-sm btn-primary"
			onclick={handleManualRefresh}
			disabled={isLoading}
			title={$t('dashboard.refresh_now')}
		>
			<Icon src={ArrowPath} class="size-4 {isLoading ? 'animate-spin' : ''}" />
			<span class="hidden lg:inline">
				{isLoading ? $t('dashboard.refreshing') : $t('dashboard.refresh')}
			</span>
		</button>
	</div>
</div>

<!-- Mobile Auto-refresh Controls -->
<div class="mt-2 lg:hidden">
	{#if autoRefreshEnabled}
		<div class="flex items-center gap-2 text-xs text-base-content/70">
			<span>{$t('dashboard.auto_refresh.enabled')}:</span>
			<select
				class="select-bordered select select-xs"
				bind:value={autoRefreshInterval}
				onchange={(e) => handleIntervalChange(Number(e.currentTarget.value))}
			>
				{#each intervalOptions as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</div>
	{/if}
</div>
