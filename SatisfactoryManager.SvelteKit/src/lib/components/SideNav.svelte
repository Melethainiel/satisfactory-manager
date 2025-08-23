<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { Icon, Map, WrenchScrewdriver, Home, Cube, MapPin } from 'svelte-hero-icons';
	import { t } from '$lib/i18n';
	import { getPermissionState } from '$lib/states/permissionState.svelte';
	import { getGameState } from '$lib/states/gameState.svelte';

	// Props
	let { open, onClose } = $props<{ open: boolean; onClose?: () => void }>();

	const permissionState = getPermissionState();
	const gameState = getGameState();

	let currentPath = $state('');
	onMount(() => {
		currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
	});
	afterNavigate((nav) => {
		currentPath = nav.to?.url?.pathname ?? currentPath;
	});

	function isHomeActive() {
		return currentPath === '/';
	}
	function isGameSitesActive() {
		return currentPath.startsWith('/games');
	}
	function isSettingsActive() {
		return currentPath.includes('/settings');
	}
	function isModulesActive() {
		return currentPath.startsWith('/modules');
	}

	// Check if game is selected and user has permissions
	let hasSelectedGame = $derived(gameState.selectedGameId !== null);
	let currentGameId = $derived(gameState.selectedGameId);
</script>

<!-- Desktop Sidebar (fixed scrollable) -->
<aside
	class="scrollbar fixed inset-0 top-20 right-auto z-10 hidden w-64 overflow-y-auto border-r border-base-content/5 bg-base-100 px-4 pb-10 lg:block"
>
	<ul class="menu mt-2 w-full">
		<li>
			<h2 class="menu-title">{$t('nav.navigation')}</h2>
			<ul>
				<!-- Home -->
				<li>
					<a
						href="/"
						class={`rounded-lg transition-colors hover:text-primary ${isHomeActive() ? 'font-semibold text-primary' : ''}`}
					>
						<Icon src={Home} class="inline-block size-5 stroke-1" />
						{$t('nav.home')}
					</a>
				</li>

				<!-- Game Section (only show when game is selected) -->
				{#if hasSelectedGame}
					<li>
						<details open={isGameSitesActive() || isSettingsActive()}>
							<summary class="font-medium text-base-content/80">
								<Icon src={Map} class="inline-block size-5 stroke-1" />
								{$t('nav.game')}
							</summary>
							<ul>
								<li>
									<a
										href="/games/{currentGameId}"
										class={`rounded-lg transition-colors hover:text-primary ${isGameSitesActive() ? 'font-semibold text-primary' : ''}`}
									>
										<Icon src={MapPin} class="inline-block size-4 stroke-1" />
										{$t('nav.sites')}
									</a>
								</li>
								{#if permissionState.canAccessSettings()}
									<li>
										<a
											href="/games/{currentGameId}/settings"
											class={`rounded-lg transition-colors hover:text-primary ${isSettingsActive() ? 'font-semibold text-primary' : ''}`}
										>
											<Icon src={WrenchScrewdriver} class="inline-block size-4 stroke-1" />
											{$t('nav.settings')}
										</a>
									</li>
								{/if}
							</ul>
						</details>
					</li>
				{/if}

				<!-- Modules -->
				<li>
					<a
						href="/modules"
						class={`rounded-lg transition-colors hover:text-primary ${isModulesActive() ? 'font-semibold text-primary' : ''}`}
					>
						<Icon src={Cube} class="inline-block size-5 stroke-1" />
						{$t('nav.modules')}
					</a>
				</li>
			</ul>
		</li>
	</ul>
</aside>

<!-- Mobile Overlay -->
{#if open}
	<button
		type="button"
		aria-label="Close navigation"
		class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
		onclick={() => onClose?.()}
		onkeydown={(e) => e.key === 'Escape' && onClose?.()}
	></button>
{/if}

<!-- Mobile Drawer -->
<aside
	class="fixed top-0 left-0 z-50 flex h-full w-64 transform flex-col gap-4 border-r border-base-300 bg-base-100 p-4 transition-transform duration-200 lg:hidden"
	class:translate-x-0={open}
	class:-translate-x-full={!open}
	aria-label="Navigation menu"
>
	<div class="mb-2 flex items-center justify-between">
		<h2 class="text-lg font-semibold">{$t('nav.menu')}</h2>
		<button
			class="btn btn-ghost btn-sm"
			aria-label={$t('nav.close_nav')}
			onclick={() => onClose?.()}>✕</button
		>
	</div>
	<nav class="flex-1">
		<ul class="menu w-full">
			<li>
				<h2 class="menu-title">{$t('nav.navigation')}</h2>
				<ul>
					<!-- Home -->
					<li>
						<a
							href="/"
							onclick={() => onClose?.()}
							class={`rounded-lg transition-colors hover:text-primary ${isHomeActive() ? 'font-semibold text-primary' : ''}`}
						>
							<Icon src={Home} class="inline-block size-4 stroke-1" />
							{$t('nav.home')}
						</a>
					</li>

					<!-- Game Section (only show when game is selected) -->
					{#if hasSelectedGame}
						<li>
							<details open={isGameSitesActive() || isSettingsActive()}>
								<summary class="font-medium text-base-content/80">
									<Icon src={Map} class="inline-block size-4 stroke-1" />
									{$t('nav.game')}
								</summary>
								<ul>
									<li>
										<a
											href="/games/{currentGameId}"
											onclick={() => onClose?.()}
											class={`rounded-lg transition-colors hover:text-primary ${isGameSitesActive() ? 'font-semibold text-primary' : ''}`}
										>
											<Icon src={MapPin} class="inline-block size-4 stroke-1" />
											{$t('nav.sites')}
										</a>
									</li>
									{#if permissionState.canAccessSettings()}
										<li>
											<a
												href="/games/{currentGameId}/settings"
												onclick={() => onClose?.()}
												class={`rounded-lg transition-colors hover:text-primary ${isSettingsActive() ? 'font-semibold text-primary' : ''}`}
											>
												<Icon src={WrenchScrewdriver} class="inline-block size-4 stroke-1" />
												{$t('nav.settings')}
											</a>
										</li>
									{/if}
								</ul>
							</details>
						</li>
					{/if}

					<!-- Modules -->
					<li>
						<a
							href="/modules"
							onclick={() => onClose?.()}
							class={`rounded-lg transition-colors hover:text-primary ${isModulesActive() ? 'font-semibold text-primary' : ''}`}
						>
							<Icon src={Cube} class="inline-block size-4 stroke-1" />
							{$t('nav.modules')}
						</a>
					</li>
				</ul>
			</li>
		</ul>
	</nav>
</aside>
