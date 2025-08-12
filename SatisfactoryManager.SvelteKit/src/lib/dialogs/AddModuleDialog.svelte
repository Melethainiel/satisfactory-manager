<script lang="ts">
	import { getGameState } from '$lib/states/gameState.svelte';
	import { getAuthState } from '$lib/states/authState.svelte';
	import type { AddModuleDialogHandle } from './AddModuleDialogHandle';
	import type { GameModule } from '$lib/states/gameState.svelte';
	import CreateModuleDialog from './CreateModuleDialog.svelte';
	import type { CreateModuleDialogHandle } from './CreateModuleDialogHandle';

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
			error = e?.message ?? 'Failed to load available modules';
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
			error = e?.message ?? 'Failed to add module';
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
		<h3 class="text-lg font-bold">Add Module</h3>
		<form onsubmit={submit} class="mt-4">
			{#if error}
				<div class="mb-4 alert alert-error py-2 text-sm">
					<span>{error}</span>
				</div>
			{/if}

			{#if isLoadingModules}
				<div class="mb-4 flex items-center gap-2">
					<span class="loading loading-sm loading-spinner"></span>
					<span class="text-sm opacity-70">Loading available modules...</span>
				</div>
			{:else if availableModules.length === 0}
				<div class="mb-4 text-center">
					<p class="mb-3 text-sm opacity-70">No modules available to add.</p>
					<button
						type="button"
						class="btn btn-outline btn-sm"
						onclick={handleCreateModule}
						disabled={isSubmitting}
					>
						Create New Module
					</button>
				</div>
			{:else}
				<label class="form-control mb-4 w-full">
					<div class="label">
						<span class="label-text">Select Module</span>
					</div>
					<select bind:value={selectedModuleId} class="select-bordered select w-full">
						<option value="">Choose a module...</option>
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
						Or create a new module
					</button>
				</div>
			{/if}

			<div class="modal-action">
				<button type="button" class="btn" onclick={() => dialogEl?.close()} disabled={isSubmitting}>
					Cancel
				</button>
				<button
					type="submit"
					class="btn btn-primary"
					disabled={isSubmitting || !selectedModuleId || availableModules.length === 0}
				>
					{#if isSubmitting}
						<span class="loading loading-sm loading-spinner"></span>
					{/if}
					Add Module
				</button>
			</div>
		</form>
	</div>
	<CreateModuleDialog bind:this={createModuleDialogRef} />
</dialog>
