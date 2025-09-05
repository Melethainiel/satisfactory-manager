<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getGameState } from '$lib/states/gameState.svelte';
	import { getAuthState } from '$lib/states/authState.svelte';
	import { t } from '$lib/i18n';
	import { ArrowPath, ChartBarSquare, Icon } from 'svelte-hero-icons';
	import GameDashboardOverview from '$lib/components/dashboard/GameDashboardOverview.svelte';
	import ProductionBreakdown from '$lib/components/dashboard/ProductionBreakdown.svelte';
	import EnergyDashboard from '$lib/components/dashboard/EnergyDashboard.svelte';
	import SitePerformanceMatrix from '$lib/components/dashboard/SitePerformanceMatrix.svelte';
	import BottleneckAlert from '$lib/components/dashboard/BottleneckAlert.svelte';
	import DashboardControls from '$lib/components/dashboard/DashboardControls.svelte';

	const gameState = getGameState();
	const authState = getAuthState();

	let isInitialLoading = $state(true);
	let error = $state<string | null>(null);

	// Get the game ID from the route parameters
	const gameId = $page.params.id!;

	// Get current game info
	const currentGame = $derived(gameState.games.find((g) => g.id === gameId));

	// Check if user has read access
	const hasReadAccess = $derived(() => {
		if (!authState.isAuthenticated || !authState.user?.email) return false;
		const userRole = gameState.getUserRole(authState.user.email);
		return ['Reader', 'Contributor', 'Administrator', 'Owner'].includes(userRole || '');
	});

	onMount(async () => {
		// Wait for authentication to finish loading before checking auth state
		while (authState.isLoading) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		if (!authState.isAuthenticated) {
			await goto('/');
			return;
		}

		if (!gameId) {
			error = $t('game.invalid_game_id');
			isInitialLoading = false;
			return;
		}

		try {
			// Select the current game if it's not already selected
			if (gameState.selectedGameId !== gameId) {
				// Check if the game exists in our loaded games
				const game = gameState.games.find((g) => g.id === gameId);
				if (!game) {
					// If game not found, reload games
					await gameState.loadGames(authState.user?.email ?? '');
					const gameAfterReload = gameState.games.find((g) => g.id === gameId);
					if (!gameAfterReload) {
						error = $t('game.not_found');
						isInitialLoading = false;
						return;
					}
				}
				gameState.selectGame(gameId);
			}

			// Load game users for permissions check and dashboard data
			await Promise.all([gameState.loadGameUsers(gameId), gameState.loadGameDashboard(gameId)]);

			// Check permissions after loading users
			if (!hasReadAccess()) {
				error = $t('dashboard.access_denied');
				isInitialLoading = false;
				return;
			}
		} catch (e: any) {
			console.error('Error loading dashboard:', e);
			error = e?.message ?? $t('dashboard.load_error');
		} finally {
			isInitialLoading = false;
		}
	});

	async function handleRefresh() {
		if (!gameId) return;
		try {
			await gameState.refreshGameDashboard(gameId);
		} catch (e: any) {
			// Error handling is managed in gameState
		}
	}
</script>

<svelte:head>
	<title
		>Satisfactory Manager | {currentGame?.name ?? $t('game.loading')} - {$t(
			'dashboard.title'
		)}</title
	>
</svelte:head>

