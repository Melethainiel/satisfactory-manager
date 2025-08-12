<script lang="ts">
	import { getGameState } from '$lib/states/gameState.svelte';
	import { getAuthState } from '$lib/states/authState.svelte';
	import type { CreateGameDialogHandle } from './CreateGameDialogHandle';

	const gameState = getGameState();
	const authState = getAuthState();

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
	// Expose open() as a component method for bind:this
	export const open: CreateGameDialogHandle['open'] = function () {
		createDialog?.showModal();
	};
</script>

<dialog bind:this={createDialog} id="create_game_modal" class="modal">
	<div class="modal-box">
		<h3 class="mb-2 text-lg font-bold">Create Game</h3>
		<form onsubmit={handleCreate} class="flex flex-col gap-3">
			<input
				class="input-bordered validator input"
				placeholder="Game name"
				bind:value={newGameName}
				required
				pattern="^[a-zA-Z0-9-]+$"
				minlength={3}
				maxlength={30}
			/>
			<p class="validator-hint hidden">
				Must be 3 to 30 characters
				<br />containing only letters, numbers or dash
			</p>
			<div class="modal-action">
				<button type="button" class="btn" onclick={() => createDialog?.close()}>Cancel</button>
				<button type="submit" class="btn btn-primary" disabled={gameState.isLoading}>Create</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label="Close create game modal">close</button>
	</form>
</dialog>

<style>
	dialog:not([open]) {
		display: none;
	}
</style>
