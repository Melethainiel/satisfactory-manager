<script lang="ts">
	import { getGameState } from '$lib/states/gameState.svelte';
	import { getAuthState } from '$lib/states/authState.svelte';
	import type { CreateGameDialogHandle } from './CreateGameDialogHandle';
	import { t } from '$lib/i18n';

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

<dialog
	bind:this={createDialog}
	id="create_game_modal"
	class="modal"
	data-testid="create-game-dialog"
>
	<div class="modal-box">
		<h3 class="mb-2 text-lg font-bold">{$t('game.create_game')}</h3>
		<form onsubmit={handleCreate} class="flex flex-col gap-3">
			<input
				class="input-bordered validator input"
				placeholder={$t('game.game_name_placeholder')}
				bind:value={newGameName}
				required
				pattern="^[a-zA-Z0-9-]+$"
				minlength={3}
				maxlength={30}
				data-testid="game-name-input"
			/>
			<p class="validator-hint hidden">
				{$t('game.game_name_validation')}
			</p>
			<div class="modal-action">
				<button
					type="button"
					class="btn"
					onclick={() => createDialog?.close()}
					data-testid="cancel-button">{$t('common.cancel')}</button
				>
				<button
					type="submit"
					class="btn btn-primary"
					disabled={gameState.isLoading}
					data-testid="create-game-submit">{$t('common.create')}</button
				>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label={$t('common.close')}>{$t('common.close')}</button>
	</form>
</dialog>

<style>
	dialog:not([open]) {
		display: none;
	}
</style>
