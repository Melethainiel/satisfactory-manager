<script lang="ts">
	import { getGameState } from '$lib/states/gameState.svelte';
	import type { RenameSiteDialogHandle } from './RenameSiteDialogHandle';
	import { t } from '$lib/i18n';

	const gameState = getGameState();

	let siteId = $state<string>('');
	let newSiteName = $state('');
	let renameDialog: HTMLDialogElement | null = null;

	async function handleRename(e?: Event) {
		e?.preventDefault();
		const name = newSiteName.trim();
		if (!name || !siteId || !gameState.selectedGameId) return;
		await gameState.updateGameSite(gameState.selectedGameId, siteId, name);
		newSiteName = '';
		siteId = '';
		renameDialog?.close();
	}

	// Expose open() as a component method for bind:this
	export const open: RenameSiteDialogHandle['open'] = function (id: string, currentName: string) {
		siteId = id;
		newSiteName = currentName;
		renameDialog?.showModal();
	};
</script>

<dialog bind:this={renameDialog} id="rename_site_modal" class="modal">
	<div class="modal-box">
		<h3 class="mb-2 text-lg font-bold">{$t('sites.rename_site')}</h3>
		<form onsubmit={handleRename} class="flex flex-col gap-3">
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
				<button type="button" class="btn" onclick={() => renameDialog?.close()}
					>{$t('common.cancel')}</button
				>
				<button type="submit" class="btn btn-primary" disabled={gameState.isLoading}
					>{$t('common.save')}</button
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