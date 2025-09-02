<script lang="ts">
	import { getAuthState } from '$lib/states/authState.svelte';
	import { getGameState } from '$lib/states/gameState.svelte';
	import { t } from '$lib/i18n';
	import { apiService } from '$lib/services/apiService';

	interface ModuleVersion {
		id: string;
		version: string;
		releaseUrl: string | null;
		releaseNotes: string | null;
		publishedAt: Date | null;
		createdAt: Date;
	}

	interface Module {
		id: string;
		name: string;
		url: string;
		currentVersion: string | null;
		selectedVersion: string | null;
		selectedVersionId: string | null;
		githubRepo: string | null;
		createdAt: Date;
		updatedAt: Date;
	}

	const authState = getAuthState();
	const gameState = getGameState();

	let { module, context = 'game' }: { module: Module; context?: 'game' | 'admin' } = $props();

	let versions = $state<ModuleVersion[]>([]);
	let isLoading = $state(false);
	let isSyncing = $state(false);
	let isUpdatingVersion = $state(false);
	let error = $state<string | null>(null);
	let versionContentStatus = $state<Record<string, { hasContent: boolean; canImport: boolean }>>(
		{}
	);
	let importingVersions = $state<Set<string>>(new Set());
	let importResults = $state<Record<string, { importResult: any }>>({});
	let showImportDetails = $state<Record<string, boolean>>({});

	async function loadVersions() {
		if (!authState.isAuthenticated) return;

		isLoading = true;
		error = null;

		try {
			versions = await apiService.get<ModuleVersion[]>(`/api/modules/${module.id}/versions`);
			// Load content status for all versions
			await loadVersionsContentStatus();
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to load versions';
		} finally {
			isLoading = false;
		}
	}

	async function loadVersionsContentStatus() {
		if (!authState.isAuthenticated || versions.length === 0) return;

		try {
			// Use batch endpoint for better performance
			const batchData = await apiService.get(`/api/modules/${module.id}/versions/content-status`, {
				showErrorNotification: false
			});

			if (batchData.contentStatus) {
				// Update the status record with batch results
				versionContentStatus = batchData.contentStatus;
			}
		} catch (e: unknown) {
			console.error('Failed to load versions content status:', e);
			// Fallback to individual requests if batch fails
			await loadVersionsContentStatusIndividual();
		}
	}

	// Fallback method for individual status requests (kept for reliability)
	async function loadVersionsContentStatusIndividual() {
		if (!authState.isAuthenticated || versions.length === 0) return;

		try {
			// Load content status for all versions in parallel
			const statusPromises = versions.map(async (version) => {
				try {
					const statusData = await apiService.get(
						`/api/modules/${module.id}/versions/${version.id}/content-status`,
						{ showErrorNotification: false }
					);
					return {
						versionId: version.id,
						hasContent: statusData.hasContent,
						canImport: statusData.canImport
					};
				} catch (error) {
					console.warn(`Failed to load content status for version ${version.id}:`, error);
				}
				return {
					versionId: version.id,
					hasContent: false,
					canImport: false
				};
			});

			const statusResults = await Promise.all(statusPromises);

			// Update the status record
			const newStatus: Record<string, { hasContent: boolean; canImport: boolean }> = {};
			statusResults.forEach((status) => {
				newStatus[status.versionId] = {
					hasContent: status.hasContent,
					canImport: status.canImport
				};
			});
			versionContentStatus = newStatus;
		} catch (e: unknown) {
			console.error('Failed to load individual versions content status:', e);
		}
	}

	async function syncFromGitHub() {
		if (!authState.isAuthenticated || !module.githubRepo) return;

		isSyncing = true;
		error = null;

		try {
			await apiService.post(`/api/modules/${module.id}/sync-versions`);

			// Reload versions to get the updated list
			await loadVersions();
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to sync versions from GitHub';
		} finally {
			isSyncing = false;
		}
	}

	async function setGameModuleVersion(versionId: string) {
		if (!authState.isAuthenticated || !gameState.selectedGameId) return;

		isUpdatingVersion = true;
		error = null;

		try {
			await gameState.setGameModuleVersion(gameState.selectedGameId, module.id, versionId);

			// Find the version that was selected to update the module object
			const selectedVersionObj = versions.find((v) => v.id === versionId);
			if (selectedVersionObj) {
				module.selectedVersion = selectedVersionObj.version;
				module.selectedVersionId = versionId;
			}
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to update module version for this game';
		} finally {
			isUpdatingVersion = false;
		}
	}

	async function importVersionContent(versionId: string) {
		if (!authState.isAuthenticated) return;

		// Add to importing set
		const newImportingVersions = new Set(importingVersions);
		newImportingVersions.add(versionId);
		importingVersions = newImportingVersions;
		error = null;

		try {
			const importResult = await apiService.post(
				`/api/modules/${module.id}/versions/${versionId}/import`
			);

			// Update content status for this version
			versionContentStatus = {
				...versionContentStatus,
				[versionId]: {
					...versionContentStatus[versionId],
					hasContent: true
				}
			};

			// Store import results for display
			importResults = {
				...importResults,
				[versionId]: importResult
			};
			console.log('Version content imported successfully:', importResult);
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to import version content';
		} finally {
			// Remove from importing set
			const newImportingVersions = new Set(importingVersions);
			newImportingVersions.delete(versionId);
			importingVersions = newImportingVersions;
		}
	}

	function toggleImportDetails(versionId: string) {
		showImportDetails = {
			...showImportDetails,
			[versionId]: !showImportDetails[versionId]
		};
	}

	// Load versions when component mounts or module changes
	$effect(() => {
		loadVersions();
	});
