<script lang="ts">
	import { getGameState } from '$lib/states/gameState.svelte';
	import { getAuthState } from '$lib/states/authState.svelte';
	import { Icon, Identification, AdjustmentsHorizontal, Trash, Plus } from 'svelte-hero-icons';
	import { t } from '$lib/i18n';
	import CreateGameDialog from '$lib/dialogs/CreateGameDialog.svelte';
	import type { CreateGameDialogHandle } from '$lib/dialogs/CreateGameDialogHandle';
	import DeleteGameDialog from '$lib/dialogs/DeleteGameDialog.svelte';
	import type { DeleteGameDialogHandle } from '$lib/dialogs/DeleteGameDialogHandle';
	import AddUserDialog from '$lib/dialogs/AddUserDialog.svelte';
	import type { AddUserDialogHandle } from '$lib/dialogs/AddUserDialogHandle';
	import SelectAuthLevelDialog from '$lib/dialogs/SelectAuthLevelDialog.svelte';
	import type { SelectAuthLevelDialogHandler } from '$lib/dialogs/SelectAuthLevelDialogHandler';
	import AddModuleDialog from '$lib/dialogs/AddModuleDialog.svelte';
	import type { AddModuleDialogHandle } from '$lib/dialogs/AddModuleDialogHandle';
	import ConfirmDialog from '$lib/dialogs/ConfirmDialog.svelte';
	import type { ConfirmDialogHandle } from '$lib/dialogs/ConfirmDialogHandle';

	const gameState = getGameState();
	const authState = getAuthState();

	let editingName = $state('');
	let isDirty = $state(false);
	let saveError = $state<string | null>(null);
	let saveSuccess = $state(false);
	let usersLoading = $state(false);
	let usersError = $state<string | null>(null);
	let modulesLoading = $state(false);
	let modulesError = $state<string | null>(null);

	// Delete dialog ref
	let deleteDialogRef: DeleteGameDialogHandle | null = $state(null);
	let addUserDialogRef: AddUserDialogHandle | null = $state(null);
	let selectAuthLevelDialogRef: SelectAuthLevelDialogHandler | null = $state(null);
	let addModuleDialogRef: AddModuleDialogHandle | null = $state(null);
	let confirmDialogRef: ConfirmDialogHandle | null = $state(null);

	$effect(() => {
		const g = gameState.games.find((g) => g.id === gameState.selectedGameId);
		if (g) {
			editingName = g.name;
			isDirty = false;
			saveError = null;
			saveSuccess = false;
		}
	});

	$effect(() => {
		// Load users whenever selectedGameId changes
		const id = gameState.selectedGameId;
		if (!id) {
			gameState.gameUsers = [];
			return;
		}
		(async () => {
			usersLoading = true;
			usersError = null;
			await gameState.loadGameUsers(id);
			if (gameState.error) {
				usersError = gameState.error;
				gameState.clearError();
			}
			usersLoading = false;
		})();
	});

	$effect(() => {
		// Load modules whenever selectedGameId changes
		const id = gameState.selectedGameId;
		if (!id) {
			gameState.gameModules = [];
			return;
		}
		(async () => {
			modulesLoading = true;
			modulesError = null;
			await gameState.loadGameModules(id);
			if (gameState.error) {
				modulesError = gameState.error;
				gameState.clearError();
			}
			modulesLoading = false;
		})();
	});

	function onInput(e: Event) {
		const v = (e.target as HTMLInputElement).value;
		editingName = v;
		const current = gameState.games.find((g) => g.id === gameState.selectedGameId);
		isDirty = !!current && v.trim() !== current.name;
		saveSuccess = false;
	}

	async function save() {
		const id = gameState.selectedGameId;
		if (!id) return;
		saveError = null;
		saveSuccess = false;
		await gameState.updateGame(id, editingName.trim());
		if (gameState.error) {
			saveError = gameState.error;
		} else {
			saveSuccess = true;
			isDirty = false;
		}
	}

	async function removeGameUser(userEmail: string) {
		const gameId = gameState.selectedGameId;
		if (!gameId) return;

		confirmDialogRef?.open({
			title: $t('users.remove_user'),
			message: $t('users.remove_user_confirm', { values: { email: userEmail } }),
			confirmText: $t('users.remove_user'),
			type: 'danger',
			onConfirm: async () => {
				await gameState.removeGameUser(gameId, userEmail);
				// refresh local users list
				await gameState.loadGameUsers(gameId);
			}
		});
	}

	async function removeGameModule(moduleId: string, moduleName: string) {
		const gameId = gameState.selectedGameId;
		if (!gameId) return;

		confirmDialogRef?.open({
			title: $t('modules.remove_module'),
			message: $t('modules.remove_module_confirm', { values: { name: moduleName } }),
			confirmText: $t('modules.remove_module'),
			type: 'danger',
			onConfirm: async () => {
				await gameState.removeGameModule(gameId, moduleId);
				// refresh local modules list
				await gameState.loadGameModules(gameId);
			}
		});
	}

	let createDialogRef: CreateGameDialogHandle | null = $state(null);

	// deletion handled inside DeleteGameDialog component
</script>

<svelte:head>
	<title>Satisfactory Manager | {$t('settings.title')}</title>
</svelte:head>

<h1 class="mb-6 text-2xl font-bold">{$t('settings.title')}</h1>

