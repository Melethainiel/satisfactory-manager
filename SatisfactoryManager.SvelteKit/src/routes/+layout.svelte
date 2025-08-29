<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { setAuthState } from '$lib/states/authState.svelte';
	import { getClientAzureB2CConfig, CLIENT_AUTH_SCOPES } from '$lib/config/auth.config.client';
	import { setGameState } from '$lib/states/gameState.svelte';
	import { setPermissionState } from '$lib/states/permissionState.svelte';
	import { getRealtimeService } from '$lib/services/realtimeService.svelte';
	import Header from '$lib/components/Header.svelte';
	import SideNav from '$lib/components/SideNav.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';

	let navOpen = $state(false);
	function toggleNav() {
		navOpen = !navOpen;
	}

	let { children } = $props();

	// Initialize contexts
	const authState = setAuthState();
	const gameState = setGameState();
	const permissionState = setPermissionState(authState, gameState);
	const realtimeService = getRealtimeService();

	// Initialize MSAL when the app starts
	onMount(async () => {
		try {
			const azureConfig = await getClientAzureB2CConfig();
			const configWithScopes = {
				...azureConfig,
				scopes: [
					...CLIENT_AUTH_SCOPES.DEFAULT,
					'https://SatisfactoryManager.onmicrosoft.com/71d43619-ad3d-49d4-bae9-97e38ec57dc4/access_users'
				]
			};
			await authState.initializeMsal(configWithScopes);
			// Provide authenticated fetch helper to game state once auth is ready
			gameState.attachAuth(authState.apiFetch);
			// Initialize real-time service
			gameState.attachRealtime(realtimeService);
			realtimeService.initialize(authState, gameState);
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

	// Watch for auth state changes and handle real-time connections
	$effect(() => {
		realtimeService.handleAuthStateChange(authState.isAuthenticated);
	});

	// Watch for game selection changes
	$effect(() => {
		realtimeService.handleGameChange(gameState.selectedGameId);
	});

	// Watch for site selection changes
	$effect(() => {
		realtimeService.handleSiteChange(gameState.selectedGameId, gameState.selectedSiteId);
	});
</script>

<div class="flex min-h-screen bg-base-200">
	<SideNav open={navOpen} onClose={() => (navOpen = false)} />

	<div class="flex flex-1 flex-col">
		<Header {toggleNav} />
		<main class="flex-1 px-4 py-6 lg:ml-64">
			<div class="container mx-auto">
				{@render children()}
			</div>
		</main>
	</div>
</div>

<!-- Global toast notifications -->
<ToastContainer />

<!-- No component styles needed -->
