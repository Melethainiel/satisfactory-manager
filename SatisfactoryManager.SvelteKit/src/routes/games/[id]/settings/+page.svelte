<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getGameState } from '$lib/states/gameState.svelte';
	import { getAuthState } from '$lib/states/authState.svelte';
	import { getPermissionState } from '$lib/states/permissionState.svelte';
	import {
		AdjustmentsHorizontal,
		Icon,
		Identification,
		Map,
		PencilSquare,
		Plus,
		Trash
	} from 'svelte-hero-icons';
	import { notificationService } from '$lib/services/notificationService.svelte';
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
	const permissionState = getPermissionState();

	// Get the game ID from the route parameters
	const gameId = $page.params.id;

	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let editingName = $state('');
	let isDirty = $state(false);
	let saveError = $state<string | null>(null);
	let saveSuccess = $state(false);
	const usersLoading = $state(false);
	let usersError = $state<string | null>(null);
	const modulesLoading = $state(false);
	let modulesError = $state<string | null>(null);
	const sitesLoading = $state(false);
	const sitesError = $state<string | null>(null);

	// Dialog refs
	let createDialogRef: CreateGameDialogHandle | null = $state(null);
	let deleteDialogRef: DeleteGameDialogHandle | null = $state(null);
	let addUserDialogRef: AddUserDialogHandle | null = $state(null);
	let selectAuthLevelDialogRef: SelectAuthLevelDialogHandle | null = $state(null);
	let addModuleDialogRef: AddModuleDialogHandle | null = $state(null);
	let moduleVersionDialogRef: ModuleVersionDialogHandle | null = $state(null);
	let confirmDialogRef: ConfirmDialogHandle | null = $state(null);
	let createSiteDialogRef: CreateSiteDialogHandle | null = $state(null);
	let renameSiteDialogRef: RenameSiteDialogHandle | null = $state(null);

	// Initialize page and load game data
	onMount(async () => {
		// Wait for authentication to finish loading before checking auth state
		while (authState.isLoading) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		if (!authState.isAuthenticated) {
			await goto('/');
			return;
		}

		if (!gameId) {
			error = $t('game.invalid_game_id');
			isLoading = false;
			return;
		}

		try {
			// Check if the game exists in our loaded games
			let game = gameState.games.find((g) => g.id === gameId);
			if (!game) {
				// If game not found, reload games
				await gameState.loadGames(authState.user?.email ?? '');
				game = gameState.games.find((g) => g.id === gameId);
				if (!game) {
					error = $t('game.not_found');
					isLoading = false;
					return;
				}
			}

			// Select the game in state (for consistency with other components)
			gameState.selectGame(gameId);

			// Load game data first (needed for permission checks)
			await Promise.all([
				gameState.loadGameUsers(gameId),
				gameState.loadGameModules(gameId),
				gameState.loadGameSites(gameId)
			]);

			// Check permissions AFTER loading game data (so gameUsers is populated)
			if (!permissionState.canAccessSettings()) {
				error = $t('settings.access_denied_description');
				isLoading = false;
				return;
			}

			editingName = game.name;
		} catch (e: any) {
			console.error('Error loading game settings:', e);
			error = e?.message ?? $t('game.load_error');
		} finally {
			isLoading = false;
		}
	});

	// Get current game info
	const currentGame = $derived(gameState.games.find((g) => g.id === gameId));

	// Handle name input changes
	function handleNameInput(e: Event) {
		const v = (e.target as HTMLInputElement).value;
		editingName = v;
		const current = gameState.games.find((g) => g.id === gameId);
		isDirty = !!current && v.trim() !== current.name;
		saveSuccess = false;
		saveError = null;
	}

	// Save game name
	async function save() {
		if (!gameId) return;
		saveError = null;
		saveSuccess = false;

		try {
			await gameState.updateGame(gameId, editingName.trim());
			isDirty = false;
			saveSuccess = true;
			setTimeout(() => (saveSuccess = false), 3000);
		} catch (e: any) {
			saveError = e?.message ?? 'Failed to save';
		}
	}

	// Remove user from game
	async function removeGameUser(userEmail: string) {
		if (!gameId) return;

		// Check if this user is an Owner and if they are the last one
		const userToRemove = gameState.gameUsers.find((u) => u.email === userEmail);
		if (userToRemove?.role === 'Owner') {
			const ownerCount = gameState.gameUsers.filter((u) => u.role === 'Owner').length;
			if (ownerCount <= 1) {
				// Show error notification - can't remove the last owner
				notificationService.error($t('users.cannot_remove_last_owner'));
				return;
			}
		}

		// Show confirmation dialog before removing user
		confirmDialogRef?.open({
			title: $t('users.remove_user'),
			message: $t('users.remove_user_confirm').replace('{email}', userEmail),
			type: 'danger',
			onConfirm: async () => {
				try {
					await gameState.removeGameUser(gameId, userEmail);
					// Refresh the users list after removal
					await gameState.loadGameUsers(gameId);
				} catch (e: any) {
					console.error('Failed to remove user:', e);
				}
			}
		});
	}

	// Remove module from game
	async function removeGameModule(moduleId: string, moduleName: string) {
		if (!gameId) return;

		confirmDialogRef?.open({
			title: $t('modules.remove_module'),
			message: `Are you sure you want to remove the module "${moduleName}" from this game?`,
			type: 'danger',
			onConfirm: async () => {
				try {
					await gameState.removeGameModule(gameId, moduleId);
				} catch (e: any) {
					console.error('Failed to remove module:', e);
				}
			}
		});
	}

	// Remove site
	async function removeSite(siteId: string, siteName: string) {
		if (!gameId) return;

		confirmDialogRef?.open({
			title: $t('sites.delete_site'),
			message: `Are you sure you want to delete the site "${siteName}"? This action cannot be undone.`,
			type: 'danger',
			onConfirm: async () => {
				try {
					await gameState.deleteGameSite(gameId, siteId);
				} catch (e: any) {
					console.error('Failed to remove site:', e);
				}
			}
		});
	}
