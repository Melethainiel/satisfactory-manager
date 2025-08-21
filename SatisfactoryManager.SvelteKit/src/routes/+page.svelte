<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getAuthState } from '$lib/states/authState.svelte';
	import { getGameState } from '$lib/states/gameState.svelte';
	import { Icon, Play, WrenchScrewdriver } from 'svelte-hero-icons';
	import { t } from '$lib/i18n';
	import AuthComponent from '$lib/components/AuthComponent.svelte';
	import CreateGameDialog from '$lib/dialogs/CreateGameDialog.svelte';
	import type { CreateGameDialogHandle } from '$lib/dialogs/CreateGameDialogHandle';

	const authState = getAuthState();
	const gameState = getGameState();

	let createGameDialogRef: CreateGameDialogHandle | null = $state(null);

	onMount(async () => {
		if (authState.isAuthenticated && authState.user?.email) {
			await gameState.loadGames(authState.user.email);
		}
	});

	function handleGameSelect(gameId: string) {
		gameState.selectGame(gameId);
		goto(`/games/${gameId}`);
	}

	// Check if user can access settings (Administrator/Owner only)
	let canAccessSettings = $derived(() => {
		if (!authState.isAuthenticated || !authState.user?.email) return false;
		return gameState.canManageSettings(authState.user.email);
	});
</script>

<svelte:head>
	<title>Satisfactory Manager | {$t('nav.game')}</title>
</svelte:head>

<div class="container mx-auto p-4">
	<h1 class="mb-8 text-3xl font-bold">{$t('app.name')}</h1>

	{#if !authState.isAuthenticated}
		<!-- Authentication Component -->
		<div class="mb-8">
			<h2 class="mb-4 text-2xl font-semibold">{$t('auth.sign_in_required')}</h2>
			<AuthComponent />
		</div>
	{:else if gameState.isLoading}
		<div class="py-8 text-center">
			<span class="loading loading-lg loading-spinner"></span>
			<p class="mt-4 text-lg opacity-70">{$t('common.loading')}</p>
		</div>
	{:else if gameState.games.length === 0}
		<!-- No Games State -->
		<div class="py-12 text-center">
			<h2 class="mb-4 text-2xl font-semibold">{$t('game.no_games')}</h2>
			<p class="mb-6 text-base-content/70">{$t('game.no_games_description')}</p>
			<button class="btn btn-lg btn-primary" onclick={() => createGameDialogRef?.open()}>
				{$t('game.create_new')}
			</button>
		</div>
	{:else}
		<!-- Game Selection -->
		<div class="mb-8">
			<h2 class="mb-6 text-2xl font-semibold">{$t('game.select_game')}</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each gameState.games as game}
					<div class="card bg-base-100 shadow transition-shadow hover:shadow-lg">
						<div class="card-body">
							<h3 class="card-title">{game.name}</h3>
							<p class="text-sm text-base-content/70">
								{$t('game.click_to_open')}
							</p>
							<div class="mt-4 card-actions justify-end">
								<button class="btn btn-primary" onclick={() => handleGameSelect(game.id)}>
									<Icon src={Play} class="size-4" />
									{$t('game.open')}
								</button>
								{#if canAccessSettings()}
									<button
										class="btn btn-ghost btn-sm"
										onclick={() => {
											gameState.selectGame(game.id);
											goto('/settings');
										}}
									>
										<Icon src={WrenchScrewdriver} class="size-4" />
										{$t('nav.settings')}
									</button>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Create New Game -->
		<div class="text-center">
			<button class="btn btn-outline" onclick={() => createGameDialogRef?.open()}>
				{$t('game.create_new')}
			</button>
		</div>
	{/if}
</div>

<CreateGameDialog bind:this={createGameDialogRef} />
