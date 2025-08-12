<script lang="ts">
	import type { ConfirmDialogHandle } from './ConfirmDialogHandle';

	let dialogEl: HTMLDialogElement | null = null;
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	let options = $state<{
		title: string;
		message: string;
		confirmText: string;
		cancelText: string;
		type: 'danger' | 'warning' | 'info';
		onConfirm: () => Promise<void> | void;
	}>({
		title: '',
		message: '',
		confirmText: 'Confirm',
		cancelText: 'Cancel',
		type: 'info',
		onConfirm: () => {}
	});

	async function handleConfirm() {
		if (!options.onConfirm) return;

		isLoading = true;
		error = null;

		try {
			await options.onConfirm();
			dialogEl?.close();
		} catch (e: any) {
			error = e?.message ?? 'An error occurred';
		} finally {
			isLoading = false;
		}
	}

	function handleCancel() {
		if (!isLoading) {
			dialogEl?.close();
		}
	}

	function onClose() {
		if (!isLoading) {
			error = null;
		}
	}

	function getButtonClass(type: string): string {
		switch (type) {
			case 'danger':
				return 'btn-error';
			case 'warning':
				return 'btn-warning';
			case 'info':
			default:
				return 'btn-primary';
		}
	}

	function getTitleClass(type: string): string {
		switch (type) {
			case 'danger':
				return 'text-error';
			case 'warning':
				return 'text-warning';
			case 'info':
			default:
				return 'text-primary';
		}
	}

	export const open: ConfirmDialogHandle['open'] = (dialogOptions) => {
		options = {
			title: dialogOptions.title,
			message: dialogOptions.message,
			confirmText: dialogOptions.confirmText ?? 'Confirm',
			cancelText: dialogOptions.cancelText ?? 'Cancel',
			type: dialogOptions.type ?? 'info',
			onConfirm: dialogOptions.onConfirm
		};
		error = null;
		isLoading = false;
		dialogEl?.showModal();
	};
</script>

<dialog bind:this={dialogEl} class="modal" onclose={onClose}>
	<div class="modal-box">
		<h3 class="text-lg font-bold {getTitleClass(options.type)}">{options.title}</h3>
		<p class="py-4">{options.message}</p>

		{#if error}
			<div class="mb-4 alert alert-error py-2 text-sm">
				<span>{error}</span>
				<button class="btn btn-xs" onclick={() => (error = null)}>Clear</button>
			</div>
		{/if}

		<div class="modal-action">
			<button type="button" class="btn" onclick={handleCancel} disabled={isLoading}>
				{options.cancelText}
			</button>
			<button
				type="button"
				class="btn {getButtonClass(options.type)}"
				onclick={handleConfirm}
				disabled={isLoading}
			>
				{#if isLoading}
					<span class="loading loading-sm loading-spinner"></span>
				{/if}
				{options.confirmText}
			</button>
		</div>
	</div>
</dialog>
