<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	// Redirect to home page since we need to select a game first
	onMount(() => {
		goto('/', { replaceState: true });
	});
</script>

<div class="py-8 text-center">
	<span class="loading loading-lg loading-spinner"></span>
	<p class="mt-4 text-lg opacity-70">Redirecting to home...</p>
</div>