{#if !authState.isAuthenticated}
	<p class="text-sm opacity-70">{$t('settings.sign_in_prompt')}</p>
{:else if gameState.isLoading && gameState.games.length === 0}
	<span class="loading loading-sm loading-spinner"></span>
{:else if !gameState.selectedGameId}
	<div class="mt-12 flex flex-col items-center gap-4">
		<p class="text-lg opacity-70">{$t('settings.no_game_selected')}</p>
		<button class="btn btn-primary" onclick={() => createDialogRef?.open()}>{$t('settings.create_new_game')}</button>
		<CreateGameDialog bind:this={createDialogRef} />
	</div>
{:else}
	<div class="grid grid-cols-1 gap-6">
		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title">
					<Icon src={Identification} class="size-6 stroke-1" />
					{$t('settings.game_info')}
				</h2>
				{#if gameState.error}
					<div class="mb-2 alert alert-error py-2 text-sm">
						<span>{gameState.error}</span>
						<button class="btn btn-xs" onclick={() => gameState.clearError()}>{$t('common.clear')}</button>
					</div>
				{/if}
				<label class="form-control w-full max-w-md">
					<div class="label">
						<span class="label-text">{$t('settings.name')}</span>
					</div>
					<input
						class="input-bordered input w-full"
						value={editingName}
						oninput={onInput}
						placeholder={$t('game.game_name_placeholder')}
					/>
				</label>
				<div class="mt-4 flex items-center justify-end gap-3">
					{#if saveSuccess}
						<span class="text-sm text-success">{$t('settings.saved')}</span>
					{/if}
					{#if saveError}
						<span class="text-sm text-error">{saveError}</span>
					{/if}
					<button
						class="btn btn-primary"
						disabled={!isDirty || gameState.isLoading || !editingName.trim()}
						onclick={save}
					>
						{#if gameState.isLoading}
							<span class="loading loading-sm loading-spinner"></span>
						{/if}
						{$t('common.save')}
					</button>
				</div>

				<!-- Modules Section -->
				<div class="divider"></div>
				<div class="flex items-center justify-between">
					<h3 class="text-lg font-semibold">{$t('modules.title')}</h3>
					<button
						class="btn btn-circle btn-ghost btn-xs btn-primary"
						onclick={() => addModuleDialogRef?.open()}
						disabled={!gameState.selectedGameId}
					>
						<Icon src={Plus} class="size-4" />
					</button>
				</div>
				{#if modulesLoading}
					<span class="loading loading-sm loading-spinner"></span>
				{:else if modulesError}
					<div class="alert alert-error py-2 text-sm">
						<span>{modulesError}</span>
						<button class="btn btn-xs" onclick={() => (modulesError = null)}>{$t('common.dismiss')}</button>
					</div>
				{:else if gameState.gameModules.length === 0}
					<p class="text-sm opacity-70">{$t('modules.no_modules')}</p>
				{:else}
					<ul class="divide-y divide-base-200">
						{#each gameState.gameModules as module}
							<li class="flex items-center gap-4 py-2">
								<div class="flex-1">
									<p class="leading-tight font-medium">{module.name}</p>
									<p class="text-xs opacity-70">
										<a href={module.url} target="_blank" rel="noopener noreferrer" class="link">
											{module.url}
										</a>
									</p>
								</div>
								<button
									class="btn btn-circle btn-ghost btn-xs btn-error"
									onclick={removeGameModule.bind(null, module.id, module.name)}
								>
									<Icon src={Trash} class="size-4" />
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title">
					<Icon src={AdjustmentsHorizontal} class="size-6 stroke-1" />
					{$t('users.title')}
					<button
						class="btn ml-auto btn-circle btn-ghost btn-xs btn-primary"
						onclick={() => addUserDialogRef?.open()}
						disabled={!gameState.selectedGameId}
					>
						<Icon src={Plus} class="size-4" />
					</button>
				</h2>
				{#if usersLoading}
					<span class="loading loading-sm loading-spinner"></span>
				{:else if usersError}
					<div class="alert alert-error py-2 text-sm">
						<span>{usersError}</span>
						<button class="btn btn-xs" onclick={() => (usersError = null)}>{$t('common.dismiss')}</button>
					</div>
				{:else if gameState.gameUsers.length === 0}
					<p class="text-sm opacity-70">{$t('users.no_users')}</p>
				{:else}
					<ul class="divide-y divide-base-200">
						{#each gameState.gameUsers as u}
							<li class="flex items-center gap-4 py-2">
								<div class="flex-1">
									<p class="leading-tight font-medium">{u.displayName}</p>
									<p class="text-xs opacity-70">{u.email}</p>
								</div>
								<button
									class="badge cursor-pointer badge-soft text-xs"
									onclick={() => selectAuthLevelDialogRef?.open(u.email, u.role)}>{u.role}</button
								>
								<button
									class="btn btn-circle btn-ghost btn-xs btn-error"
									onclick={removeGameUser.bind(null, u.email)}
								>
									<Icon src={Trash} class="size-4" />
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
		<AddUserDialog bind:this={addUserDialogRef} />
		<SelectAuthLevelDialog bind:this={selectAuthLevelDialogRef} />
		<AddModuleDialog bind:this={addModuleDialogRef} />
		<ConfirmDialog bind:this={confirmDialogRef} />
		<!-- Danger Card for Deleting Game -->
		<div class="card border border-error bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title text-error">{$t('settings.danger_zone')}</h2>
				<div class="flex justify-between">
					<p class="mb-2 text-sm opacity-80">
						{$t('settings.delete_warning')}
					</p>
					<button class="btn btn-outline btn-error" onclick={() => deleteDialogRef?.open()}>
						{$t('settings.delete_game')}
					</button>
				</div>
				<DeleteGameDialog bind:this={deleteDialogRef} />
			</div>
		</div>
	</div>
{/if}
