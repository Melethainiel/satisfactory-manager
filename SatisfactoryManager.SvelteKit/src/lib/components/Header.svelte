<script lang="ts">
	import { getAuthState } from '$lib/auth/authState.svelte';
	import { getGameState } from '$lib/game/gameState.svelte';
	// New Svelte 5 pattern: accept a callback prop instead of dispatching an event
	let { toggleNav } = $props<{ toggleNav?: () => void }>();

	// Get auth & game state from context
	const authState = getAuthState();
	const gameState = getGameState();

	// Create game dialog state
	let newGameName = $state('');
	let createDialog: HTMLDialogElement | null = null;

	async function handleCreate(e?: Event) {
		e?.preventDefault();
		const name = newGameName.trim();
		if (!name) return;
		await gameState.createGame(authState.user?.email ?? '', name);
		newGameName = '';
		createDialog?.close();
	}

	// Popover helpers
	const popoverId = 'user-menu-popover';
	const anchorName = '--user-menu-anchor';

	function hideUserMenu() {
		const el = document.getElementById(popoverId) as any;
		el?.hidePopover?.();
	}

	// Handle logout
	async function handleLogout() {
		hideUserMenu();
		await authState.signOut();
	}

	// Handle login
	async function handleLogin() {
		await authState.signIn();
	}
</script>

<header
	class="navbar bg-base-100/80 supports-[backdrop-filter]:bg-base-100/70 border-base-200 sticky top-0 z-40 min-h-20 border-b px-4 shadow-lg backdrop-blur transition-colors"
>
	<!-- Left side: Logo and Title -->
	<div class="navbar-start items-center gap-4">
		<!-- Mobile nav toggle -->
		<button
			class="btn btn-ghost btn-square lg:hidden"
			aria-label="Toggle navigation"
			onclick={() => toggleNav?.()}
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
			</svg>
		</button>
		<a href="/" class="flex text-xl font-bold">
			<!-- Logo -->
			<img
				src="/logo-256.png"
				alt="Satisfactory Manager logo"
				class="mr-2 h-8 w-8 rounded-lg object-contain"
				width="32"
				height="32"
				loading="lazy"
			/>
			Satisfactory Manager
		</a>
		<!-- Game selector when authenticated -->
		{#if authState.isAuthenticated}
			<div class="flex items-center gap-2" class:opacity-50={gameState.isLoading}>
				<select
					class="select select-sm w-52"
					onchange={(e: any) => gameState.selectGame(e.target.value)}
					bind:value={gameState.selectedGameId}
					disabled={gameState.isLoading || gameState.games.length === 0}
				>
					<option value={null} disabled>Select server...</option>
					{#each gameState.games as g}
						<option value={g.id}>{g.name}</option>
					{/each}
				</select>
				<button class="btn btn-xs" onclick={() => createDialog?.showModal()} title="Create new game"
					>+</button
				>
				{#if gameState.error}
					<button
						class="btn btn-ghost btn-xs text-error"
						title={gameState.error}
						onclick={gameState.clearError}>!</button
					>
				{:else if gameState.isLoading}
					<span class="loading loading-spinner loading-xs ml-2"></span>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Create Game Modal (dialog) -->
	<dialog bind:this={createDialog} id="create_game_modal" class="modal">
		<div class="modal-box">
			<h3 class="mb-2 text-lg font-bold">Create Game</h3>
			<form onsubmit={handleCreate} class="flex flex-col gap-3">
				<input
					class="input input-bordered validator"
					placeholder="Game name"
					bind:value={newGameName}
					required
					pattern="^[a-zA-Z0-9-]$"
					minlength={3}
					maxlength={30}
				/>
				<p class="validator-hint hidden">
					Must be 3 to 30 characters
					<br />containing only letters, numbers or dash
				</p>
				<div class="modal-action">
					<button type="button" class="btn" onclick={() => createDialog?.close()}>Cancel</button>
					<button type="submit" class="btn btn-primary" disabled={gameState.isLoading}
						>Create</button
					>
				</div>
			</form>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button aria-label="Close create game modal">close</button>
		</form>
	</dialog>

	<!-- Right side: Authentication -->
	<div class="navbar-end">
		{#if authState.isLoading}
			<!-- Loading state -->
			<div class="loading loading-spinner loading-sm"></div>
		{:else if authState.isAuthenticated && authState.user}
			<!-- User is logged in - show user info with dropdown -->
			<div class="user-menu-container">
				<button
					class="btn btn-ghost h-auto min-h-0 gap-2 px-2 py-1 normal-case"
					popovertarget={popoverId}
					style={`anchor-name:${anchorName}`}
					aria-haspopup="menu"
					aria-controls={popoverId}
					aria-label="User menu"
				>
					<div class="flex items-center gap-x-2">
						<img
							class="h-10 w-10 rounded-full object-cover"
							src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=facearea&facepad=3&w=256&h=256&q=80"
							alt="User avatar"
						/>
						<div class="hidden text-left md:block">
							<h1 class="text-lg font-semibold capitalize text-gray-700 dark:text-white">
								{authState.user.displayName || 'User'}
							</h1>
							<p class="text-sm text-gray-500 dark:text-gray-400">
								{authState.user.email || 'No email'}
							</p>
						</div>
						<svg class="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 9l-7 7-7-7"
							></path>
						</svg>
					</div>
				</button>
				<ul
					id={popoverId}
					popover
					class="dropdown menu rounded-box bg-base-100 w-fit border p-2 shadow-lg"
					style={`position-anchor:${anchorName}`}
					role="menu"
				>
					<li class="menu-title" role="presentation">
						<span class="text-base-content/60 text-xs" role="none">
							{authState.user.email || 'No email'}
						</span>
					</li>
					<div class="divider my-1"></div>
					<li><a href="/profile" role="menuitem" onclick={hideUserMenu}>Profile</a></li>
					<li><a href="/settings" role="menuitem" onclick={hideUserMenu}>Settings</a></li>
					<div class="divider my-1"></div>
					<li><button role="menuitem" class="text-error" onclick={handleLogout}>Logout</button></li>
				</ul>
			</div>
		{:else}
			<!-- User is not logged in - show login button -->
			<button class="btn btn-primary" onclick={handleLogin}>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
					></path>
				</svg>
				Login
			</button>
		{/if}

		{#if authState.error}
			<!-- Error notification -->
			<div class="toast toast-top toast-end">
				<div class="alert alert-error">
					<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
						></path>
					</svg>
					<span>{authState.error}</span>
					<button
						class="btn btn-sm btn-ghost"
						onclick={authState.clearError}
						aria-label="Close error"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							></path>
						</svg>
					</button>
				</div>
			</div>
		{/if}
	</div>
</header>

<style>
	@keyframes fadeScale {
		from {
			opacity: 0;
			transform: translateY(-4px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
	ul[popover] {
		animation: fadeScale 120ms ease-out;
	}
	/* Hide dialog when not open => fix bug of modal positioning when closing */
	dialog:not([open]) {
		display: none;
	}
</style>
