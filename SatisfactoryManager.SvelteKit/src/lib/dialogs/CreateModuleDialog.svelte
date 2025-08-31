<script lang="ts">
	import { getAuthState } from '$lib/states/authState.svelte';
	import type { CreateModuleDialogHandle } from './CreateModuleDialogHandle';
	import { apiService } from '$lib/services/apiService';

	const authState = getAuthState();

	let dialogEl: HTMLDialogElement | null = null;
	let importMode = $state<'manual' | 'yaml'>('yaml');
	let moduleName = $state('');
	let moduleUrl = $state('');
	let githubRepo = $state('');
	let manifestUrl = $state('');
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);
	let previewVersions = $state<any[]>([]);
	let isPreviewingVersions = $state(false);
	let manifestPreview = $state<any>(null);
	let isPreviewingManifest = $state(false);

	let onCreateCallback: ((module: { id: string; name: string; url: string }) => void) | null = null;

	function validateUrl(url: string): boolean {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	}

	async function previewYamlManifest() {
		if (!manifestUrl.trim() || !validateUrl(manifestUrl.trim())) {
			error = 'Please enter a valid manifest URL first';
			return;
		}

		if (!authState.isAuthenticated) {
			error = 'Authentication required';
			return;
		}

		isPreviewingManifest = true;
		error = null;
		manifestPreview = null;

		try {
			const data = await apiService.post('/api/modules/yaml-preview', {
				manifestUrl: manifestUrl.trim()
			});
			manifestPreview = data.manifest;

			// Auto-populate fields with preview data
			if (data.manifest) {
				moduleName = data.manifest.name || '';
				moduleUrl = data.manifest.url || '';
				// Don't auto-populate GitHub repo as it's extracted from the URL
			}
		} catch (e: any) {
			error = e?.message ?? 'Failed to preview manifest';
			manifestPreview = null;
		} finally {
			isPreviewingManifest = false;
		}
	}

	async function previewGitHubVersions() {
		if (!githubRepo.trim() || !validateUrl(githubRepo.trim())) {
			error = 'Please enter a valid GitHub URL first';
			return;
		}

		if (!authState.isAuthenticated) {
			error = 'Authentication required';
			return;
		}

		isPreviewingVersions = true;
		error = null;

		try {
			const data = await apiService.post('/api/modules/github-preview', {
				githubUrl: githubRepo.trim()
			});
			previewVersions = data.versions || [];
		} catch (e: any) {
			error = e?.message ?? 'Failed to preview GitHub versions';
			previewVersions = [];
		} finally {
			isPreviewingVersions = false;
		}
	}

	async function submit(e?: Event) {
		e?.preventDefault();

		if (!authState.isAuthenticated) {
			error = 'Authentication required';
			return;
		}

		// Validate based on import mode
		if (importMode === 'yaml') {
			if (!manifestUrl.trim()) {
				error = 'Manifest URL is required for YAML import';
				return;
			}

			if (!validateUrl(manifestUrl.trim())) {
				error = 'Please enter a valid manifest URL';
				return;
			}
		} else {
			// Manual mode validation
			if (!moduleName.trim()) {
				error = 'Module name is required';
				return;
			}

			if (!moduleUrl.trim()) {
				error = 'Module URL is required';
				return;
			}

			if (!validateUrl(moduleUrl.trim())) {
				error = 'Please enter a valid URL';
				return;
			}
		}

		isSubmitting = true;
		error = null;

		try {
			const requestBody =
				importMode === 'yaml'
					? {
							importMode: 'yaml',
							manifestUrl: manifestUrl.trim()
						}
					: {
							importMode: 'manual',
							name: moduleName.trim(),
							url: moduleUrl.trim(),
							githubRepo: githubRepo.trim() || null
						};

			const createdModule = await apiService.post('/api/modules', requestBody);

			// Call the callback with the created module
			if (onCreateCallback) {
				onCreateCallback(createdModule);
			}

			// Reset form and close dialog
			resetForm();
			dialogEl?.close();
		} catch (e: any) {
			error = e?.message ?? 'Failed to create module';
		} finally {
			isSubmitting = false;
		}
	}

	function resetForm() {
		moduleName = '';
		moduleUrl = '';
		githubRepo = '';
		manifestUrl = '';
		manifestPreview = null;
		previewVersions = [];
		error = null;
	}

	function onClose() {
		resetForm();
		importMode = 'yaml'; // Reset to default mode
		onCreateCallback = null;
	}

	export const open: CreateModuleDialogHandle['open'] = (
		callback?: (module: { id: string; name: string; url: string }) => void
	) => {
		onCreateCallback = callback || null;
		dialogEl?.showModal();
	};
</script>

