<script lang="ts">
	import AuthComponent from '$lib/components/AuthComponent.svelte';
	import { getAuthState } from '$lib/states/authState.svelte';

	// Get the auth state from context
	const authState = getAuthState();

	let apiResponse = '';
	let isLoadingApi = false;

	// Example function to test authenticated API call
	async function testApiCall() {
		if (!authState.isAuthenticated) {
			apiResponse = 'Please sign in first';
			return;
		}

		isLoadingApi = true;
		apiResponse = '';

		try {
			// Get access token for API call
			const token = await authState.getApiAccessToken();
			if (!token) {
				apiResponse = 'Failed to get access token';
				return;
			}

			// Example API call - replace with your actual API endpoint
			const response = await fetch('/api/test', {
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json'
				}
			});

			if (response.ok) {
				const data = await response.json();
				apiResponse = `API Success: ${JSON.stringify(data, null, 2)}`;
			} else {
				apiResponse = `API Error: ${response.status} ${response.statusText}`;
			}
		} catch (error) {
			apiResponse = `Network Error: ${error}`;
		} finally {
			isLoadingApi = false;
		}
	}
</script>

<svelte:head>
	<title>Azure B2C Authentication Demo</title>
</svelte:head>

<div class="container mx-auto p-4">
	<h1 class="mb-8 text-3xl font-bold">Azure AD B2C Authentication Demo</h1>

	<!-- Authentication Component -->
	<div class="mb-8">
		<h2 class="mb-4 text-2xl font-semibold">Authentication Status</h2>
		<AuthComponent />
	</div>

	<!-- API Testing Section -->
	{#if authState.isAuthenticated}
		<div class="mb-8">
			<h2 class="mb-4 text-2xl font-semibold">API Testing</h2>
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h3 class="card-title">Test Authenticated API Call</h3>
					<p>This demonstrates making an API call with the access token automatically attached.</p>

					<div class="card-actions">
						<button
							class="btn btn-secondary"
							class:loading={isLoadingApi}
							disabled={isLoadingApi}
							onclick={testApiCall}
						>
							{isLoadingApi ? 'Testing...' : 'Test API Call'}
						</button>
					</div>

					{#if apiResponse}
						<div class="mt-4">
							<h4 class="font-semibold">API Response:</h4>
							<pre class="mt-2 overflow-x-auto rounded bg-base-200 p-4 text-sm">{apiResponse}</pre>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Debug Information -->
	{#if authState.isAuthenticated}
		<div class="mb-8">
			<h2 class="mb-4 text-2xl font-semibold">Debug Information</h2>
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h3 class="card-title">Current Auth State</h3>
					<pre class="overflow-x-auto rounded bg-base-200 p-4 text-sm">{JSON.stringify(
							{
								isAuthenticated: authState.isAuthenticated,
								isLoading: authState.isLoading,
								user: authState.user,
								error: authState.error
							},
							null,
							2
						)}</pre>
				</div>
			</div>
		</div>
	{/if}

	<!-- Setup Instructions -->
	<div class="mb-8">
		<h2 class="mb-4 text-2xl font-semibold">Setup Instructions</h2>
		<div class="alert alert-info">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				class="h-6 w-6 shrink-0 stroke-current"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				></path>
			</svg>
			<div>
				<h3 class="font-bold">Configuration Required</h3>
				<p>To use this authentication demo, you need to:</p>
				<ol class="mt-2 list-inside list-decimal">
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
