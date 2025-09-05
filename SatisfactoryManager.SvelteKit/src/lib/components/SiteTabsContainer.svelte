<script lang="ts">
	import { getGameState } from '$lib/states/gameState.svelte';
	import { getAuthState } from '$lib/states/authState.svelte';
	import { Icon, PencilSquare, Plus, Trash } from 'svelte-hero-icons';
	import { t } from '$lib/i18n';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import CreateSiteDialog from '$lib/dialogs/CreateSiteDialog.svelte';
	import type { CreateSiteDialogHandle } from '$lib/dialogs/CreateSiteDialogHandle';
	import RenameSiteDialog from '$lib/dialogs/RenameSiteDialog.svelte';
	import type { RenameSiteDialogHandle } from '$lib/dialogs/RenameSiteDialogHandle';
	import ConfirmDialog from '$lib/dialogs/ConfirmDialog.svelte';
	import type { ConfirmDialogHandle } from '$lib/dialogs/ConfirmDialogHandle';
	import SiteProductionOverview from './SiteProductionOverview.svelte';
	import OnlineUsersIndicator from './OnlineUsersIndicator.svelte';

	const gameState = getGameState();
	const authState = getAuthState();

	let createSiteDialogRef: CreateSiteDialogHandle | null = $state(null);
	let renameSiteDialogRef: RenameSiteDialogHandle | null = $state(null);
	let confirmDialogRef: ConfirmDialogHandle | null = $state(null);

	// Generate unique radio group name based on game ID
	const tabGroupName = $derived(() => `site_tabs_${gameState.selectedGameId || 'default'}`);

	// Check if current user has contributor+ permissions
	const canManageSites = $derived(() => {
		if (!authState.isAuthenticated || !authState.user?.email) return false;
		return gameState.canManageSites(authState.user.email);
	});

	function handleSiteSelect(siteId: string) {
		gameState.selectSite(siteId);
	}

	function handleRenameSite(siteId: string, currentName: string) {
		renameSiteDialogRef?.open(siteId, currentName);
	}

	function handleDeleteSite(siteId: string, siteName: string) {
		if (!gameState.selectedGameId) return;

		confirmDialogRef?.open({
			title: $t('sites.delete_site'),
			message: $t('sites.delete_site_confirm', { values: { name: siteName } }),
			confirmText: $t('sites.delete_site'),
			type: 'danger',
			onConfirm: async () => {
				await gameState.deleteGameSite(gameState.selectedGameId!, siteId);
			}
		});
	}
</script>

<div class="flex flex-col gap-4">
	<!-- Empty state when no sites -->
	{#if gameState.gameSites.length === 0}
		<div class="py-8 text-center">
			<p class="mb-4 text-base-content/70">{$t('sites.no_sites')}</p>
			{#if canManageSites()}
				<button class="btn btn-primary" onclick={() => createSiteDialogRef?.open()}>
					{$t('sites.create_first_site')}
				</button>
			{/if}
		</div>
	{:else}
		<!-- Site Tabs with Add Button Header -->
		<div class="flex items-center justify-between gap-2">
			<h3 class="text-lg font-semibold">{$t('sites.title')}</h3>
			{#if canManageSites()}
				<!-- Add Site Button -->
				<button
					class="btn btn-circle btn-ghost btn-sm"
					onclick={() => createSiteDialogRef?.open()}
					title={$t('sites.create_site')}
				>
					<Icon src={Plus} class="size-4" />
				</button>
			{/if}
		</div>

		<!-- Radio Tab Navigation -->
		<div class="tabs overflow-x-auto tabs-box">
			{#each gameState.gameSites as site, index (site.id)}
				<input
					type="radio"
					name={tabGroupName()}
					class="tab flex-shrink-0 text-ellipsis whitespace-nowrap transition-all duration-200 ease-in-out hover:bg-base-200"
					aria-label={site.name}
					checked={gameState.selectedSiteId === site.id}
					onchange={() => handleSiteSelect(site.id)}
					in:fly={{ x: -10, duration: 200, delay: index * 30 }}
					out:fade={{ duration: 100 }}
				/>
			{/each}
		</div>

		<!-- Site Content Area -->
		<div class="relative min-h-[200px]">
			{#if gameState.selectedSiteId}
				{@const selectedSite = gameState.gameSites.find((s) => s.id === gameState.selectedSiteId)}
				{#if selectedSite}
					{#key selectedSite.id}
						<div
							class="relative rounded-lg border border-base-300 bg-base-100 p-6"
							in:fly={{ y: 20, duration: 300, easing: cubicOut, delay: 150 }}
							out:fade={{ duration: 150 }}
						>
							<!-- Site Management Buttons -->
							{#if canManageSites()}
								<div
									class="absolute top-2 right-2 flex gap-1"
									in:fade={{ duration: 200, delay: 250 }}
								>
									<button
										class="btn btn-circle btn-ghost btn-xs"
										onclick={() => handleRenameSite(selectedSite.id, selectedSite.name)}
										title={$t('sites.rename_site')}
									>
										<Icon src={PencilSquare} class="size-3" />
									</button>

									{#if gameState.gameSites.length > 1}
										<button
											class="btn btn-circle btn-ghost btn-xs btn-error"
											onclick={() => handleDeleteSite(selectedSite.id, selectedSite.name)}
											title={$t('sites.delete_site')}
										>
											<Icon src={Trash} class="size-3" />
										</button>
									{/if}
								</div>
							{/if}

							<!-- Site Content -->
							<div in:fade={{ duration: 250, delay: 200 }}>
								<!-- Site title and online users -->
								<div class="mb-4 flex items-center justify-between">
									<h2 class="text-xl font-semibold">{selectedSite.name}</h2>
									<OnlineUsersIndicator siteId={selectedSite.id} showActivity={true} />
								</div>

								<SiteProductionOverview siteId={selectedSite.id} siteName={selectedSite.name} />
							</div>
						</div>
					{/key}
				{/if}
			{/if}
		</div>
	{/if}
</div>

<!-- Dialogs -->
<CreateSiteDialog bind:this={createSiteDialogRef} />
<RenameSiteDialog bind:this={renameSiteDialogRef} />
<ConfirmDialog bind:this={confirmDialogRef} />
