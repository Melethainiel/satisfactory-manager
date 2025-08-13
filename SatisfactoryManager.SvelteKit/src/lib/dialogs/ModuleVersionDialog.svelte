<script lang="ts">
	import ModuleVersionManager from '$lib/components/ModuleVersionManager.svelte';

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
	<div class="modal-box max-w-4xl">
		{#if currentModule}
			<h3 class="text-lg font-bold mb-4">
				Version Management - {currentModule.name}
			</h3>
			
			<div class="mb-4 rounded bg-base-200 p-3">
				<div class="text-sm opacity-70">Module URL</div>
				<a 
					href={currentModule.url} 
					target="_blank" 
					rel="noopener noreferrer"
					class="link text-sm"
				>
					{currentModule.url}
				</a>
				{#if currentModule.githubRepo}
					<div class="text-sm opacity-70 mt-2">GitHub Repository</div>
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
			<button type="button" class="btn" onclick={() => dialogEl?.close()}>
				Close
			</button>
		</div>
	</div>
</dialog>