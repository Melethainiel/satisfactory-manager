export interface CreateModuleDialogHandle {
	open(callback?: (module: { id: string; name: string; url: string }) => void): void;
}