{#if !authState.isAuthenticated}
	<div class="py-8 text-center">
		<p class="text-lg opacity-70">{$t('auth.sign_in_required')}</p>
	</div>
{:else if isInitialLoading}
	<div class="py-8 text-center">
		<span class="loading loading-lg loading-spinner"></span>
		<p class="mt-4 text-lg opacity-70">{$t('dashboard.loading')}</p>
	</div>
{:else if error}
	<div class="py-8 text-center">
		<div class="mx-auto alert max-w-md alert-error">
			<span>{error}</span>
		</div>
		<button class="btn mt-4 btn-primary" onclick={() => goto('/')}>
			{$t('nav.back_to_home')}
		</button>
	</div>
{:else if !currentGame}
	<div class="py-8 text-center">
		<p class="text-lg opacity-70">{$t('game.not_found')}</p>
		<button class="btn mt-4 btn-primary" onclick={() => goto('/')}>
			{$t('nav.back_to_home')}
		</button>
	</div>
{:else if !hasReadAccess()}
	<div class="py-8 text-center">
		<div class="mx-auto alert max-w-md alert-warning">
			<span>{$t('dashboard.access_denied')}</span>
		</div>
		<button class="btn mt-4 btn-primary" onclick={() => goto(`/games/${gameId}`)}>
			{$t('nav.back_to_game')}
		</button>
	</div>
{:else}
	<div class="container mx-auto space-y-6 px-4 py-6">
		<!-- Dashboard Header -->
		<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
			<div class="flex items-center gap-3">
				<Icon src={ChartBarSquare} class="size-8 text-primary" />
				<div>
					<h1 class="text-2xl font-bold lg:text-3xl">{currentGame.name}</h1>
					<p class="text-sm text-base-content/70 lg:text-base">{$t('dashboard.subtitle')}</p>
				</div>
			</div>

			<!-- Dashboard Controls -->
			<div class="flex-shrink-0">
				<DashboardControls
					{gameId}
					isLoading={gameState.isDashboardLoading}
					lastUpdated={gameState.gameDashboard?.lastUpdated}
					onRefresh={handleRefresh}
				/>
			</div>
		</div>

		<!-- Loading overlay for refresh -->
		{#if gameState.isDashboardLoading && gameState.gameDashboard}
			<div class="fixed inset-0 z-50 flex items-center justify-center bg-base-content/5">
				<div class="flex items-center gap-3 rounded-lg bg-base-100 p-6 shadow-lg">
					<span class="loading loading-md loading-spinner"></span>
					<span class="text-lg">{$t('dashboard.refreshing')}</span>
				</div>
			</div>
		{/if}

		<!-- Dashboard Content -->
		{#if gameState.dashboardError && !gameState.gameDashboard}
			<!-- Error state when no data -->
			<div class="py-12 text-center">
				<div class="mx-auto alert max-w-lg alert-error">
					<span>{gameState.dashboardError}</span>
				</div>
				<button
					class="btn mt-4 btn-primary"
					onclick={handleRefresh}
					disabled={gameState.isDashboardLoading}
				>
					<Icon src={ArrowPath} class="size-4" />
					{$t('dashboard.retry')}
				</button>
			</div>
		{:else if gameState.gameDashboard}
			<!-- Dashboard content when data is available -->
			<div class="space-y-6">
				<!-- Overview Cards -->
				<GameDashboardOverview data={gameState.gameDashboard} />

				<!-- Bottleneck Alerts (show at top if any exist) -->
				{#if gameState.gameDashboard.performance.bottlenecks.length > 0}
					<BottleneckAlert bottlenecks={gameState.gameDashboard.performance.bottlenecks} />
				{/if}

				<!-- Main Dashboard Grid -->
				<div class="grid gap-6">
					<!-- Production Breakdown - Primary Feature -->
					<div class="col-span-full">
						<ProductionBreakdown data={gameState.gameDashboard.aggregated} />
					</div>

					<!-- Two-column layout for desktop, stacked for mobile -->
					<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
						<!-- Energy Dashboard -->
						<EnergyDashboard
							sites={gameState.gameDashboard.sites}
							aggregated={gameState.gameDashboard.aggregated}
							performance={gameState.gameDashboard.performance}
						/>

						<!-- Site Performance Matrix -->
						<SitePerformanceMatrix
							sites={gameState.gameDashboard.sites}
							performance={gameState.gameDashboard.performance}
						/>
					</div>
				</div>
			</div>
		{:else}
			<!-- Loading state -->
			<div class="grid gap-6">
				<!-- Loading skeletons -->
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					{#each Array(4) as _}
						<div class="card bg-base-100 shadow-sm">
							<div class="card-body">
								<div class="mb-2 h-4 w-20 skeleton"></div>
								<div class="h-8 w-24 skeleton"></div>
							</div>
						</div>
					{/each}
				</div>

				<div class="card bg-base-100 shadow-sm">
					<div class="card-body">
						<div class="mb-4 h-6 w-32 skeleton"></div>
						<div class="space-y-2">
							{#each Array(5) as _}
								<div class="h-12 w-full skeleton"></div>
							{/each}
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}
