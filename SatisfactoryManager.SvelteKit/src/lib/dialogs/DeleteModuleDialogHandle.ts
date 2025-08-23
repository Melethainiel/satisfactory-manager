import DeleteModuleDialog from './DeleteModuleDialog.svelte';

interface Module {
	id: string;
	name: string;
	url: string;
	currentVersion: string | null;
	githubRepo: string | null;
	createdAt: Date;
	updatedAt: Date;
}

let deleteModuleDialogRef: DeleteModuleDialog | null = null;

export function getDeleteModuleDialog(): DeleteModuleDialog | null {
	return deleteModuleDialogRef;
}

export function setDeleteModuleDialog(dialog: DeleteModuleDialog): void {
	deleteModuleDialogRef = dialog;
}

export function openDeleteModuleDialog(
	module: Module,
	onDeleted?: (moduleId: string) => void
): void {
	deleteModuleDialogRef?.open(module, onDeleted);
}
