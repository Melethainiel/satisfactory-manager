<script lang="ts">
	import { getGameState } from '$lib/states/gameState.svelte';
	import type { CreateSiteDialogHandle } from './CreateSiteDialogHandle';
	import { t } from '$lib/i18n';

	const gameState = getGameState();

	let newSiteName = $state('');
	let createDialog: HTMLDialogElement | null = null;

	async function handleCreate(e?: Event) {
		e?.preventDefault();
		const name = newSiteName.trim();
		if (!name || !gameState.selectedGameId) return;
		await gameState.createGameSite(gameState.selectedGameId, name);
		newSiteName = '';
		createDialog?.close();
	}

	// Expose open() as a component method for bind:this
	export const open: CreateSiteDialogHandle['open'] = function () {
		createDialog?.showModal();
	};
</script>

<dialog bind:this={createDialog} id="create_site_modal" class="modal">
	<div class="modal-box">
		<h3 class="mb-2 text-lg font-bold">{$t('sites.create_site')}</h3>
		<form onsubmit={handleCreate} class="flex flex-col gap-3">
			<input
				class="input-bordered validator input"
				placeholder={$t('sites.site_name_placeholder')}
				bind:value={newSiteName}
				required
				maxlength={200}
				minlength={1}
			/>
			<p class="validator-hint hidden">
				{$t('sites.site_name_validation')}
			</p>
			<div class="modal-action">
				<button type="button" class="btn" onclick={() => createDialog?.close()}
					>{$t('common.cancel')}</button
				>
				<button type="submit" class="btn btn-primary" disabled={gameState.isLoading}
					>{$t('common.create')}</button
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
