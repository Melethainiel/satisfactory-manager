<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { Icon, Map, WrenchScrewdriver } from 'svelte-hero-icons';
	import { t } from '$lib/i18n';

	// Props
	let { open, onClose } = $props<{ open: boolean; onClose?: () => void }>();

	let currentPath = $state('');
	onMount(() => {
		currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
	});
	afterNavigate((nav) => {
		currentPath = nav.to?.url?.pathname ?? currentPath;
	});

	function isHomeActive() {
		return currentPath === '/' || currentPath.startsWith('/games');
	}
	function isSettingsActive() {
		return currentPath.startsWith('/settings');
	}
</script>

<!-- Desktop Sidebar (fixed scrollable) -->
<aside
	class="scrollbar fixed inset-0 top-20 right-auto z-10 hidden w-64 overflow-y-auto border-r border-base-content/5 bg-base-100 px-4 pb-10 lg:block"
>
	<ul class="menu mt-2 w-full">
		<li>
			<h2 class="menu-title">{$t('nav.navigation')}</h2>
			<ul>
				<li>
					<a
						href="/"
						class={`rounded-lg transition-colors hover:text-primary ${isHomeActive() ? 'font-semibold text-primary' : ''}`}
					>
						<Icon src={Map} class="inline-block size-5 stroke-1" />
						{$t('nav.game')}
					</a>
				</li>
				<li>
					<a
						href="/settings"
						class={`rounded-lg transition-colors hover:text-primary ${isSettingsActive() ? 'font-semibold text-primary' : ''}`}
					>
						<Icon src={WrenchScrewdriver} class="inline-block size-5 stroke-1" />
						{$t('nav.settings')}
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
					<li>
						<a
							href="/"
							onclick={() => onClose?.()}
							class={`rounded-lg transition-colors hover:text-primary ${isHomeActive() ? 'font-semibold text-primary' : ''}`}
						>
							<Icon src={Map} class="inline-block size-4 stroke-1" />
							{$t('nav.game')}
						</a>
					</li>
					<li>
						<a
							href="/settings"
							onclick={() => onClose?.()}
							class={`rounded-lg transition-colors hover:text-primary ${isSettingsActive() ? 'font-semibold text-primary' : ''}`}
						>
							<Icon src={WrenchScrewdriver} class="inline-block size-4 stroke-1" />
							{$t('nav.settings')}
						</a>
					</li>
				</ul>
			</li>
		</ul>
	</nav>
</aside>
