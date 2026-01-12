import { getContext, setContext } from 'svelte';
import type { GameState } from './gameState.svelte';
import type { AuthState } from './authState.svelte';

export interface PermissionState {
	canAccessSettings: () => boolean;
	canManageSites: () => boolean;
	getUserRole: () => string | null;
}

class PermissionStateClass implements PermissionState {
	private authState: AuthState;
	private gameState: GameState;

	constructor(authState: AuthState, gameState: GameState) {
		this.authState = authState;
		this.gameState = gameState;
	}

	canAccessSettings = $derived(() => {
		if (!this.authState.isAuthenticated || !this.authState.user?.email) return false;

		// For home page: check if we have embedded role data in games
		if (!this.gameState.selectedGameId) {
			// Try to find any game where user has Administrator or Owner role
			return this.gameState.games.some(
				(game) => game.role && ['Administrator', 'Owner'].includes(game.role)
			);
		}

		// For selected game: use existing gameState logic
		return this.gameState.canManageSettings(this.authState.user.email);
	});

	canManageSites = $derived(() => {
		if (!this.authState.isAuthenticated || !this.authState.user?.email) return false;

		// For home page: check if we have embedded role data in games
		if (!this.gameState.selectedGameId) {
			// Try to find any game where user has Contributor+ role
			return this.gameState.games.some(
				(game) => game.role && ['Contributor', 'Administrator', 'Owner'].includes(game.role)
			);
		}

		// For selected game: use existing gameState logic
		return this.gameState.canManageSites(this.authState.user.email);
	});

	getUserRole = $derived(() => {
		if (!this.authState.isAuthenticated || !this.authState.user?.email) return null;

		// For selected game: use existing gameState logic
		if (this.gameState.selectedGameId) {
			return this.gameState.getUserRole(this.authState.user.email);
		}

		// For home page: return the highest role from any game
		const roles = this.gameState.games.map((game) => game.role).filter(Boolean);

		if (roles.includes('Owner')) return 'Owner';
		if (roles.includes('Administrator')) return 'Administrator';
		if (roles.includes('Contributor')) return 'Contributor';
		if (roles.includes('Reader')) return 'Reader';

		return null;
	});
}

const DEFAULT_PERMISSION_STATE_KEY = '$_permission_state';

export const getPermissionState = (key = DEFAULT_PERMISSION_STATE_KEY): PermissionState =>
	getContext<PermissionState>(key);

export const setPermissionState = (
	authState: AuthState,
	gameState: GameState,
	key = DEFAULT_PERMISSION_STATE_KEY
): PermissionState => {
	const ps = new PermissionStateClass(authState, gameState);
	return setContext(key, ps);
};
