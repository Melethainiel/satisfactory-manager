<script lang="ts">
	import { getAuthState } from '$lib/states/authState.svelte';
	import type { CreateModuleDialogHandle } from './CreateModuleDialogHandle';

	const authState = getAuthState();

	let dialogEl: HTMLDialogElement | null = null;
	let moduleName = $state('');
	let moduleUrl = $state('');
	let githubRepo = $state('');
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);
	let previewVersions = $state<any[]>([]);
	let isPreviewingVersions = $state(false);

	let onCreateCallback: ((module: { id: string; name: string; url: string }) => void) | null = null;

	function validateUrl(url: string): boolean {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	}

	async function previewGitHubVersions() {
		if (!githubRepo.trim() || !validateUrl(githubRepo.trim())) {
			error = 'Please enter a valid GitHub URL first';
			return;
		}

		if (!authState.apiFetch) {
			error = 'Authentication required';
			return;
		}

		isPreviewingVersions = true;
		error = null;

		try {
			const res = await authState.apiFetch('/api/modules/github-preview', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					githubUrl: githubRepo.trim()
				})
			});

			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.error || `Failed to fetch GitHub versions (${res.status})`);
			}

			const data = await res.json();
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

		if (!authState.apiFetch) {
			error = 'Authentication required';
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			const res = await authState.apiFetch('/api/modules', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: moduleName.trim(),
					url: moduleUrl.trim(),
					githubRepo: githubRepo.trim() || null
				})
			});

			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.error || `Failed to create module (${res.status})`);
			}

			const createdModule = await res.json();

			// Call the callback with the created module
			if (onCreateCallback) {
				onCreateCallback(createdModule);
			}

			// Reset form and close dialog
			moduleName = '';
			moduleUrl = '';
			dialogEl?.close();
		} catch (e: any) {
			error = e?.message ?? 'Failed to create module';
		} finally {
			isSubmitting = false;
		}
	}

	function onClose() {
		moduleName = '';
		moduleUrl = '';
		githubRepo = '';
		error = null;
		previewVersions = [];
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
		<form onsubmit={submit} class="mt-4">
			{#if error}
				<div class="mb-4 alert alert-error py-2 text-sm">
					<span>{error}</span>
				</div>
			{/if}

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
					<span class="label-text-alt opacity-70">Optional: GitHub repo for automatic version management</span>
				</div>
			</label>

			{#if previewVersions.length > 0}
				<div class="mb-4 rounded-lg border border-base-300 p-4">
					<h4 class="mb-2 text-sm font-medium">Available Versions ({previewVersions.length})</h4>
					<div class="max-h-32 overflow-y-auto space-y-1">
						{#each previewVersions.slice(0, 5) as version}
							<div class="flex items-center justify-between text-xs">
								<span class="font-mono">{version.version}</span>
								<span class="opacity-70">{new Date(version.publishedAt).toLocaleDateString()}</span>
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

			<div class="modal-action">
				<button type="button" class="btn" onclick={() => dialogEl?.close()} disabled={isSubmitting}>
					Cancel
				</button>
				<button
					type="submit"
					class="btn btn-primary"
					disabled={isSubmitting || !moduleName.trim() || !moduleUrl.trim()}
				>
					{#if isSubmitting}
						<span class="loading loading-sm loading-spinner"></span>
					{/if}
					Create Module
				</button>
			</div>
		</form>
	</div>
</dialog>
