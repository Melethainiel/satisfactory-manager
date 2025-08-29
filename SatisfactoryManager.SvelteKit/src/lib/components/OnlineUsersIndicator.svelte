<script lang="ts">
	import { getRealtimeService } from '$lib/services/realtimeService.svelte';

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
					class="placeholder avatar"
					title="{user.userName} {user.activity ? `- ${user.activity}` : ''}"
				>
					<div class="h-8 w-8 rounded-full bg-neutral text-neutral-content">
						<span class="text-xs font-medium">
							{user.userName.substring(0, 2).toUpperCase()}
						</span>
					</div>
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
			{onlineUsers().length + additionalCount()} online
		</span>
	</div>
{/if}
