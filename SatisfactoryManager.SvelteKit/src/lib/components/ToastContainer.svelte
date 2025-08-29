<script lang="ts">
	import { notificationService, type Notification } from '$lib/services/notificationService.svelte';
	import { fly } from 'svelte/transition';
	import { t } from '$lib/i18n';

	// Get notifications from the service
	let { notifications } = $derived({ notifications: notificationService.notifications });

	// CSS classes for different notification types
	const getAlertClass = (type: Notification['type']) => {
		switch (type) {
			case 'success':
				return 'alert-success';
			case 'error':
				return 'alert-error';
			case 'warning':
				return 'alert-warning';
			case 'info':
				return 'alert-info';
			default:
				return 'alert-info';
		}
	};

	const handleDismiss = (id: string) => {
		notificationService.dismiss(id);
	};

	const handleAction = (action: () => void, id: string) => {
		action();
		notificationService.dismiss(id);
	};
</script>

<!-- Toast container positioned at top-right -->
<div class="toast-top toast-end toast z-50">
	{#each notifications as notification (notification.id)}
		<div
			class="alert {getAlertClass(notification.type)} max-w-md shadow-lg"
			role="alert"
			transition:fly={{ y: -50, duration: 300 }}
		>
			<!-- Icon -->
			{#if notification.type === 'success'}
				<svg class="h-6 w-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
					></path>
				</svg>
			{:else if notification.type === 'error' || notification.type === 'warning'}
				<svg class="h-6 w-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
					></path>
				</svg>
			{:else}
				<svg class="h-6 w-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					></path>
				</svg>
			{/if}

			<!-- Content -->
			<div class="flex-1">
				{#if notification.title}
					<h3 class="font-bold">{notification.title}</h3>
				{/if}
				<div class="text-xs">{notification.message}</div>

				<!-- Actions -->
				{#if notification.actions && notification.actions.length > 0}
					<div class="mt-2 flex gap-2">
						{#each notification.actions as action}
							<button
								class="btn btn-xs {action.style === 'primary'
									? 'btn-primary'
									: action.style === 'secondary'
										? 'btn-secondary'
										: 'btn-ghost'}"
								onclick={() => handleAction(action.action, notification.id)}
							>
								{action.label}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Close button -->
			<button
				class="btn btn-circle btn-ghost btn-sm"
				onclick={() => handleDismiss(notification.id)}
				aria-label={$t('ui.close_notification')}
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					></path>
				</svg>
			</button>
		</div>
	{/each}
</div>
