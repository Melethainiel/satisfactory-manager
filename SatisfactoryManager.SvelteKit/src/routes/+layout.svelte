<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { setAuthState } from '$lib/states/authState.svelte';
	import { azureB2CConfig } from '$lib/auth/config';
	import { setGameState } from '$lib/states/gameState.svelte';
	import { setPermissionState } from '$lib/states/permissionState.svelte';
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

	// Initialize MSAL when the app starts
	onMount(async () => {
		try {
			await authState.initializeMsal(azureB2CConfig);
			// Provide authenticated fetch helper to game state once auth is ready
			gameState.attachAuth(authState.apiFetch);
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
