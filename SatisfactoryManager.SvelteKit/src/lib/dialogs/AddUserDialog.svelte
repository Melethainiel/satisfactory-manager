<script lang="ts">
	import { getGameState } from '$lib/states/gameState.svelte';
	import { getAuthState } from '$lib/states/authState.svelte';
	import type { AddUserDialogHandle } from './AddUserDialogHandle';
	import { t } from '$lib/i18n';

	const gameState = getGameState();
	const authState = getAuthState();

	let dialogEl: HTMLDialogElement | null = null;
	let emailsText = $state('');
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	function parseEmails(input: string): string[] {
		return input
			.split(/[,\n;\s]+/)
			.map((e) => e.trim().toLowerCase())
			.filter(Boolean)
			.filter((e) => /.+@.+\..+/.test(e));
	}

	async function submit(e?: Event) {
		e?.preventDefault();
		const gameId = gameState.selectedGameId;
		if (!gameId) return;
		const emails = parseEmails(emailsText);
		if (emails.length === 0) {
			error = $t('dialogs.add_users.error_no_emails');
			return;
		}
		isSubmitting = true;
		error = null;
		try {
			await gameState.addGameUser(gameId, emails);
			// refresh local users list
			await gameState.loadGameUsers(gameId);
			emailsText = '';
			dialogEl?.close();
		} catch (e: any) {
			error = e?.message ?? $t('dialogs.add_users.error_failed');
		} finally {
			isSubmitting = false;
		}
	}

	export const open: AddUserDialogHandle['open'] = () => {
		dialogEl?.showModal();
	};
</script>

<dialog bind:this={dialogEl} class="modal" id="add_user_modal">
	<div class="modal-box max-w-lg">
		<h3 class="mb-2 text-lg font-bold">{$t('dialogs.add_users.title')}</h3>
		<form onsubmit={submit} class="flex flex-col gap-4">
			<textarea
				class="textarea-bordered textarea h-32"
				placeholder={$t('dialogs.add_users.placeholder')}
				bind:value={emailsText}
				required
			></textarea>
			<p class="text-xs opacity-70">{$t('dialogs.add_users.example')}</p>
			{#if error}
				<div class="alert flex justify-between alert-error py-2 text-sm">
					<span>{error}</span>
					<button class="btn btn-xs" onclick={() => (error = null)} type="button">{$t('common.clear')}</button>
				</div>
			{/if}
			<div class="modal-action">
				<button type="button" class="btn" onclick={() => dialogEl?.close()}>{$t('common.cancel')}</button>
				<button type="submit" class="btn btn-primary" disabled={isSubmitting}>
					{#if isSubmitting}
						<span class="loading loading-sm loading-spinner"></span>
					{/if}
					{$t('dialogs.add_users.add')}
				</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label={$t('dialogs.add_users.close_label')}>{$t('common.close')}</button>
	</form>
</dialog>

<style>
	dialog:not([open]) {
		display: none;
	}
</style>
