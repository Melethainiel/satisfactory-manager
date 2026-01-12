<script lang="ts">
	import { getGameState } from '$lib/states/gameState.svelte';
	import { getAuthState } from '$lib/states/authState.svelte';
	import { t } from '$lib/i18n';

	const gameState = getGameState();
	const authState = getAuthState();

	const props = $props<{ userEmail?: string }>();
	let userEmail = $state<string | undefined>(props.userEmail);

	const roles = ['Reader', 'Contributor', 'Administrator', 'Owner'] as const;
	let selectedRole = $state<string>('Reader');
	let dialogEl: HTMLDialogElement | null = null;
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	function openFor(email: string, currentRole?: string) {
		userEmail = email;
		selectedRole = currentRole && roles.includes(currentRole as any) ? currentRole : 'Reader';
		error = null;
		dialogEl?.showModal();
	}
	export const open = openFor; // expose

	async function submit(e?: Event) {
		e?.preventDefault();
		if (!userEmail) {
			error = $t('dialogs.select_auth_level.error_no_user');
			return;
		}
		const gameId = gameState.selectedGameId;
		if (!gameId) {
			error = $t('dialogs.select_auth_level.error_no_game');
			return;
		}
		isSubmitting = true;
		error = null;
		try {
			await gameState.updateGameUserRole(gameId, userEmail, selectedRole);
			await gameState.loadGameUsers(gameId);
			dialogEl?.close();
		} catch (e: any) {
			error = e?.message ?? $t('dialogs.select_auth_level.error_failed');
		} finally {
			isSubmitting = false;
		}
	}
</script>

<dialog bind:this={dialogEl} id="select_auth_level_modal" class="modal">
	<div class="modal-box max-w-md">
		<h3 class="mb-2 text-lg font-bold">{$t('dialogs.select_auth_level.title')}</h3>
		<form onsubmit={submit} class="flex flex-col gap-4">
			<div>
				<label class="label" for="role_user_email"
					><span class="label-text">{$t('dialogs.select_auth_level.user')}</span></label
				>
				<input
					id="role_user_email"
					class="input-bordered input w-full"
					value={userEmail ?? ''}
					readonly
				/>
			</div>
			<div class="flex flex-col gap-2">
				<label class="label" for="role_choices"
					><span class="label-text">{$t('dialogs.select_auth_level.role')}</span></label
				>
				<div class="join-vertical join sm:join-horizontal">
					{#each roles as r}
						<input
							type="radio"
							name="role"
							aria-label={r}
							class="btn join-item"
							value={r}
							checked={selectedRole === r}
							onchange={() => (selectedRole = r)}
						/>
					{/each}
				</div>
				<p class="text-xs opacity-70">{$t('dialogs.select_auth_level.role_description')}</p>
				<ul class="ml-4 list-disc space-y-1 text-xs opacity-70">
					<li>
						<strong>{$t('dialogs.select_auth_level.reader')}</strong>: {$t(
							'dialogs.select_auth_level.reader_desc'
						)}
					</li>
					<li>
						<strong>{$t('dialogs.select_auth_level.contributor')}</strong>: {$t(
							'dialogs.select_auth_level.contributor_desc'
						)}
					</li>
					<li>
						<strong>{$t('dialogs.select_auth_level.administrator')}</strong>: {$t(
							'dialogs.select_auth_level.administrator_desc'
						)}
					</li>
					<li>
						<strong>{$t('dialogs.select_auth_level.owner')}</strong>: {$t(
							'dialogs.select_auth_level.owner_desc'
						)}
					</li>
				</ul>
			</div>
			{#if error}
				<div class="alert flex justify-between alert-error py-2 text-sm">
					<span>{error}</span>
					<button type="button" class="btn btn-xs" onclick={() => (error = null)}
						>{$t('common.clear')}</button
					>
				</div>
			{/if}
			<div class="modal-action">
				<button type="button" class="btn" onclick={() => dialogEl?.close()}
					>{$t('common.cancel')}</button
				>
				<button type="submit" class="btn btn-primary" disabled={isSubmitting}>
					{#if isSubmitting}
						<span class="loading loading-sm loading-spinner"></span>
					{/if}
					{$t('common.save')}
				</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label={$t('dialogs.select_auth_level.close_label')}>{$t('common.close')}</button>
	</form>
</dialog>

<style>
	dialog:not([open]) {
		display: none;
	}
</style>
