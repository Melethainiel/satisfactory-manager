<script lang="ts">
	import { getAuthState } from '$lib/states/authState.svelte';
	import { getGameState } from '$lib/states/gameState.svelte';
	import { getPermissionState } from '$lib/states/permissionState.svelte';
	import { getRealtimeService } from '$lib/services/realtimeService.svelte';
	import { locale, setLocale, t } from '$lib/i18n';
	import OnlineUsersIndicator from './OnlineUsersIndicator.svelte';
	import { getGravatarUrl } from '$lib/utils/gravatar';
	// New Svelte 5 pattern: accept a callback prop instead of dispatching an event
	const { toggleNav } = $props<{ toggleNav?: () => void }>();

	// Get state from context
	const authState = getAuthState();
	const gameState = getGameState();
	const permissionState = getPermissionState();
	const realtimeService = getRealtimeService();

	// Connection status for avatar border
	const isConnected = $derived(() => realtimeService.state.isConnected);

	// Generate Gravatar URL for the current user
	let userAvatarUrl = $state<string>(
		'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=facearea&facepad=3&w=256&h=256&q=80'
	);
	let avatarLoading = $state<boolean>(false);

	// Update avatar URL when user changes
	$effect(() => {
		if (authState.user?.email) {
			avatarLoading = true;
			getGravatarUrl(authState.user.email, { size: 256 })
				.then((url) => {
					userAvatarUrl = url;
				})
				.catch((error) => {
					console.error('Error generating Gravatar URL:', error);
					// Keep the default fallback URL
				})
				.finally(() => {
					avatarLoading = false;
				});
		}
	});

	// No popover helpers needed for dropdown

	// Handle logout
	async function handleLogout() {
		await authState.signOut();
	}

	// Handle login
	async function handleLogin() {
		await authState.signIn();
	}
</script>

<header
	class="sticky top-0 z-40 navbar min-h-16 sm:min-h-20 border-b border-base-200 bg-base-100/80 px-3 sm:px-4 shadow-lg backdrop-blur transition-colors supports-[backdrop-filter]:bg-base-100/70"
>
	<!-- Left side: Logo and Title -->
	<div class="navbar-start items-center gap-2 sm:gap-4">
		<!-- Mobile nav toggle -->
		<button
			class="btn btn-square btn-ghost lg:hidden"
			aria-label={$t('nav.toggle_nav')}
			onclick={() => toggleNav?.()}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5 sm:h-6 sm:w-6"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 6h16M4 12h16M4 18h16"
				/>
			</svg>
		</button>
		<a href="/" class="flex items-center text-lg sm:text-xl font-bold">
			<!-- Logo -->
			<img
				src="/logo-256.png"
				alt={$t('app.logo_alt')}
				class="mr-1.5 sm:mr-2 h-6 w-6 sm:h-8 sm:w-8 rounded-lg object-contain"
				width="32"
				height="32"
				loading="lazy"
			/>
			<span class="hidden xs:inline">{$t('app.name')}</span>
		</a>
	</div>

	<!-- Right side: Online users, Language selector and Authentication -->
	<div class="navbar-end gap-1 sm:gap-2">
		<!-- Online users indicator (only show if authenticated and in a game) -->
		{#if authState.isAuthenticated && gameState.selectedGameId}
			<div class="hidden lg:block">
				<OnlineUsersIndicator />
			</div>
		{/if}

		<!-- Language selector -->
		<div class="dropdown dropdown-end">
			<button class="btn btn-ghost btn-sm" tabindex="0" aria-label={$t('ui.change_language')}>
				<svg class="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
					></path>
				</svg>
				<span class="text-xs sm:text-sm">{$locale?.toUpperCase() || 'EN'}</span>
			</button>
			<ul class="dropdown-content menu z-[1] w-24 rounded-box border bg-base-100 p-2 shadow">
				<li>
					<button
						class="btn justify-start btn-ghost btn-sm"
						class:btn-active={$locale === 'en'}
						onclick={() => setLocale('en')}
					>
						{$t('ui.language_en')}
					</button>
				</li>
				<li>
					<button
						class="btn justify-start btn-ghost btn-sm"
						class:btn-active={$locale === 'fr'}
						onclick={() => setLocale('fr')}
					>
						{$t('ui.language_fr')}
					</button>
				</li>
			</ul>
		</div>

		{#if authState.isLoading}
			<!-- Loading state -->
			<div class="loading loading-sm loading-spinner"></div>
		{:else if authState.isAuthenticated && authState.user}
			<!-- User is logged in - show user info with dropdown -->
			<div class="dropdown dropdown-end">
				<button
					class="btn h-auto min-h-0 gap-1 px-1 py-1 normal-case btn-ghost"
					tabindex="0"
					aria-label={$t('ui.user_menu')}
				>
					<div class="flex items-center gap-x-1">
						<div class="relative">
							<img
								class="h-8 w-8 sm:h-10 sm:w-10 rounded-full object-cover ring-2 {isConnected()
									? 'ring-success'
									: 'ring-error'} {avatarLoading
									? 'opacity-70'
									: 'opacity-100'} transition-opacity duration-200"
								src={userAvatarUrl}
								alt={$t('ui.user_avatar')}
								title={isConnected() ? $t('ui.connected') : $t('ui.offline')}
							/>
							{#if avatarLoading}
								<div class="absolute inset-0 flex items-center justify-center">
									<div class="loading loading-xs loading-spinner text-primary"></div>
								</div>
							{/if}
						</div>
						<div class="hidden text-left lg:block">
							<h1 class="text-sm sm:text-base font-semibold text-gray-700 capitalize dark:text-white">
								{authState.user.displayName || $t('auth.user')}
							</h1>
							<p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate max-w-32">
								{authState.user.email || $t('auth.no_email')}
							</p>
						</div>
						<svg class="ml-1 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 9l-7 7-7-7"
							></path>
						</svg>
					</div>
				</button>
				<ul
					class="dropdown-content menu z-[1] min-w-56 max-w-80 w-max rounded-box border bg-base-100 p-2 shadow-lg right-0"
					tabindex="0"
				>
					<li class="menu-title px-4 py-2" role="presentation">
						<span class="text-xs text-base-content/60 block text-center whitespace-nowrap" role="none">
							{authState.user.email || $t('auth.no_email')}
						</span>
					</li>
					<div class="divider my-1"></div>
					<li>
						<a href="/profile">{$t('auth.profile')}</a>
					</li>
					{#if permissionState.canAccessSettings() && gameState.selectedGameId}
						<li>
							<a href="/games/{gameState.selectedGameId}/settings">{$t('auth.settings')}</a>
						</li>
					{/if}
					<div class="divider my-1"></div>
					<li>
						<button class="text-error w-full justify-start" onclick={handleLogout}>
							{$t('auth.logout')}
						</button>
					</li>
				</ul>
			</div>
		{:else}
			<!-- User is not logged in - show login button -->
			<button class="btn btn-primary btn-sm sm:btn-md" onclick={handleLogin}>
				<svg class="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
					></path>
				</svg>
				<span class="hidden xs:inline">{$t('auth.login')}</span>
			</button>
		{/if}
	</div>
</header>

<style>
	@keyframes fadeScale {
		from {
			opacity: 0;
			transform: translateY(-4px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
	ul[popover] {
		animation: fadeScale 120ms ease-out;
	}
</style>
