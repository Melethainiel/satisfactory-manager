import type { ProductionInstanceData } from '$lib/states/gameState.svelte';

export interface EditProductionInstanceDialogHandle {
	open: (instance: ProductionInstanceData) => void;
}