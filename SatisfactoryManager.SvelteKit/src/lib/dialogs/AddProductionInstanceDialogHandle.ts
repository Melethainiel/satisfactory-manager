export interface AddProductionInstanceDialogHandle {
	open: (siteId: string) => Promise<void>;
}