</script>

<svelte:head>
	<title
		>Satisfactory Manager | {$t('settings.title')} - {currentGame?.name ??
			$t('common.loading')}</title
	>
</svelte:head>

{#if !authState.isAuthenticated}
	<div class="py-8 text-center">
		<p class="text-lg opacity-70">{$t('auth.sign_in_required')}</p>
	</div>
{:else if isLoading}
	<div class="py-8 text-center">
		<span class="loading loading-lg loading-spinner"></span>
		<p class="mt-4 text-lg opacity-70">{$t('common.loading')}</p>
	</div>
{:else if error}
	<div class="py-8 text-center">
		<div class="mx-auto alert max-w-md alert-error">
			<span>{error}</span>
		</div>
		<button class="btn mt-4 btn-primary" onclick={() => goto('/')}>
			{$t('nav.back_to_home')}
		</button>
	</div>
{:else if !currentGame}
	<div class="py-8 text-center">
		<p class="text-lg opacity-70">{$t('game.not_found')}</p>
		<button class="btn mt-4 btn-primary" onclick={() => goto('/')}>
			{$t('nav.back_to_home')}
		</button>
	</div>
{:else}
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-8">
			<h1 class="mb-4 flex items-center gap-3 text-3xl font-bold">
				<Icon src={AdjustmentsHorizontal} class="size-8" />
				{$t('settings.title')} - {currentGame.name}
			</h1>
		</div>

		<!-- Game Info Section -->
		<div class="card mb-8 bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title flex items-center gap-2">
					<Icon src={Identification} class="size-5" />
					{$t('settings.game_info')}
				</h2>

				<div class="form-control w-full max-w-xs">
					<label for="game-name" class="label">
						<span class="label-text">{$t('settings.name')}</span>
					</label>
					<input
						id="game-name"
						type="text"
						class="input-bordered input w-full max-w-xs"
						bind:value={editingName}
						oninput={handleNameInput}
						placeholder={$t('game.game_name')}
					/>
				</div>

				{#if saveError}
					<div class="alert alert-error">
						<span>{saveError}</span>
					</div>
				{/if}

				{#if saveSuccess}
					<div class="alert alert-success">
						<span>{$t('settings.saved')}</span>
					</div>
				{/if}

				<div class="card-actions justify-end">
					<button class="btn btn-primary" disabled={!isDirty} onclick={save}>
						{$t('common.save')}
					</button>
				</div>
			</div>
		</div>

		<!-- Users Section -->
		<div class="card mb-8 bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title">
					<Icon src={AdjustmentsHorizontal} class="size-6 stroke-1" />
					{$t('users.title')}
					<button
						class="btn ml-auto btn-circle btn-ghost btn-xs btn-primary"
						onclick={() => addUserDialogRef?.open()}
						disabled={!gameId}
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
							<li class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 sm:py-2">
								<div class="flex-1 min-w-0">
									<p class="font-medium truncate">{u.displayName}</p>
									<p class="text-xs text-base-content/70 truncate">{u.email}</p>
								</div>
								<div class="flex items-center gap-2 ml-auto sm:ml-0">
									<button
										class="badge cursor-pointer badge-soft text-xs min-h-[44px] min-w-[44px]"
										onclick={() => selectAuthLevelDialogRef?.open(u.email, u.role)}>{u.role}</button
									>
									<button
										class="btn btn-circle btn-ghost btn-xs btn-error min-h-[44px] min-w-[44px]"
										onclick={() => removeGameUser(u.email)}
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

		<!-- Modules Section -->
		<div class="card mb-8 bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title">
					<Icon src={AdjustmentsHorizontal} class="size-6 stroke-1" />
					{$t('modules.title')}
					<button
						class="btn ml-auto btn-circle btn-ghost btn-xs btn-primary"
						onclick={() => addModuleDialogRef?.open()}
						disabled={!gameId}
					>
						<Icon src={Plus} class="size-4" />
					</button>
				</h2>
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
						{#each gameState.gameModules as mod}
							<li class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 sm:py-2">
								<div class="flex-1 min-w-0">
									<p class="font-medium truncate">{mod.name}</p>
									{#if mod.githubRepo}
										<p class="text-xs text-base-content/70 truncate break-all">{mod.githubRepo}</p>
									{/if}
								</div>
								<div class="flex items-center gap-2 ml-auto sm:ml-0">
									<button
										class="badge cursor-pointer badge-soft text-xs min-h-[44px] min-w-[44px]"
										onclick={() => moduleVersionDialogRef?.open(mod)}
										class:badge-warning={mod.selectedVersion &&
											mod.selectedVersion !== mod.currentVersion}
									>
										{mod.selectedVersion || mod.currentVersion || 'No version'}
									</button>
									<button
										class="btn btn-circle btn-ghost btn-xs btn-error min-h-[44px] min-w-[44px]"
										onclick={() => removeGameModule(mod.id, mod.name)}
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

		<!-- Sites Section -->
		<div class="card mb-8 bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title flex items-center justify-between">
					<div class="flex items-center gap-2">
						<Icon src={Map} class="size-5" />
						{$t('sites.title')}
					</div>
					<button
						class="btn btn-circle btn-ghost btn-xs btn-primary"
						onclick={() => createSiteDialogRef?.open()}
						disabled={!gameId}
					>
						<Icon src={Plus} class="size-4" />
					</button>
				</h2>

				{#if sitesError}
					<div class="alert alert-error">
						<span>{sitesError}</span>
					</div>
				{/if}

				{#if sitesLoading}
					<div class="flex justify-center py-4">
						<span class="loading loading-sm loading-spinner"></span>
					</div>
				{:else if gameState.gameSites.length === 0}
					<p class="text-base-content/70">{$t('sites.no_sites')}</p>
				{:else}
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
						{#each gameState.gameSites as site}
							<div class="card bg-base-200 shadow-sm">
								<div class="card-body p-3 sm:p-4 lg:p-6">
									<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
										<h3 class="card-title text-base truncate min-w-0 flex-1">{site.name}</h3>
										<div class="card-actions gap-1 ml-auto sm:ml-0">
											<button
												class="btn btn-ghost btn-xs min-h-[44px] min-w-[44px]"
												onclick={() => renameSiteDialogRef?.open(site.id, site.name)}
											>
												<Icon src={PencilSquare} class="size-3" />
											</button>
											<button
												class="btn text-error btn-ghost btn-xs min-h-[44px] min-w-[44px]"
												onclick={() => removeSite(site.id, site.name)}
											>
												<Icon src={Trash} class="size-3" />
											</button>
										</div>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Danger Zone -->
		<div class="card border-error bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title text-error">
					<Icon src={Trash} class="size-5" />
					{$t('settings.danger_zone')}
				</h2>
				<p class="text-sm opacity-70">{$t('settings.delete_warning')}</p>
				<div class="card-actions">
					<button class="btn btn-error" onclick={() => deleteDialogRef?.open()}>
						{$t('settings.delete_game')}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Dialogs -->
<CreateGameDialog bind:this={createDialogRef} />
<DeleteGameDialog bind:this={deleteDialogRef} />
<AddUserDialog bind:this={addUserDialogRef} />
<SelectAuthLevelDialog bind:this={selectAuthLevelDialogRef} />
<AddModuleDialog bind:this={addModuleDialogRef} />
<ModuleVersionDialog bind:this={moduleVersionDialogRef} />
<ConfirmDialog bind:this={confirmDialogRef} />
<CreateSiteDialog bind:this={createSiteDialogRef} />
<RenameSiteDialog bind:this={renameSiteDialogRef} />
