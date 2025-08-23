<script lang="ts">
	import { getAuthState } from '$lib/states/authState.svelte';
	import { t } from '$lib/i18n';

	interface Module {
		id: string;
		name: string;
		url: string;
		currentVersion: string | null;
		githubRepo: string | null;
		createdAt: Date;
		updatedAt: Date;
	}

	const authState = getAuthState();

	let dialogEl: HTMLDialogElement | null = null;
	let currentModule: Module | null = $state(null);
	let isDeleting = $state(false);
	let error = $state<string | null>(null);
	let onModuleDeleted: ((moduleId: string) => void) | null = $state(null);

	export function open(module: Module, onDeleted?: (moduleId: string) => void) {
		currentModule = module;
		error = null;
		onModuleDeleted = onDeleted || null;
		dialogEl?.showModal();
	}

	function onClose() {
		if (!isDeleting) {
			currentModule = null;
			error = null;
		}
	}

	async function deleteModule() {
		if (!currentModule || !authState.apiFetch) return;

		isDeleting = true;
		error = null;

		try {
			const res = await authState.apiFetch(`/api/modules/${currentModule.id}`, {
				method: 'DELETE'
			});

			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.error || `Failed to delete module (${res.status})`);
			}

			// Notify parent component of successful deletion
			if (onModuleDeleted) {
				onModuleDeleted(currentModule.id);
			}

			// Close dialog
			dialogEl?.close();
		} catch (e: any) {
			error = e?.message ?? 'Failed to delete module';
		} finally {
			isDeleting = false;
		}
	}
</script>

<dialog bind:this={dialogEl} class="modal" onclose={onClose}>
	<div class="modal-box">
		{#if currentModule}
			<h3 class="mb-4 text-lg font-bold">
				{$t('dialogs.delete_module.title')}
			</h3>

			<div class="mb-4">
				<p class="mb-2">{$t('dialogs.delete_module.message')}</p>
				<div class="rounded bg-base-200 p-3">
					<div class="font-medium">{currentModule.name}</div>
					<div class="text-sm opacity-70">{currentModule.url}</div>
				</div>
			</div>

			{#if error}
				<div class="mb-4 alert alert-error py-2 text-sm">
					<span>{error}</span>
				</div>
			{/if}

			<div class="modal-action">
				<button type="button" class="btn" onclick={() => dialogEl?.close()} disabled={isDeleting}>
					{$t('common.cancel')}
				</button>
				<button type="button" class="btn btn-error" onclick={deleteModule} disabled={isDeleting}>
					{#if isDeleting}
						<span class="loading loading-sm loading-spinner"></span>
					{:else}
						{$t('dialogs.delete_module.yes_delete')}
					{/if}
				</button>
			</div>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label={$t('dialogs.delete_module.close_label')}>{$t('common.close')}</button>
	</form>
</dialog>
