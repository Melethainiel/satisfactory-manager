<script lang="ts">
	import { getGameState } from '$lib/states/gameState.svelte';
	import { getAuthState } from '$lib/states/authState.svelte';
	import {
		Icon,
		Identification,
		AdjustmentsHorizontal,
		Trash,
		Plus,
		Cog6Tooth,
		PencilSquare,
		Map
	} from 'svelte-hero-icons';
	import { t } from '$lib/i18n';
	import CreateGameDialog from '$lib/dialogs/CreateGameDialog.svelte';
	import type { CreateGameDialogHandle } from '$lib/dialogs/CreateGameDialogHandle';
	import DeleteGameDialog from '$lib/dialogs/DeleteGameDialog.svelte';
	import type { DeleteGameDialogHandle } from '$lib/dialogs/DeleteGameDialogHandle';
	import AddUserDialog from '$lib/dialogs/AddUserDialog.svelte';
	import type { AddUserDialogHandle } from '$lib/dialogs/AddUserDialogHandle';
	import SelectAuthLevelDialog from '$lib/dialogs/SelectAuthLevelDialog.svelte';
	import type { SelectAuthLevelDialogHandle } from '$lib/dialogs/SelectAuthLevelDialogHandle';
	import AddModuleDialog from '$lib/dialogs/AddModuleDialog.svelte';
	import type { AddModuleDialogHandle } from '$lib/dialogs/AddModuleDialogHandle';
	import ModuleVersionDialog from '$lib/dialogs/ModuleVersionDialog.svelte';
	import type { ModuleVersionDialogHandle } from '$lib/dialogs/ModuleVersionDialogHandle';
	import ConfirmDialog from '$lib/dialogs/ConfirmDialog.svelte';
	import type { ConfirmDialogHandle } from '$lib/dialogs/ConfirmDialogHandle';
	import CreateSiteDialog from '$lib/dialogs/CreateSiteDialog.svelte';
	import type { CreateSiteDialogHandle } from '$lib/dialogs/CreateSiteDialogHandle';
	import RenameSiteDialog from '$lib/dialogs/RenameSiteDialog.svelte';
	import type { RenameSiteDialogHandle } from '$lib/dialogs/RenameSiteDialogHandle';

	const gameState = getGameState();
	const authState = getAuthState();

	// Check if user can access settings (Administrator/Owner only)
	let canAccessSettings = $derived(() => {
		if (!authState.isAuthenticated || !authState.user?.email || !gameState.selectedGameId)
			return false;
		return gameState.canManageSettings(authState.user.email);
	});

	let editingName = $state('');
	let isDirty = $state(false);
	let saveError = $state<string | null>(null);
	let saveSuccess = $state(false);
	let usersLoading = $state(false);
	let usersError = $state<string | null>(null);
	let modulesLoading = $state(false);
	let modulesError = $state<string | null>(null);
	let sitesLoading = $state(false);
	let sitesError = $state<string | null>(null);

	// Delete dialog ref
	let deleteDialogRef: DeleteGameDialogHandle | null = $state(null);
	let addUserDialogRef: AddUserDialogHandle | null = $state(null);
	let selectAuthLevelDialogRef: SelectAuthLevelDialogHandle | null = $state(null);
	let addModuleDialogRef: AddModuleDialogHandle | null = $state(null);
	let moduleVersionDialogRef: ModuleVersionDialogHandle | null = $state(null);
	let confirmDialogRef: ConfirmDialogHandle | null = $state(null);
	let createSiteDialogRef: CreateSiteDialogHandle | null = $state(null);
	let renameSiteDialogRef: RenameSiteDialogHandle | null = $state(null);

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
			modulesLoading = false;
		})();
	});

	$effect(() => {
		// Load sites whenever selectedGameId changes
		const id = gameState.selectedGameId;
		if (!id) {
			gameState.gameSites = [];
			return;
		}
		(async () => {
			sitesLoading = true;
			sitesError = null;
			await gameState.loadGameSites(id);
			sitesLoading = false;
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
		saveSuccess = true;
		isDirty = false;
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

	function handleRenameSite(siteId: string, currentName: string) {
		renameSiteDialogRef?.open(siteId, currentName);
	}

	async function removeSite(siteId: string, siteName: string) {
		const gameId = gameState.selectedGameId;
		if (!gameId) return;

		confirmDialogRef?.open({
			title: $t('sites.delete_site'),
			message: $t('sites.delete_site_confirm', { values: { name: siteName } }),
			confirmText: $t('sites.delete_site'),
			type: 'danger',
			onConfirm: async () => {
				await gameState.deleteGameSite(gameId, siteId);
				// refresh local sites list
				await gameState.loadGameSites(gameId);
			}
		});
	}

	// Check if user has contributor+ role
	let canManageSites = $derived(() => {
		if (!authState.isAuthenticated || !authState.user?.email) return false;
		return gameState.canManageSites(authState.user.email);
	});

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
		<button class="btn btn-primary" onclick={() => createDialogRef?.open()}
			>{$t('settings.create_new_game')}</button
		>
		<CreateGameDialog bind:this={createDialogRef} />
	</div>
{:else if !canAccessSettings}
	<div class="mt-12 flex flex-col items-center gap-4">
		<div class="alert max-w-md alert-warning">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6 shrink-0 stroke-current"
				fill="none"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 15.5c-.77.833.192 2.5 1.732 2.5z"
				/>
			</svg>
			<span>{$t('settings.access_denied')}</span>
		</div>
		<p class="text-center opacity-70">{$t('settings.access_denied_description')}</p>
	</div>
{:else}
	<div class="grid grid-cols-1 gap-6">
		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title">
					<Icon src={Identification} class="size-6 stroke-1" />
					{$t('settings.game_info')}
				</h2>
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
						<button class="btn btn-xs" onclick={() => (modulesError = null)}
							>{$t('common.dismiss')}</button
						>
					</div>
				{:else if gameState.gameModules.length === 0}
					<p class="text-sm opacity-70">{$t('modules.no_modules')}</p>
				{:else}
					<ul class="divide-y divide-base-200">
						{#each gameState.gameModules as module}
							<li class="flex items-center gap-4 py-2">
								<div class="flex-1">
									<div class="flex items-center gap-2">
										<p class="leading-tight font-medium">{module.name}</p>
										{#if module.currentVersion}
											<span class="badge badge-outline badge-sm">v{module.currentVersion}</span>
										{/if}
									</div>
									<p class="text-xs opacity-70">
										<a href={module.url} target="_blank" rel="noopener noreferrer" class="link">
											{module.url}
										</a>
									</p>
									{#if module.githubRepo}
										<p class="text-xs opacity-50">
											GitHub: <a
												href={module.githubRepo}
												target="_blank"
												rel="noopener noreferrer"
												class="link"
											>
												{module.githubRepo}
											</a>
										</p>
									{/if}
								</div>
								<div class="flex gap-1">
									<button
										class="btn btn-circle btn-ghost btn-xs"
										onclick={() => moduleVersionDialogRef?.open(module)}
										title="Manage versions"
									>
										<Icon src={Cog6Tooth} class="size-4" />
									</button>
									<button
										class="btn btn-circle btn-ghost btn-xs btn-error"
										onclick={removeGameModule.bind(null, module.id, module.name)}
									>
										<Icon src={Trash} class="size-4" />
									</button>
								</div>
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
						<button class="btn btn-xs" onclick={() => (usersError = null)}
							>{$t('common.dismiss')}</button
						>
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

		<!-- Sites Section -->
		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title">
					<Icon src={Map} class="size-6 stroke-1" />
					{$t('sites.title')}
					{#if canManageSites()}
						<button
							class="btn ml-auto btn-circle btn-ghost btn-xs btn-primary"
							onclick={() => createSiteDialogRef?.open()}
							disabled={!gameState.selectedGameId}
						>
							<Icon src={Plus} class="size-4" />
						</button>
					{/if}
				</h2>
				{#if sitesLoading}
					<span class="loading loading-sm loading-spinner"></span>
				{:else if sitesError}
					<div class="alert alert-error py-2 text-sm">
						<span>{sitesError}</span>
						<button class="btn btn-xs" onclick={() => (sitesError = null)}
							>{$t('common.dismiss')}</button
						>
					</div>
				{:else if gameState.gameSites.length === 0}
					<div class="py-4 text-center">
						<p class="mb-4 text-sm opacity-70">{$t('sites.no_sites')}</p>
						{#if canManageSites()}
							<button class="btn btn-sm btn-primary" onclick={() => createSiteDialogRef?.open()}>
								{$t('sites.create_first_site')}
							</button>
						{/if}
					</div>
				{:else}
					<ul class="divide-y divide-base-200">
						{#each gameState.gameSites as site}
							<li class="flex items-center gap-4 py-2">
								<div class="flex-1">
									<p class="leading-tight font-medium">{site.name}</p>
									<p class="text-xs opacity-50">
										{$t('common.created')}: {new Date(site.createdAt).toLocaleDateString()}
									</p>
								</div>
								{#if canManageSites()}
									<div class="flex gap-1">
										<button
											class="btn btn-circle btn-ghost btn-xs"
											onclick={() => handleRenameSite(site.id, site.name)}
											title={$t('sites.rename_site')}
										>
											<Icon src={PencilSquare} class="size-4" />
										</button>
										{#if gameState.gameSites.length > 1}
											<button
												class="btn btn-circle btn-ghost btn-xs btn-error"
												onclick={() => removeSite(site.id, site.name)}
												title={$t('sites.delete_site')}
											>
												<Icon src={Trash} class="size-4" />
											</button>
										{/if}
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>

		<AddUserDialog bind:this={addUserDialogRef} />
		<SelectAuthLevelDialog bind:this={selectAuthLevelDialogRef} />
		<AddModuleDialog bind:this={addModuleDialogRef} />
		<ModuleVersionDialog bind:this={moduleVersionDialogRef} />
		<CreateSiteDialog bind:this={createSiteDialogRef} />
		<RenameSiteDialog bind:this={renameSiteDialogRef} />
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
