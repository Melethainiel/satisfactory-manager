<script lang="ts">
	import { getGameState } from '$lib/states/gameState.svelte';
	import { getAuthState } from '$lib/states/authState.svelte';
	import type { AddModuleDialogHandle } from './AddModuleDialogHandle';
	import type { GameModule } from '$lib/states/gameState.svelte';
	import CreateModuleDialog from './CreateModuleDialog.svelte';
	import type { CreateModuleDialogHandle } from './CreateModuleDialogHandle';
	import { t } from '$lib/i18n';

	const gameState = getGameState();
	const authState = getAuthState();

	let dialogEl: HTMLDialogElement | null = null;
	let selectedModuleId = $state('');
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);
	let availableModules = $state<GameModule[]>([]);
	let isLoadingModules = $state(false);
	let createModuleDialogRef: CreateModuleDialogHandle | null = $state(null);

	async function loadAvailableModules() {
		if (!authState.apiFetch) return;
		isLoadingModules = true;
		try {
			const res = await authState.apiFetch('/api/modules');
			if (!res.ok) throw new Error(`Failed to load modules (${res.status})`);
			const data = (await res.json()) as GameModule[];

			// Filter out modules already attached to this game
			const attachedModuleIds = new Set(gameState.gameModules.map((m) => m.id));
			availableModules = data.filter((m) => !attachedModuleIds.has(m.id));
		} catch (e: any) {
			error = e?.message ?? $t('dialogs.add_module.error_load_failed');
		} finally {
			isLoadingModules = false;
		}
	}

	async function submit(e?: Event) {
		e?.preventDefault();
		const gameId = gameState.selectedGameId;
		if (!gameId || !selectedModuleId) return;

		isSubmitting = true;
		error = null;
		try {
			await gameState.addGameModule(gameId, selectedModuleId);
			// refresh local modules list
			await gameState.loadGameModules(gameId);
			selectedModuleId = '';
			dialogEl?.close();
		} catch (e: any) {
			error = e?.message ?? $t('dialogs.add_module.error_failed');
		} finally {
			isSubmitting = false;
		}
	}

	function onClose() {
		selectedModuleId = '';
		error = null;
	}

	function handleCreateModule() {
		createModuleDialogRef?.open((createdModule) => {
			// Reload available modules after creation
			loadAvailableModules().then(() => {
				// Auto-select the newly created module
				selectedModuleId = createdModule.id;
			});
		});
	}

	export const open: AddModuleDialogHandle['open'] = () => {
		loadAvailableModules();
		dialogEl?.showModal();
	};
</script>

<dialog bind:this={dialogEl} class="modal" onclose={onClose}>
	<div class="modal-box">
		<h3 class="text-lg font-bold">{$t('dialogs.add_module.title')}</h3>
		<form onsubmit={submit} class="mt-4">
			{#if error}
				<div class="mb-4 alert alert-error py-2 text-sm">
					<span>{error}</span>
				</div>
			{/if}

			{#if isLoadingModules}
				<div class="mb-4 flex items-center gap-2">
					<span class="loading loading-sm loading-spinner"></span>
					<span class="text-sm opacity-70">{$t('dialogs.add_module.loading_modules')}</span>
				</div>
			{:else if availableModules.length === 0}
				<div class="mb-4 text-center">
					<p class="mb-3 text-sm opacity-70">{$t('dialogs.add_module.no_modules_available')}</p>
					<button
						type="button"
						class="btn btn-outline btn-sm"
						onclick={handleCreateModule}
						disabled={isSubmitting}
					>
						{$t('dialogs.add_module.create_new_module')}
					</button>
				</div>
			{:else}
				<label class="form-control mb-4 w-full">
					<div class="label">
						<span class="label-text">{$t('dialogs.add_module.select_module')}</span>
					</div>
					<select bind:value={selectedModuleId} class="select-bordered select w-full">
						<option value="">{$t('dialogs.add_module.choose_module')}</option>
						{#each availableModules as module}
							<option value={module.id}>{module.name}</option>
						{/each}
					</select>
				</label>
				<div class="text-center">
					<button
						type="button"
						class="btn btn-ghost btn-xs"
						onclick={handleCreateModule}
						disabled={isSubmitting}
					>
						{$t('dialogs.add_module.or_create_new')}
					</button>
				</div>
			{/if}

			<div class="modal-action">
				<button type="button" class="btn" onclick={() => dialogEl?.close()} disabled={isSubmitting}>
					{$t('common.cancel')}
				</button>
				<button
					type="submit"
					class="btn btn-primary"
					disabled={isSubmitting || !selectedModuleId || availableModules.length === 0}
				>
					{#if isSubmitting}
						<span class="loading loading-sm loading-spinner"></span>
					{/if}
					{$t('dialogs.add_module.add')}
				</button>
			</div>
		</form>
	</div>
	<CreateModuleDialog bind:this={createModuleDialogRef} />
</dialog>
