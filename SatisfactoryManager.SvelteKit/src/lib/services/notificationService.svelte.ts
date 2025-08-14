// Notification types for different toast styles
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

// Notification item interface
export interface Notification {
	id: string;
	type: NotificationType;
	title?: string;
	message: string;
	duration?: number; // in milliseconds, 0 for permanent
	actions?: Array<{
		label: string;
		action: () => void;
		style?: 'primary' | 'secondary' | 'ghost';
	}>;
}

// Notification service state
class NotificationService {
	// Reactive state using Svelte 5 $state rune
	notifications = $state<Notification[]>([]);

	// Add a new notification
	show = (
		type: NotificationType,
		message: string,
		options?: {
			title?: string;
			duration?: number;
			actions?: Notification['actions'];
		}
	): string => {
		const id = crypto.randomUUID();
		const notification: Notification = {
			id,
			type,
			message,
			title: options?.title,
			duration: options?.duration ?? (type === 'error' ? 0 : 5000), // Errors stay until dismissed
			actions: options?.actions
		};

		this.notifications.push(notification);

		// Auto-remove after duration (if not permanent)
		if (notification.duration && notification.duration > 0) {
			setTimeout(() => {
				this.dismiss(id);
			}, notification.duration);
		}

		return id;
	};

	// Convenience methods for different notification types
	success = (message: string, options?: { title?: string; actions?: Notification['actions'] }) => {
		return this.show('success', message, { ...options, duration: options?.title ? 4000 : 3000 });
	};

	error = (message: string, options?: { title?: string; actions?: Notification['actions'] }) => {
		return this.show('error', message, { ...options, duration: 0 }); // Errors stay until dismissed
	};

	warning = (message: string, options?: { title?: string; actions?: Notification['actions'] }) => {
		return this.show('warning', message, { ...options, duration: options?.title ? 5000 : 4000 });
	};

	info = (message: string, options?: { title?: string; actions?: Notification['actions'] }) => {
		return this.show('info', message, { ...options, duration: options?.title ? 4000 : 3000 });
	};

	// Dismiss a specific notification
	dismiss = (id: string): void => {
		const index = this.notifications.findIndex((n) => n.id === id);
		if (index > -1) {
			this.notifications.splice(index, 1);
		}
	};

	// Clear all notifications
	clear = (): void => {
		this.notifications.length = 0;
	};

	// Clear notifications by type
	clearByType = (type: NotificationType): void => {
		this.notifications = this.notifications.filter((n) => n.type !== type);
	};
}

// Export singleton instance
export const notificationService = new NotificationService();