</script>

<div class="rounded-lg border border-base-300 p-4">
	<div class="mb-4 flex items-center justify-between">
		<h3 class="text-lg font-semibold">{$t('dialogs.module_version.version_management')}</h3>
		<div class="flex gap-2">
			<button class="btn btn-sm" onclick={loadVersions} disabled={isLoading}>
				{#if isLoading}
					<span class="loading loading-sm loading-spinner"></span>
				{:else}
					{$t('dialogs.module_version.refresh')}
				{/if}
			</button>
			{#if module.githubRepo}
				<button
					class="btn btn-sm btn-primary"
					onclick={syncFromGitHub}
					disabled={isSyncing || isLoading}
				>
					{#if isSyncing}
						<span class="loading loading-sm loading-spinner"></span>
					{:else}
						{$t('dialogs.module_version.sync_from_github')}
					{/if}
				</button>
			{/if}
		</div>
	</div>

	{#if error}
		<div class="mb-4 alert alert-error py-2 text-sm">
			<span>{error}</span>
		</div>
	{/if}

	<div class="mb-4 space-y-3">
		{#if module.currentVersion}
			<div class="rounded bg-base-200 p-3">
				<div class="text-sm font-medium">{$t('dialogs.module_version.current_version')}</div>
				<div class="font-mono text-lg">{module.currentVersion}</div>
				<div class="text-xs opacity-70">{$t('dialogs.module_version.global_version_info')}</div>
			</div>
		{/if}

		{#if context === 'game'}
			{#if module.selectedVersion}
				<div class="rounded bg-primary/10 p-3">
					<div class="text-sm font-medium">
						{$t('dialogs.module_version.selected_version_for_game')}
					</div>
					<div class="flex items-center gap-2">
						<div class="font-mono text-lg">{module.selectedVersion}</div>
						{#if module.selectedVersion !== module.currentVersion}
							<span class="badge badge-sm badge-warning"
								>{$t('dialogs.module_version.different_version')}</span
							>
						{/if}
					</div>
				</div>
			{:else}
				<div class="rounded bg-warning/10 p-3">
					<div class="text-sm font-medium">{$t('dialogs.module_version.no_version_selected')}</div>
					<div class="text-xs opacity-70">{$t('dialogs.module_version.select_version_info')}</div>
				</div>
			{/if}
		{/if}
	</div>

	{#if isLoading}
		<div class="flex justify-center py-8">
			<span class="loading loading-lg loading-spinner"></span>
		</div>
	{:else if versions.length === 0}
		<div class="py-8 text-center text-gray-500">
			<div class="mb-2">{$t('dialogs.module_version.no_versions')}</div>
			{#if module.githubRepo}
				<div class="text-sm">{$t('dialogs.module_version.sync_github_hint')}</div>
			{/if}
		</div>
	{:else}
		<div class="space-y-2">
			{#each versions as version (version.id)}
				<div class="flex items-center justify-between rounded border border-base-300 p-3">
					<div class="flex-1">
						<div class="flex items-center gap-2">
							<span class="font-mono font-medium">{version.version}</span>
							{#if version.version === module.currentVersion}
								<span class="badge badge-sm badge-neutral"
									>{$t('dialogs.module_version.current_badge')}</span
								>
							{/if}
							{#if version.id === module.selectedVersionId}
								<span class="badge badge-sm badge-primary"
									>{$t('dialogs.module_version.selected_for_game')}</span
								>
							{/if}
							{#if versionContentStatus[version.id]?.hasContent}
								<span class="badge badge-sm badge-success"
									>{$t('dialogs.module_version.imported_badge')}</span
								>
							{/if}
						</div>
						{#if version.publishedAt}
							<div class="text-sm opacity-70">
								{$t('dialogs.module_version.published')}: {new Date(
									version.publishedAt
								).toLocaleDateString()}
							</div>
						{/if}
						{#if version.releaseNotes}
							<div class="mt-1 line-clamp-2 text-sm opacity-70">
								{version.releaseNotes}
							</div>
						{/if}
					</div>
					<div class="flex gap-2">
						{#if version.releaseUrl}
							<a
								href={version.releaseUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="btn btn-ghost btn-sm"
							>
								{$t('dialogs.module_version.view_release')}
							</a>
						{/if}
						<!-- Import button for versions with release URLs -->
						{#if versionContentStatus[version.id]?.canImport}
							{#if versionContentStatus[version.id]?.hasContent}
								<button class="btn btn-sm btn-success" disabled>
									{$t('dialogs.module_version.already_imported')}
								</button>
							{:else}
								<button
									class="btn btn-sm btn-secondary"
									onclick={() => importVersionContent(version.id)}
									disabled={importingVersions.has(version.id)}
								>
									{#if importingVersions.has(version.id)}
										<span class="loading loading-sm loading-spinner"></span>
										{$t('dialogs.module_version.importing')}
									{:else}
										{$t('dialogs.module_version.import_version')}
									{/if}
								</button>
							{/if}
						{/if}
						{#if context === 'game'}
							{#if version.id !== module.selectedVersionId}
								<button
									class="btn btn-sm btn-primary"
									onclick={() => setGameModuleVersion(version.id)}
									disabled={isUpdatingVersion}
								>
									{#if isUpdatingVersion}
										<span class="loading loading-sm loading-spinner"></span>
									{:else}
										{$t('dialogs.module_version.select_for_game')}
									{/if}
								</button>
							{:else}
								<button class="btn btn-sm btn-success" disabled>
									{$t('dialogs.module_version.selected')}
								</button>
							{/if}
						{/if}
					</div>
				</div>

				<!-- Import Results Display -->
				{#if importResults[version.id]}
					{@const result = importResults[version.id].importResult}
					<div class="mt-2 ml-4 rounded border-l-4 border-primary bg-base-200 p-3">
						<div class="flex items-center justify-between">
							<h4 class="font-semibold">{$t('dialogs.module_version.import_results')}</h4>
							<button class="btn btn-ghost btn-xs" onclick={() => toggleImportDetails(version.id)}>
								{#if showImportDetails[version.id]}
									{$t('dialogs.module_version.hide_details')}
								{:else}
									{$t('dialogs.module_version.show_details')}
								{/if}
							</button>
						</div>

						<!-- Summary -->
						<div class="mt-2 grid grid-cols-3 gap-4 text-sm">
							<div class="text-center">
								<div class="text-2xl font-bold text-success">
									{result.items.created + result.items.updated}
								</div>
								<div class="text-xs opacity-70">{$t('dialogs.module_version.items_processed')}</div>
							</div>
							<div class="text-center">
								<div class="text-2xl font-bold text-success">
									{result.buildings.created + result.buildings.updated}
								</div>
								<div class="text-xs opacity-70">
									{$t('dialogs.module_version.buildings_processed')}
								</div>
							</div>
							<div class="text-center">
								<div class="text-2xl font-bold text-success">
									{result.recipes.created + result.recipes.updated}
								</div>
								<div class="text-xs opacity-70">
									{$t('dialogs.module_version.recipes_processed')}
								</div>
							</div>
						</div>

						<!-- Errors Section -->
						{#if result.errors && result.errors.length > 0}
							<div class="mt-3 alert alert-warning py-2">
								<div class="flex items-center gap-2">
									<span class="font-semibold"
										>{$t('dialogs.module_version.errors_found')}: {result.errors.length}</span
									>
								</div>
							</div>

							{#if showImportDetails[version.id]}
								<div class="mt-2 space-y-1">
									{#each result.errors as error, index (index)}
										<div class="rounded border-l-2 border-warning bg-warning/10 p-2 text-sm">
											{error}
										</div>
									{/each}
								</div>
							{/if}
						{:else}
							<div class="mt-3 alert alert-success py-2">
								<span class="font-semibold">{$t('dialogs.module_version.no_errors')}</span>
							</div>
						{/if}
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>
