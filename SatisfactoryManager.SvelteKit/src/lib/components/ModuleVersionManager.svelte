<script lang="ts">
	import { getAuthState } from '$lib/states/authState.svelte';

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
		githubRepo: string | null;
		createdAt: Date;
		updatedAt: Date;
	}

	const authState = getAuthState();

	let { module }: { module: Module } = $props();

	let versions = $state<ModuleVersion[]>([]);
	let isLoading = $state(false);
	let isSyncing = $state(false);
	let isUpdatingVersion = $state(false);
	let error = $state<string | null>(null);

	async function loadVersions() {
		if (!authState.apiFetch) return;

		isLoading = true;
		error = null;

		try {
			const res = await authState.apiFetch(`/api/modules/${module.id}/versions`);
			
			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.error || `Failed to load versions (${res.status})`);
			}

			versions = await res.json();
		} catch (e: any) {
			error = e?.message ?? 'Failed to load versions';
		} finally {
			isLoading = false;
		}
	}

	async function syncFromGitHub() {
		if (!authState.apiFetch || !module.githubRepo) return;

		isSyncing = true;
		error = null;

		try {
			const res = await authState.apiFetch(`/api/modules/${module.id}/sync-versions`, {
				method: 'POST'
			});
			
			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.error || `Failed to sync versions (${res.status})`);
			}

			const data = await res.json();
			
			// Reload versions to get the updated list
			await loadVersions();
		} catch (e: any) {
			error = e?.message ?? 'Failed to sync versions from GitHub';
		} finally {
			isSyncing = false;
		}
	}

	async function updateCurrentVersion(version: string) {
		if (!authState.apiFetch) return;

		isUpdatingVersion = true;
		error = null;

		try {
			const res = await authState.apiFetch(`/api/modules/${module.id}/current-version`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ version })
			});
			
			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.error || `Failed to update version (${res.status})`);
			}

			const updatedModule = await res.json();
			module.currentVersion = updatedModule.currentVersion;
		} catch (e: any) {
			error = e?.message ?? 'Failed to update current version';
		} finally {
			isUpdatingVersion = false;
		}
	}

	// Load versions when component mounts or module changes
	$effect(() => {
		loadVersions();
	});
</script>

<div class="rounded-lg border border-base-300 p-4">
	<div class="mb-4 flex items-center justify-between">
		<h3 class="text-lg font-semibold">Version Management</h3>
		<div class="flex gap-2">
			<button 
				class="btn btn-sm" 
				onclick={loadVersions} 
				disabled={isLoading}
			>
				{#if isLoading}
					<span class="loading loading-sm loading-spinner"></span>
				{:else}
					Refresh
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
						Sync from GitHub
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

	{#if module.currentVersion}
		<div class="mb-4 rounded bg-base-200 p-3">
			<div class="text-sm font-medium">Current Version</div>
			<div class="font-mono text-lg">{module.currentVersion}</div>
		</div>
	{/if}

	{#if isLoading}
		<div class="flex justify-center py-8">
			<span class="loading loading-lg loading-spinner"></span>
		</div>
	{:else if versions.length === 0}
		<div class="py-8 text-center text-gray-500">
			<div class="mb-2">No versions available</div>
			{#if module.githubRepo}
				<div class="text-sm">Try syncing from GitHub to fetch available versions</div>
			{/if}
		</div>
	{:else}
		<div class="space-y-2">
			{#each versions as version}
				<div class="flex items-center justify-between rounded border border-base-300 p-3">
					<div class="flex-1">
						<div class="flex items-center gap-2">
							<span class="font-mono font-medium">{version.version}</span>
							{#if version.version === module.currentVersion}
								<span class="badge badge-primary badge-sm">Current</span>
							{/if}
						</div>
						{#if version.publishedAt}
							<div class="text-sm opacity-70">
								Published: {new Date(version.publishedAt).toLocaleDateString()}
							</div>
						{/if}
						{#if version.releaseNotes}
							<div class="mt-1 text-sm opacity-70 line-clamp-2">
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
								class="btn btn-sm btn-ghost"
							>
								View Release
							</a>
						{/if}
						{#if version.version !== module.currentVersion}
							<button 
								class="btn btn-sm btn-primary" 
								onclick={() => updateCurrentVersion(version.version)}
								disabled={isUpdatingVersion}
							>
								{#if isUpdatingVersion}
									<span class="loading loading-sm loading-spinner"></span>
								{:else}
									Use This Version
								{/if}
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>