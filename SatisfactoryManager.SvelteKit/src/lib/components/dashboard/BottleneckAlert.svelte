<script lang="ts">
	import { Icon, ExclamationTriangle, XMark } from 'svelte-hero-icons';
	import { t } from '$lib/i18n';
	import type { GameDashboardPerformanceData } from '$lib/states/gameState.svelte';

	let { bottlenecks }: { bottlenecks: GameDashboardPerformanceData['bottlenecks'] } = $props();

	let dismissed = $state(false);

	function formatDeficit(deficit: number): string {
		if (deficit >= 1000) return `${(deficit / 1000).toFixed(1)}k`;
		return deficit.toFixed(1);
	}

	function getSeverityColor(deficit: number): string {
		if (deficit >= 1000) return 'alert-error';
		if (deficit >= 100) return 'alert-warning';
		return 'alert-info';
	}

	function getSeverityLevel(deficit: number): string {
		if (deficit >= 1000) return $t('dashboard.bottleneck.critical');
		if (deficit >= 100) return $t('dashboard.bottleneck.high');
		return $t('dashboard.bottleneck.moderate');
	}

	// Sort bottlenecks by severity (highest deficit first)
	let sortedBottlenecks = $derived.by(() => {
		return [...bottlenecks].sort((a, b) => b.deficit - a.deficit);
	});

	function dismissAlert() {
		dismissed = true;
	}
</script>

{#if !dismissed && bottlenecks.length > 0}
	<div class="card border border-warning bg-base-100 shadow-sm">
		<div class="card-body p-4">
			<!-- Header -->
			<div class="mb-4 flex items-start justify-between">
				<div class="flex items-center gap-3">
					<Icon src={ExclamationTriangle} class="size-6 flex-shrink-0 text-warning" />
					<div>
						<h2 class="card-title text-lg text-warning">
							{$t('dashboard.bottlenecks_detected')}
						</h2>
						<p class="text-sm text-base-content/70">
							{$t('dashboard.bottlenecks_subtitle', { values: { count: bottlenecks.length } })}
						</p>
					</div>
				</div>
				<button
					class="btn btn-square btn-ghost btn-sm"
					onclick={dismissAlert}
					title={$t('dashboard.dismiss_alert')}
				>
					<Icon src={XMark} class="size-4" />
				</button>
			</div>

			<!-- Bottleneck List -->
			<div class="space-y-3">
				{#each sortedBottlenecks as bottleneck (bottleneck.itemId)}
					<div class="alert {getSeverityColor(bottleneck.deficit)} p-3">
						<div class="flex-1">
							<div class="mb-2 flex items-center justify-between">
								<div class="flex items-center gap-2">
									<span class="font-semibold">{bottleneck.itemName}</span>
									<span class="badge badge-outline badge-sm">
										{getSeverityLevel(bottleneck.deficit)}
									</span>
								</div>
								<span class="text-lg font-bold">
									-{formatDeficit(bottleneck.deficit)}/min
								</span>
							</div>

							<div class="text-sm opacity-90">
								<span class="font-medium">{$t('dashboard.affected_sites')}:</span>
								<span class="ml-1">{bottleneck.sites.join(', ')}</span>
							</div>
						</div>
					</div>
				{/each}
			</div>

			<!-- Action Recommendations -->
			<div class="bg-base-50 mt-4 rounded-lg p-3">
				<h3 class="mb-2 text-sm font-semibold">{$t('dashboard.recommended_actions')}</h3>
				<ul class="space-y-1 text-sm text-base-content/80">
					<li>• {$t('dashboard.action.increase_production')}</li>
					<li>• {$t('dashboard.action.optimize_efficiency')}</li>
					<li>• {$t('dashboard.action.balance_consumption')}</li>
					<li>• {$t('dashboard.action.add_production_sites')}</li>
				</ul>
			</div>
		</div>
	</div>
{/if}
