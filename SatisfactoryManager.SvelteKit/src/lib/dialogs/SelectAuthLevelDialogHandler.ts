export interface SelectAuthLevelDialogHandler {
	open: (email: string, currentRole?: string) => void;
}
