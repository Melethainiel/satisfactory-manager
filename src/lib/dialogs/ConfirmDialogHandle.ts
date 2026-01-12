export interface ConfirmDialogHandle {
	open(options: {
		title: string;
		message: string;
		confirmText?: string;
		cancelText?: string;
		type?: 'danger' | 'warning' | 'info';
		onConfirm: () => Promise<void> | void;
	}): void;
}