<dialog bind:this={dialogEl} class="modal" onclose={onClose}>
	<div class="modal-box">
		<h3 class="text-lg font-bold">Create New Module</h3>

		<!-- Mode Selection Tabs -->
		<div class="tabs-boxed mt-4 mb-4 tabs">
			<button
				type="button"
				class="tab"
				class:tab-active={importMode === 'yaml'}
				onclick={() => {
					importMode = 'yaml';
					error = null;
				}}
			>
				Import from YAML
			</button>
			<button
				type="button"
				class="tab"
				class:tab-active={importMode === 'manual'}
				onclick={() => {
					importMode = 'manual';
					error = null;
				}}
			>
				Manual Entry
			</button>
		</div>

		<form onsubmit={submit} class="mt-4">
			{#if error}
				<div class="mb-4 alert alert-error py-2 text-sm">
					<span>{error}</span>
				</div>
			{/if}

			{#if importMode === 'yaml'}
				<!-- YAML Import Mode -->
				<label class="form-control mb-4 w-full">
					<div class="label">
						<span class="label-text">Manifest URL <span class="text-error">*</span></span>
					</div>
					<div class="join w-full">
						<input
							bind:value={manifestUrl}
							type="url"
							placeholder="https://example.com/path/to/plugin.yaml"
							class="input-bordered input join-item flex-1"
							disabled={isSubmitting || isPreviewingManifest}
							required
						/>
						<button
							type="button"
							class="btn join-item"
							onclick={previewYamlManifest}
							disabled={isSubmitting || isPreviewingManifest || !manifestUrl.trim()}
						>
							{#if isPreviewingManifest}
								<span class="loading loading-sm loading-spinner"></span>
							{:else}
								Preview
							{/if}
						</button>
					</div>
					<div class="label">
						<span class="label-text-alt opacity-70"
							>URL to the YAML manifest file (e.g., plugin.yaml)</span
						>
					</div>
				</label>

				{#if manifestPreview}
					<div class="mb-4 rounded-lg border border-base-300 p-4">
						<h4 class="mb-3 text-sm font-medium">Manifest Preview</h4>
						<div class="space-y-2 text-sm">
							<div class="flex items-center gap-2">
								<span class="font-medium opacity-70">Name:</span>
								<span class="font-mono">{manifestPreview.name}</span>
							</div>
							<div class="flex items-center gap-2">
								<span class="font-medium opacity-70">Version:</span>
								<span class="font-mono">{manifestPreview.version}</span>
							</div>
							{#if manifestPreview.description}
								<div class="flex items-start gap-2">
									<span class="mt-0.5 font-medium opacity-70">Description:</span>
									<span class="text-xs opacity-80">{manifestPreview.description}</span>
								</div>
							{/if}
							{#if manifestPreview.url}
								<div class="flex items-center gap-2">
									<span class="font-medium opacity-70">Repository:</span>
									<span class="text-xs break-all opacity-80">{manifestPreview.url}</span>
								</div>
							{/if}
							{#if manifestPreview.dependencies && manifestPreview.dependencies.length > 0}
								<div class="flex items-start gap-2">
									<span class="mt-0.5 font-medium opacity-70">Dependencies:</span>
									<div class="flex flex-wrap gap-1">
										{#each manifestPreview.dependencies as dep}
											<span class="badge badge-outline badge-sm">{dep}</span>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			{:else}
				<!-- Manual Entry Mode -->
				<label class="form-control mb-4 w-full">
					<div class="label">
						<span class="label-text">Module Name <span class="text-error">*</span></span>
					</div>
					<input
						bind:value={moduleName}
						type="text"
						placeholder="Enter module name..."
						class="input-bordered input w-full"
						disabled={isSubmitting}
						required
					/>
				</label>

				<label class="form-control mb-4 w-full">
					<div class="label">
						<span class="label-text">Module URL <span class="text-error">*</span></span>
					</div>
					<input
						bind:value={moduleUrl}
						type="url"
						placeholder="https://example.com/module"
						class="input-bordered input w-full"
						disabled={isSubmitting}
						required
					/>
					<div class="label">
						<span class="label-text-alt opacity-70">Enter the full URL to the module</span>
					</div>
				</label>

				<label class="form-control mb-4 w-full">
					<div class="label">
						<span class="label-text">GitHub Repository (Optional)</span>
					</div>
					<div class="join w-full">
						<input
							bind:value={githubRepo}
							type="url"
							placeholder="https://github.com/owner/repo"
							class="input-bordered input join-item flex-1"
							disabled={isSubmitting || isPreviewingVersions}
						/>
						<button
							type="button"
							class="btn join-item"
							onclick={previewGitHubVersions}
							disabled={isSubmitting || isPreviewingVersions || !githubRepo.trim()}
						>
							{#if isPreviewingVersions}
								<span class="loading loading-sm loading-spinner"></span>
							{:else}
								Preview Versions
							{/if}
						</button>
					</div>
					<div class="label">
						<span class="label-text-alt opacity-70"
							>Optional: GitHub repo for automatic version management</span
						>
					</div>
				</label>

				{#if previewVersions.length > 0}
					<div class="mb-4 rounded-lg border border-base-300 p-4">
						<h4 class="mb-2 text-sm font-medium">Available Versions ({previewVersions.length})</h4>
						<div class="max-h-32 space-y-1 overflow-y-auto">
							{#each previewVersions.slice(0, 5) as version}
								<div class="flex items-center justify-between text-xs">
									<span class="font-mono">{version.version}</span>
									<span class="opacity-70"
										>{new Date(version.publishedAt).toLocaleDateString()}</span
									>
								</div>
							{/each}
							{#if previewVersions.length > 5}
								<div class="text-xs opacity-70">
									... and {previewVersions.length - 5} more versions
								</div>
							{/if}
						</div>
					</div>
				{/if}
			{/if}

			<div class="modal-action">
				<button type="button" class="btn" onclick={() => dialogEl?.close()} disabled={isSubmitting}>
					Cancel
				</button>
				<button
					type="submit"
					class="btn btn-primary"
					disabled={isSubmitting ||
						(importMode === 'yaml' ? !manifestUrl.trim() : !moduleName.trim() || !moduleUrl.trim())}
				>
					{#if isSubmitting}
						<span class="loading loading-sm loading-spinner"></span>
					{/if}
					{importMode === 'yaml' ? 'Import Module' : 'Create Module'}
				</button>
			</div>
		</form>
	</div>
</dialog>
