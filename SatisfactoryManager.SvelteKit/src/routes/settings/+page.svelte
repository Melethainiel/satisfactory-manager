<script lang="ts">
	import { getGameState } from '$lib/states/gameState.svelte';
	import { getAuthState } from '$lib/states/authState.svelte';
	import { Icon, Identification, AdjustmentsHorizontal } from 'svelte-hero-icons';
	import CreateGameDialog from '$lib/dialogs/CreateGameDialog.svelte';
	import type { CreateGameDialogHandle } from '$lib/dialogs/CreateGameDialogHandle';
	import DeleteGameDialog from '$lib/dialogs/DeleteGameDialog.svelte';
	import type { DeleteGameDialogHandle } from '$lib/dialogs/DeleteGameDialogHandle';
	import AddUserDialog from '$lib/dialogs/AddUserDialog.svelte';
	import type { AddUserDialogHandle } from '$lib/dialogs/AddUserDialogHandle';

	const gameState = getGameState();
	const authState = getAuthState();

	let editingName = $state('');
	let isDirty = $state(false);
	let saveError = $state<string | null>(null);
	let saveSuccess = $state(false);
	let usersLoading = $state(false);
	let usersError = $state<string | null>(null);

	// Delete dialog ref
	let deleteDialogRef: DeleteGameDialogHandle | null = $state(null);
	let addUserDialogRef: AddUserDialogHandle | null = $state(null);

	$effect(() => {
		const g = gameState.games.find((g) => g.id === gameState.selectedGameId);
		if (g) {
			editingName = g.name;
			isDirty = false;
			saveError = null;
			saveSuccess = false;
		}
	});

	$effect(() => {
		// Load users whenever selectedGameId changes
		const id = gameState.selectedGameId;
		if (!id) {
			gameState.gameUsers = [];
			return;
		}
		(async () => {
			usersLoading = true;
			usersError = null;
			await gameState.loadGameUsers(id);
			if (gameState.error) {
				usersError = gameState.error;
				gameState.clearError();
			}
			usersLoading = false;
		})();
	});

	function onInput(e: Event) {
		const v = (e.target as HTMLInputElement).value;
		editingName = v;
		const current = gameState.games.find((g) => g.id === gameState.selectedGameId);
		isDirty = !!current && v.trim() !== current.name;
		saveSuccess = false;
	}

	async function save() {
		const id = gameState.selectedGameId;
		if (!id) return;
		saveError = null;
		saveSuccess = false;
		await gameState.updateGame(id, editingName.trim());
		if (gameState.error) {
			saveError = gameState.error;
		} else {
			saveSuccess = true;
			isDirty = false;
		}
	}

	let createDialogRef: CreateGameDialogHandle | null = $state(null);

	// deletion handled inside DeleteGameDialog component
</script>

<h1 class="mb-6 text-2xl font-bold">Settings</h1>

{#if !authState.isAuthenticated}
	<p class="text-sm opacity-70">Sign in to view game settings.</p>
{:else if gameState.isLoading && gameState.games.length === 0}
	<span class="loading loading-spinner loading-sm"></span>
{:else if !gameState.selectedGameId}
	<div class="mt-12 flex flex-col items-center gap-4">
		<p class="text-lg opacity-70">No game selected. Create or select a game first</p>
		<button class="btn btn-primary" onclick={() => createDialogRef?.open()}>Create New Game</button>
		<CreateGameDialog bind:this={createDialogRef} />
	</div>
{:else}
	<div class="grid grid-cols-1 gap-6">
		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title">
					<Icon src={Identification} class="size-6 stroke-1" />
					Game Info
				</h2>
				{#if gameState.error}
					<div class="alert alert-error mb-2 py-2 text-sm">
						<span>{gameState.error}</span>
						<button class="btn btn-xs" onclick={() => gameState.clearError()}>Clear</button>
					</div>
				{/if}
				<label class="form-control w-full max-w-md">
					<div class="label">
						<span class="label-text">Name</span>
					</div>
					<input
						class="input input-bordered w-full"
						value={editingName}
						oninput={onInput}
						placeholder="Game name"
					/>
				</label>
				<div class="mt-4 flex items-center justify-end gap-3">
					{#if saveSuccess}
						<span class="text-success text-sm">Saved</span>
					{/if}
					{#if saveError}
						<span class="text-error text-sm">{saveError}</span>
					{/if}
					<button
						class="btn btn-primary"
						disabled={!isDirty || gameState.isLoading || !editingName.trim()}
						onclick={save}
					>
						{#if gameState.isLoading}
							<span class="loading loading-spinner loading-sm"></span>
						{/if}
						Save
					</button>
				</div>
			</div>
		</div>
		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title">
					<Icon src={AdjustmentsHorizontal} class="size-6 stroke-1" />
					Authorized Users
					<button class="btn btn-xs btn-primary ml-auto" onclick={() => addUserDialogRef?.open()} disabled={!gameState.selectedGameId}>
						Add Users
					</button>
				</h2>
				{#if usersLoading}
					<span class="loading loading-spinner loading-sm"></span>
				{:else if usersError}
					<div class="alert alert-error py-2 text-sm">
						<span>{usersError}</span>
						<button class="btn btn-xs" onclick={() => (usersError = null)}>Dismiss</button>
					</div>
				{:else if gameState.gameUsers.length === 0}
					<p class="text-sm opacity-70">No users found.</p>
				{:else}
					<ul class="divide-base-200 divide-y">
						{#each gameState.gameUsers as u}
							<li class="flex items-center justify-between gap-4 py-2">
								<div>
									<p class="font-medium leading-tight">{u.displayName}</p>
									<p class="text-xs opacity-70">{u.email}</p>
								</div>
								<span class="badge badge-outline text-xs">{u.role}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
		<AddUserDialog bind:this={addUserDialogRef} />
		<!-- Danger Card for Deleting Game -->
		<div class="card bg-base-100 border-error border shadow">
			<div class="card-body">
				<h2 class="card-title text-error">Danger Zone</h2>
				<div class="flex justify-between">
					<p class="mb-2 text-sm opacity-80">
						Deleting a game is <span class="font-bold">permanent</span> and cannot be undone. All data
						will be lost.
					</p>
					<button class="btn btn-outline btn-error" onclick={() => deleteDialogRef?.open()}>
						Delete Game
					</button>
				</div>
				<DeleteGameDialog bind:this={deleteDialogRef} />
			</div>
		</div>
	</div>
{/if}
