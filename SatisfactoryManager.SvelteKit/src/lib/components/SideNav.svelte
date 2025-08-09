<script lang="ts">
  import { onMount } from 'svelte';
  import { afterNavigate } from '$app/navigation';
  import { Icon, Map, WrenchScrewdriver } from "svelte-hero-icons";

  // Props
  let { open, onClose } = $props<{ open: boolean; onClose?: () => void }>();

  let currentPath = $state('');
  onMount(() => { currentPath = typeof window !== 'undefined' ? window.location.pathname : ''; });
  afterNavigate((nav) => { currentPath = nav.to?.url?.pathname ?? currentPath; });

  function isHomeActive() { return currentPath === '/' || currentPath.startsWith('/game'); }
  function isSettingsActive() { return currentPath.startsWith('/settings'); }
</script>

<!-- Desktop Sidebar (fixed scrollable) -->
<aside class="scrollbar hidden fixed z-10 overflow-y-auto inset-0 lg:block top-20 right-auto w-64 pb-10 bg-base-100 border-r border-base-content/5 px-4">
  <ul class="menu w-full mt-2">
    <li>
      <h2 class="menu-title">Navigation</h2>
      <ul>
        <li>
          <a href="/" class={`transition-colors hover:text-primary rounded-lg ${isHomeActive() ? 'text-primary font-semibold' : ''}`}>
            <Icon src={Map} class="inline-block size-5 stroke-1" /> Game
          </a>
        </li>
        <li>
          <a href="/settings" class={`transition-colors hover:text-primary rounded-lg ${isSettingsActive() ? 'text-primary font-semibold' : ''}`}>
            <Icon src={WrenchScrewdriver} class="inline-block size-5 stroke-1" /> Settings
          </a>
        </li>
      </ul>
    </li>
  </ul>
</aside>

<!-- Mobile Overlay -->
{#if open}
  <button type="button" aria-label="Close navigation" class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onclick={() => onClose?.()} onkeydown={(e) => e.key==='Escape' && onClose?.()}></button>
{/if}

<!-- Mobile Drawer -->
<aside class="fixed z-50 top-0 left-0 h-full w-64 bg-base-100 border-r border-base-300 p-4 flex flex-col gap-4 transform transition-transform duration-200 lg:hidden"
  class:translate-x-0={open}
  class:-translate-x-full={!open}
  aria-label="Navigation menu">
  <div class="flex items-center justify-between mb-2">
    <h2 class="text-lg font-semibold">Menu</h2>
  <button class="btn btn-sm btn-ghost" aria-label="Close navigation" onclick={() => onClose?.()}>✕</button>
  </div>
  <nav class="flex-1">
    <ul class="menu w-full">
      <li>
        <h2 class="menu-title">Navigation</h2>
        <ul>
          <li>
            <a href="/" onclick={() => onClose?.()} class={`transition-colors hover:text-primary rounded-lg ${isHomeActive() ? 'text-primary font-semibold' : ''}`}>
              <Icon src={Map} class="inline-block size-4 stroke-1" /> Game
            </a>
          </li>
          <li>
            <a href="/settings" onclick={() => onClose?.()} class={`transition-colors hover:text-primary rounded-lg ${isSettingsActive() ? 'text-primary font-semibold' : ''}`}>
              <Icon src={WrenchScrewdriver} class="inline-block size-4 stroke-1" /> Settings
            </a>
          </li>
        </ul>
      </li>
    </ul>
  </nav>
</aside>
