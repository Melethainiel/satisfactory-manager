interface Module {
	id: string;
	name: string;
	url: string;
	currentVersion: string | null;
	githubRepo: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface ModuleVersionDialogHandle {
	open(module: Module): void;
}