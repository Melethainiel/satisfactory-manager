<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getGameState } from '$lib/states/gameState.svelte';
	import { getAuthState } from '$lib/states/authState.svelte';
	import { t } from '$lib/i18n';
	import SiteTabsContainer from '$lib/components/SiteTabsContainer.svelte';

	const gameState = getGameState();
	const authState = getAuthState();

	let isLoading = $state(true);
	let error = $state<string | null>(null);

	// Get the game ID from the route parameters
	const gameId = page.params.id;

	// Get siteId from URL search parameters
	let siteIdFromUrl = $derived(page.url.searchParams.get('siteId'));

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
			isLoading = false;
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
						isLoading = false;
						return;
					}
				}
				gameState.selectGame(gameId);
			}

			// Load game data in parallel
			await Promise.all([gameState.loadGameUsers(gameId), gameState.loadGameSites(gameId)]);

			// Set selected site from URL parameter if provided and valid
			if (siteIdFromUrl) {
				const siteExists = gameState.gameSites.some((site) => site.id === siteIdFromUrl);
				if (siteExists) {
					gameState.selectSite(siteIdFromUrl, false); // false to avoid updating URL again
				}
			}
		} catch (e: any) {
			console.error('Error loading game:', e);
			error = e?.message ?? $t('game.load_error');
		} finally {
			isLoading = false;
		}
	});

	// Get current game info
	let currentGame = $derived(gameState.games.find((g) => g.id === gameId));
</script>

<svelte:head>
	<title>Satisfactory Manager | {currentGame?.name ?? $t('game.loading')}</title>
</svelte:head>

{#if !authState.isAuthenticated}
	<div class="py-8 text-center">
		<p class="text-lg opacity-70">{$t('auth.sign_in_required')}</p>
	</div>
{:else if isLoading}
	<div class="py-8 text-center">
		<span class="loading loading-lg loading-spinner"></span>
		<p class="mt-4 text-lg opacity-70">{$t('game.loading')}</p>
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
{:else}
	<div class="container mx-auto">
		<!-- Game Header -->
		<div class="mb-6">
			<h1 class="text-3xl font-bold">{currentGame.name}</h1>
			<p class="mt-2 text-base-content/70">{$t('game.manage_description')}</p>
		</div>

		<!-- Site Management -->
		<SiteTabsContainer />
	</div>
{/if}
