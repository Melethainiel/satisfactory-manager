<script lang="ts">
	import AuthComponent from '$lib/components/AuthComponent.svelte';
	import { getAuthState } from '$lib/states/authState.svelte';
	import { t } from '$lib/i18n';

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
	<title>{$t('demo.title')}</title>
</svelte:head>

<div class="container mx-auto p-4">
	<h1 class="mb-8 text-3xl font-bold">{$t('demo.title')}</h1>

	<!-- Authentication Component -->
	<div class="mb-8">
		<h2 class="mb-4 text-2xl font-semibold">{$t('demo.auth_status')}</h2>
		<AuthComponent />
	</div>

	<!-- API Testing Section -->
	{#if authState.isAuthenticated}
		<div class="mb-8">
			<h2 class="mb-4 text-2xl font-semibold">{$t('demo.api_testing')}</h2>
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h3 class="card-title">{$t('demo.test_api_call')}</h3>
					<p>{$t('demo.test_api_description')}</p>

					<div class="card-actions">
						<button
							class="btn btn-secondary"
							class:loading={isLoadingApi}
							disabled={isLoadingApi}
							onclick={testApiCall}
						>
							{isLoadingApi ? $t('demo.testing') : $t('demo.test_api')}
						</button>
					</div>

					{#if apiResponse}
						<div class="mt-4">
							<h4 class="font-semibold">{$t('demo.api_response')}</h4>
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
			<h2 class="mb-4 text-2xl font-semibold">{$t('demo.debug_info')}</h2>
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h3 class="card-title">{$t('demo.current_auth_state')}</h3>
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
		<h2 class="mb-4 text-2xl font-semibold">{$t('demo.setup_instructions')}</h2>
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
				<h3 class="font-bold">{$t('demo.config_required')}</h3>
				<p>{$t('demo.config_steps')}</p>
				<ol class="mt-2 list-inside list-decimal">
					<li>{$t('demo.config_step_1')}</li>
					<li>{$t('demo.config_step_2')}</li>
					<li>{$t('demo.config_step_3')}</li>
					<li>{$t('demo.config_step_4')}</li>
				</ol>
				<p class="mt-2">{$t('demo.config_note')}</p>
			</div>
		</div>
	</div>
</div>
