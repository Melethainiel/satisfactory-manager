<script lang="ts">
	import AuthComponent from '$lib/components/AuthComponent.svelte';
	import { authState } from '$lib';
	import { onMount } from 'svelte';

	let apiResponse = '';
	let isLoadingApi = false;

	// Example function to test authenticated API call
	async function testApiCall() {
		if (!$authState.isAuthenticated) {
			apiResponse = 'Please sign in first';
			return;
		}

		isLoadingApi = true;
		apiResponse = '';

		// try {
		// 	// Example API call - replace with your actual API endpoint
		// 	const response = await apiClient.get('/api/test');
			
		// 	if (response.error) {
		// 		apiResponse = `API Error: ${response.error}`;
		// 	} else {
		// 		apiResponse = `API Success: ${JSON.stringify(response.data, null, 2)}`;
		// 	}
		// } catch (error) {
		// 	apiResponse = `Network Error: ${error}`;
		// } finally {
			isLoadingApi = false;
		// }
	}
</script>

<svelte:head>
	<title>Azure B2C Authentication Demo</title>
</svelte:head>

<div class="container mx-auto p-4">
	<h1 class="text-3xl font-bold mb-8">Azure AD B2C Authentication Demo</h1>
	
	<!-- Authentication Component -->
	<div class="mb-8">
		<h2 class="text-2xl font-semibold mb-4">Authentication Status</h2>
		<AuthComponent />
	</div>

	<!-- API Testing Section -->
	{#if $authState.isAuthenticated}
		<div class="mb-8">
			<h2 class="text-2xl font-semibold mb-4">API Testing</h2>
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h3 class="card-title">Test Authenticated API Call</h3>
					<p>This demonstrates making an API call with the access token automatically attached.</p>
					
					<div class="card-actions">
						<button 
							class="btn btn-secondary" 
							class:loading={isLoadingApi}
							disabled={isLoadingApi}
							on:click={testApiCall}
						>
							{isLoadingApi ? 'Testing...' : 'Test API Call'}
						</button>
					</div>

					{#if apiResponse}
						<div class="mt-4">
							<h4 class="font-semibold">API Response:</h4>
							<pre class="bg-base-200 p-4 rounded mt-2 overflow-x-auto text-sm">{apiResponse}</pre>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Debug Information -->
	{#if $authState.isAuthenticated}
		<div class="mb-8">
			<h2 class="text-2xl font-semibold mb-4">Debug Information</h2>
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h3 class="card-title">Current Auth State</h3>
					<pre class="bg-base-200 p-4 rounded overflow-x-auto text-sm">{JSON.stringify($authState, null, 2)}</pre>
				</div>
			</div>
		</div>
	{/if}

	<!-- Setup Instructions -->
	<div class="mb-8">
		<h2 class="text-2xl font-semibold mb-4">Setup Instructions</h2>
		<div class="alert alert-info">
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
			</svg>
			<div>
				<h3 class="font-bold">Configuration Required</h3>
				<p>To use this authentication demo, you need to:</p>
				<ol class="list-decimal list-inside mt-2">
					<li>Set up an Azure AD B2C tenant</li>
					<li>Register your application</li>
					<li>Update the configuration in <code>src/lib/auth/config.ts</code></li>
					<li>Set environment variables in <code>.env.local</code></li>
				</ol>
				<p class="mt-2">See <code>src/lib/auth/README.md</code> for detailed instructions.</p>
			</div>
		</div>
	</div>
</div>
