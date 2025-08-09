<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { setAuthState } from '$lib/auth/authState.svelte';
	import { azureB2CConfig } from '$lib/auth/config';
	import { setGameState } from '$lib/game/gameState.svelte';
	import Header from '$lib/components/Header.svelte';

	let { children } = $props();

	// Initialize contexts
	const authState = setAuthState();
	const gameState = setGameState();

	// Initialize MSAL when the app starts
	onMount(async () => {
		try {
			await authState.initializeMsal(azureB2CConfig);
			// Poll until user loaded then fetch games once
			const tryLoad = () => {
				if (authState.isAuthenticated && authState.user?.email) {
					gameState.loadGames(authState.user.email);
				} else {
					setTimeout(tryLoad, 300);
				}
			};
			tryLoad();
		} catch (error) {
			console.error('Failed to initialize authentication:', error);
		}
	});
</script>

<div class="min-h-screen bg-base-200">
	<Header />
	<main class="container mx-auto px-4 py-6">
		{@render children()}
	</main>
</div>
