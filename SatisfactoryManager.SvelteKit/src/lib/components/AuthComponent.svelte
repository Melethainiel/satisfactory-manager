<script lang="ts">
	import { onMount } from 'svelte';
	import { authState, initializeMsal, signIn, signOut, clearError } from '$lib/auth/azureB2C';
	import { azureB2CConfig } from '$lib/auth/config';

	// Initialize authentication when component mounts
	onMount(async () => {
		try {
			await initializeMsal(azureB2CConfig);
		} catch (error) {
			console.error('Failed to initialize authentication:', error);
		}
	});

	// Handle sign in
	async function handleSignIn() {
		try {
			await signIn();
		} catch (error) {
			console.error('Sign in failed:', error);
		}
	}

	// Handle sign out
	async function handleSignOut() {
		try {
			await signOut();
		} catch (error) {
			console.error('Sign out failed:', error);
		}
	}

	// Handle clear error
	function handleClearError() {
		clearError();
	}
</script>

<div class="auth-container">
	{#if $authState.isLoading}
		<div class="loading-container">
			<div class="loading loading-spinner loading-lg"></div>
			<p>Initializing authentication...</p>
		</div>
	{:else if $authState.error}
		<div class="alert alert-error">
			<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<div>
				<h3>Authentication Error</h3>
				<p>{$authState.error}</p>
			</div>
			<button class="btn btn-sm" on:click={handleClearError}>Dismiss</button>
		</div>
	{:else if $authState.isAuthenticated && $authState.user}
		<div class="user-info-container">
			<div class="card w-96 bg-base-100 shadow-xl">
				<div class="card-body">
					<h2 class="card-title">Welcome, {$authState.user.displayName || $authState.user.email}!</h2>
					
					<div class="user-details">
						{#if $authState.user.email}
							<p><strong>Email:</strong> {$authState.user.email}</p>
						{/if}
						{#if $authState.user.givenName}
							<p><strong>First Name:</strong> {$authState.user.givenName}</p>
						{/if}
						{#if $authState.user.surname}
							<p><strong>Last Name:</strong> {$authState.user.surname}</p>
						{/if}
						{#if $authState.user.jobTitle}
							<p><strong>Job Title:</strong> {$authState.user.jobTitle}</p>
						{/if}
						{#if $authState.user.id}
							<p><strong>User ID:</strong> {$authState.user.id}</p>
						{/if}
					</div>
					
					<div class="card-actions justify-end">
						<button class="btn btn-primary" on:click={handleSignOut}>Sign Out</button>
					</div>
				</div>
			</div>
		</div>
	{:else}
		<div class="sign-in-container">
			<div class="card w-96 bg-base-100 shadow-xl">
				<div class="card-body">
					<h2 class="card-title">Sign In Required</h2>
					<p>Please sign in to access your account.</p>
					<div class="card-actions justify-end">
						<button class="btn btn-primary" on:click={handleSignIn}>Sign In with Azure B2C</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.auth-container {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 50vh;
		padding: 2rem;
	}

	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.user-details {
		margin: 1rem 0;
	}

	.user-details p {
		margin: 0.5rem 0;
	}
</style>
