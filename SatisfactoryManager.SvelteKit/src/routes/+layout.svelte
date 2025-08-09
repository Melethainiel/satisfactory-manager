<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { setAuthState } from '$lib/auth/authState.svelte';
	import { azureB2CConfig } from '$lib/auth/config';
	import Header from '$lib/components/Header.svelte';

	let { children } = $props();

	// Initialize the auth state context
	const authState = setAuthState();

	// Initialize MSAL when the app starts
	onMount(async () => {
		try {
			await authState.initializeMsal(azureB2CConfig);
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
