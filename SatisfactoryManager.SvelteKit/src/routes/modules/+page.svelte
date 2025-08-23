<script lang="ts">
	import { onMount } from 'svelte';
	import { getAuthState } from '$lib/states/authState.svelte';
	import { t } from '$lib/i18n';
	import { Icon, Cube, Link, Calendar, Tag, Trash } from 'svelte-hero-icons';
	import ModuleVersionManager from '$lib/components/ModuleVersionManager.svelte';
	import {
		setDeleteModuleDialog,
		openDeleteModuleDialog
	} from '$lib/dialogs/DeleteModuleDialogHandle';
	import DeleteModuleDialog from '$lib/dialogs/DeleteModuleDialog.svelte';

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

	let modules = $state<Module[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let selectedModule = $state<Module | null>(null);
	let deleteModuleDialogRef = $state<DeleteModuleDialog | null>(null);

	async function loadModules() {
		if (!authState.apiFetch) return;

		isLoading = true;
		error = null;

		try {
			const res = await authState.apiFetch('/api/modules');

			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.error || `Failed to load modules (${res.status})`);
			}

			modules = await res.json();
		} catch (e: any) {
			error = e?.message ?? 'Failed to load modules';
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		if (authState.isAuthenticated) {
			loadModules();
		}

		// Set up delete dialog reference
		if (deleteModuleDialogRef) {
			setDeleteModuleDialog(deleteModuleDialogRef);
		}
	});

	function formatDate(date: Date | string) {
		return new Date(date).toLocaleDateString();
	}

	function openVersionManager(module: Module) {
		selectedModule = module;
	}

	function closeVersionManager() {
		selectedModule = null;
	}

	function deleteModule(module: Module) {
		openDeleteModuleDialog(module, (deletedModuleId: string) => {
			// Remove the deleted module from the modules array reactively
			modules = modules.filter((m) => m.id !== deletedModuleId);
		});
	}
</script>

<svelte:head>
	<title>Satisfactory Manager | {$t('nav.modules')}</title>
</svelte:head>

<div class="container mx-auto p-4">
	<div class="mb-8">
		<h1 class="mb-4 flex items-center gap-3 text-3xl font-bold">
			<Icon src={Cube} class="size-8" />
			{$t('nav.modules')}
		</h1>
		<p class="text-base-content/70">{$t('modules.description')}</p>
	</div>

	{#if !authState.isAuthenticated}
		<!-- Authentication Required -->
		<div class="py-8 text-center">
			<div class="mx-auto alert max-w-md alert-warning">
				<span>{$t('auth.sign_in_required')}</span>
			</div>
		</div>
	{:else if isLoading}
		<!-- Loading State -->
		<div class="py-8 text-center">
			<span class="loading loading-lg loading-spinner"></span>
			<p class="mt-4 text-lg opacity-70">{$t('common.loading')}</p>
		</div>
	{:else if error}
		<!-- Error State -->
		<div class="py-8 text-center">
			<div class="mx-auto alert max-w-md alert-error">
				<span>{error}</span>
			</div>
			<button class="btn mt-4 btn-primary" onclick={loadModules}>
				{$t('common.retry')}
			</button>
		</div>
	{:else if modules.length === 0}
		<!-- No Modules State -->
		<div class="py-12 text-center">
			<Icon src={Cube} class="mx-auto mb-4 size-16 opacity-30" />
			<h2 class="mb-4 text-2xl font-semibold">{$t('modules.no_modules')}</h2>
			<p class="mb-6 text-base-content/70">{$t('modules.no_modules_description')}</p>
		</div>
	{:else}
		<!-- Modules List -->
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each modules as module}
				<div class="card bg-base-100 shadow transition-shadow hover:shadow-lg">
					<div class="card-body">
						<h3 class="card-title flex items-center gap-2">
							<Icon src={Cube} class="size-5" />
							{module.name}
						</h3>

						<div class="space-y-2 text-sm">
							<!-- Current Version -->
							{#if module.currentVersion}
								<div class="flex items-center gap-2">
									<Icon src={Tag} class="size-4 opacity-70" />
									<span class="opacity-70">{$t('modules.current_version')}:</span>
									<span class="font-mono font-medium">{module.currentVersion}</span>
								</div>
							{:else}
								<div class="flex items-center gap-2">
									<Icon src={Tag} class="size-4 opacity-70" />
									<span class="opacity-70">{$t('modules.no_version')}</span>
								</div>
							{/if}

							<!-- GitHub Repository -->
							{#if module.githubRepo}
								<div class="flex items-center gap-2">
									<Icon src={Link} class="size-4 opacity-70" />
									<a
										href="https://github.com/{module.githubRepo}"
										target="_blank"
										rel="noopener noreferrer"
										class="link truncate text-sm link-primary"
									>
										{module.githubRepo}
									</a>
								</div>
							{/if}

							<!-- Last Updated -->
							<div class="flex items-center gap-2">
								<Icon src={Calendar} class="size-4 opacity-70" />
								<span class="opacity-70">{$t('modules.updated')}:</span>
								<span class="text-sm">{formatDate(module.updatedAt)}</span>
							</div>
						</div>

						<div class="mt-4 card-actions justify-between">
							<button
								class="btn btn-outline btn-sm btn-error"
								onclick={() => deleteModule(module)}
								title={$t('modules.remove_module')}
							>
								<Icon src={Trash} class="size-4" />
							</button>
							<button class="btn btn-sm btn-primary" onclick={() => openVersionManager(module)}>
								{$t('modules.manage_versions')}
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Refresh Button -->
		<div class="mt-8 text-center">
			<button class="btn btn-outline" onclick={loadModules}>
				{$t('common.refresh')}
			</button>
		</div>
	{/if}
</div>

<!-- Version Manager Modal -->
{#if selectedModule}
	<div class="modal-open modal">
		<div class="modal-box max-w-4xl">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-bold">
					{$t('dialogs.module_version.version_management')} - {selectedModule.name}
				</h3>
				<button class="btn btn-ghost btn-sm" onclick={closeVersionManager}>✕</button>
			</div>

			<ModuleVersionManager module={selectedModule} context="admin" />
		</div>
		<div
			class="modal-backdrop"
			onclick={closeVersionManager}
			onkeydown={(e) => e.key === 'Escape' && closeVersionManager()}
			role="button"
			tabindex="0"
			aria-label={$t('common.close')}
		></div>
	</div>
{/if}

<!-- Delete Module Dialog -->
<DeleteModuleDialog bind:this={deleteModuleDialogRef} />
