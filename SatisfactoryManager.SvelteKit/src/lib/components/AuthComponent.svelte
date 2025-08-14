<script lang="ts">
	import { getAuthState } from '$lib/states/authState.svelte';

	// Get the auth state from context
	const authState = getAuthState();

	// Handle sign in
	async function handleSignIn() {
		try {
			await authState.signIn();
		} catch (error) {
			console.error('Sign in failed:', error);
		}
	}

	// Handle sign out
	async function handleSignOut() {
		try {
			await authState.signOut();
		} catch (error) {
			console.error('Sign out failed:', error);
		}
	}
</script>

<div class="auth-container">
	{#if authState.isLoading}
		<div class="loading-container">
			<div class="loading loading-lg loading-spinner"></div>
			<p>Initializing authentication...</p>
		</div>
	{:else if authState.isAuthenticated && authState.user}
		<div class="user-info-container">
			<div class="card w-96 bg-base-100 shadow-xl">
				<div class="card-body">
					<h2 class="card-title">Welcome, {authState.user.displayName || authState.user.email}!</h2>

					<div class="user-details">
						{#if authState.user.email}
							<p><strong>Email:</strong> {authState.user.email}</p>
						{/if}
						{#if authState.user.displayName}
							<p><strong>Display Name:</strong> {authState.user.displayName}</p>
						{/if}
						{#if authState.user.id}
							<p><strong>User ID:</strong> {authState.user.id}</p>
						{/if}
					</div>

					<div class="card-actions justify-end">
						<button class="btn btn-primary" onclick={handleSignOut}>Sign Out</button>
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
						<button class="btn btn-primary" onclick={handleSignIn}>Sign In with Azure B2C</button>
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
