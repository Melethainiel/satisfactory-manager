<script lang="ts">
	import ModuleVersionManager from '$lib/components/ModuleVersionManager.svelte';
	import { t } from '$lib/i18n';

	interface Module {
		id: string;
		name: string;
		url: string;
		currentVersion: string | null;
		githubRepo: string | null;
		createdAt: Date;
		updatedAt: Date;
	}

	let dialogEl: HTMLDialogElement | null = null;
	let currentModule: Module | null = $state(null);

	function onClose() {
		currentModule = null;
	}

	export function open(module: Module) {
		currentModule = module;
		dialogEl?.showModal();
	}
</script>

<dialog bind:this={dialogEl} class="modal" onclose={onClose}>
	<div class="modal-box max-h-[80vh] max-w-4xl overflow-y-auto">
		{#if currentModule}
			<h3 class="mb-4 text-lg font-bold">
				{$t('dialogs.module_version.title').replace('{name}', currentModule.name)}
			</h3>

			<div class="mb-4 rounded bg-base-200 p-3">
				<div class="text-sm opacity-70">{$t('dialogs.module_version.module_url')}</div>
				<a href={currentModule.url} target="_blank" rel="noopener noreferrer" class="link text-sm">
					{currentModule.url}
				</a>
				{#if currentModule.githubRepo}
					<div class="mt-2 text-sm opacity-70">{$t('dialogs.module_version.github_repo')}</div>
					<a
						href={currentModule.githubRepo}
						target="_blank"
						rel="noopener noreferrer"
						class="link text-sm"
					>
						{currentModule.githubRepo}
					</a>
				{/if}
			</div>

			<ModuleVersionManager module={currentModule} />
		{/if}

		<div class="modal-action">
			<button type="button" class="btn" onclick={() => dialogEl?.close()}
				>{$t('common.close')}</button
			>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label={$t('dialogs.module_version.close_label')}>{$t('common.close')}</button>
	</form>
</dialog>
