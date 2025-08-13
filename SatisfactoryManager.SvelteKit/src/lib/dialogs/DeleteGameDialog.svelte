<script lang="ts">
	import { getGameState } from '$lib/states/gameState.svelte';
	import type { DeleteGameDialogHandle } from './DeleteGameDialogHandle';
	import { t } from '$lib/i18n';

	const gameState = getGameState();

	let deleteDialog: HTMLDialogElement | null = null;
	let deleteLoading = $state(false);
	let deleteError = $state<string | null>(null);

	async function deleteGame() {
		const id = gameState.selectedGameId;
		if (!id) return;
		deleteLoading = true;
		deleteError = null;
		try {
			await gameState.deleteGame(id);
			deleteDialog?.close();
		} catch (e: any) {
			deleteError = e?.message ?? $t('dialogs.delete_game.error_failed');
		} finally {
			deleteLoading = false;
		}
	}

	export const open: DeleteGameDialogHandle['open'] = function () {
		deleteDialog?.showModal();
	};
</script>

<dialog bind:this={deleteDialog} class="modal" id="delete_game_modal">
	<div class="modal-box">
		<h3 class="text-lg font-bold text-error">{$t('dialogs.delete_game.title')}</h3>
		<p class="py-2">{$t('dialogs.delete_game.message')}</p>
		<div class="modal-action flex flex-col items-stretch gap-2">
			{#if deleteError}
				<div class="alert alert-error py-2 text-sm">
					<span>{deleteError}</span>
					<button class="btn btn-xs" onclick={() => (deleteError = null)}>{$t('common.clear')}</button>
				</div>
			{/if}
			<div class="flex w-full justify-end gap-2">
				<button class="btn" onclick={() => deleteDialog?.close()}>{$t('common.cancel')}</button>
				<button class="btn btn-error" onclick={deleteGame} disabled={deleteLoading}>
					{#if deleteLoading}
						<span class="loading loading-sm loading-spinner"></span>
					{/if}
					{$t('dialogs.delete_game.yes_delete')}
				</button>
			</div>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label={$t('dialogs.delete_game.close_label')}>{$t('common.close')}</button>
	</form>
</dialog>

<style>
	dialog:not([open]) {
		display: none;
	}
</style>
