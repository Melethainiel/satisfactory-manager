<script lang="ts">
	import { getRealtimeService } from '$lib/services/realtimeService.svelte';
	import { t } from '$lib/i18n';
	import { getGravatarUrl } from '$lib/utils/gravatar';

	interface Props {
		siteId?: string;
		showActivity?: boolean;
		maxUsers?: number;
	}

	let { siteId, showActivity = false, maxUsers = 5 }: Props = $props();

	const realtimeService = getRealtimeService();

	// Get online users, filtered by site if provided
	const onlineUsers = $derived(() => {
		const users = siteId
			? realtimeService.getUsersInSite(siteId)
			: realtimeService.getOnlineUsers();

		return users.slice(0, maxUsers || 5);
	});

	// Get count of additional users if there are more than maxUsers
	const additionalCount = $derived(() => {
		const totalUsers = siteId
			? realtimeService.getUsersInSite(siteId).length
			: realtimeService.getOnlineUsers().length;

		return Math.max(0, totalUsers - (maxUsers || 5));
	});

	// Connection status indicator
	const isConnected = $derived(() => realtimeService.state.isConnected);
	const connectionError = $derived(() => realtimeService.state.connectionError);

	// Generate avatar URLs for online users
	let userAvatars = $state<Record<string, string>>({});
	let loadingAvatars = $state<Set<string>>(new Set());

	// Update avatars when online users change
	$effect(() => {
		const users = onlineUsers();
		const loadAvatars = async () => {
			// Filter users who need avatar URLs
			const usersNeedingAvatars = users.filter(
				user => user.userEmail && !userAvatars[user.userId] && !loadingAvatars.has(user.userId)
			);

			if (usersNeedingAvatars.length === 0) return;

			// Mark users as loading
			const newLoadingSet = new Set(loadingAvatars);
			usersNeedingAvatars.forEach(user => newLoadingSet.add(user.userId));
			loadingAvatars = newLoadingSet;

			// Load all avatars concurrently
			const avatarPromises = usersNeedingAvatars.map(async (user) => {
				try {
					const avatarUrl = await getGravatarUrl(user.userEmail, { size: 32 });
					return { userId: user.userId, avatarUrl };
				} catch (error) {
					console.error('Error generating Gravatar URL for user:', user.userName, error);
					return { userId: user.userId, avatarUrl: null };
				}
			});

			const results = await Promise.allSettled(avatarPromises);
			
			// Update userAvatars with successful results
			const newAvatars = { ...userAvatars };
			const newLoadingSetAfter = new Set(loadingAvatars);
			
			results.forEach((result) => {
				if (result.status === 'fulfilled' && result.value) {
					const { userId, avatarUrl } = result.value;
					newLoadingSetAfter.delete(userId);
					if (avatarUrl) {
						newAvatars[userId] = avatarUrl;
					}
				}
			});

			// Clean up avatars for users no longer online
			const currentUserIds = users.map(u => u.userId);
			Object.keys(newAvatars).forEach(userId => {
				if (!currentUserIds.includes(userId)) {
					delete newAvatars[userId];
					newLoadingSetAfter.delete(userId);
				}
			});

			userAvatars = newAvatars;
			loadingAvatars = newLoadingSetAfter;
		};

		loadAvatars();
	});

	// Debug: log connection state changes
	$effect(() => {
		console.log('🔌 WebSocket connection state changed:', {
			isConnected: isConnected,
			isConnecting: realtimeService.state.isConnecting,
			onlineUsers: onlineUsers.length,
			error: connectionError
		});
	});
</script>

{#if onlineUsers.length > 0}
	<div class="flex items-center gap-2">
		<!-- Online users avatars -->
		<div class="flex -space-x-2">
			{#each onlineUsers() as user}
				<div
					class="avatar"
					title="{user.userName} {user.activity ? `- ${user.activity}` : ''}"
				>
					{#if userAvatars[user.userId]}
						<div class="h-8 w-8 rounded-full">
							<img
								class="h-8 w-8 rounded-full object-cover"
								src={userAvatars[user.userId]}
								alt={user.userName}
							/>
						</div>
					{:else if loadingAvatars.has(user.userId)}
						<div class="relative h-8 w-8 rounded-full bg-neutral text-neutral-content">
							<div class="placeholder h-8 w-8 rounded-full bg-neutral text-neutral-content opacity-50">
								<span class="text-xs font-medium">
									{user.userName.substring(0, 2).toUpperCase()}
								</span>
							</div>
							<div class="absolute inset-0 flex items-center justify-center">
								<div class="loading loading-spinner loading-xs text-primary"></div>
							</div>
						</div>
					{:else}
						<div class="placeholder h-8 w-8 rounded-full bg-neutral text-neutral-content">
							<span class="text-xs font-medium">
								{user.userName.substring(0, 2).toUpperCase()}
							</span>
						</div>
					{/if}
					{#if user.activity && showActivity}
						<div class="indicator-item badge badge-xs badge-info" title={user.activity}></div>
					{/if}
				</div>
			{/each}

			{#if additionalCount() > 0}
				<div class="placeholder avatar">
					<div class="h-8 w-8 rounded-full bg-base-300 text-base-content">
						<span class="text-xs">+{additionalCount}</span>
					</div>
				</div>
			{/if}
		</div>

		<!-- Online count text -->
		<span class="text-sm text-base-content/70">
			{onlineUsers().length + additionalCount()} {$t('ui.online')}
		</span>
	</div>
{/if}
