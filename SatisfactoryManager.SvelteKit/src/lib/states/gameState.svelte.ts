import { getContext, setContext } from 'svelte';
import { notificationService } from '$lib/services/notificationService.svelte';

export interface GameSummary {
	id: string;
	name: string;
}

export interface GameUser {
	id: string;
	displayName: string;
	email: string;
	role: string;
}

export interface GameModule {
	id: string;
	name: string;
	url: string;
	currentVersion: string | null;
	githubRepo: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface GameSite {
	id: string;
	name: string;
	gameId: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface GameState {
	games: GameSummary[];
	selectedGameId: string | null;
	isLoading: boolean;
	loadGames: (userEmail: string) => Promise<void>;
	selectGame: (id: string) => void;
	createGame: (userEmail: string, name: string) => Promise<void>;
	updateGame: (id: string, name: string) => Promise<void>;
	deleteGame: (id: string) => Promise<void>;
	loadGameUsers: (gameId: string) => Promise<void>;
	addGameUser: (gameId: string, users: string[]) => Promise<void>;
	removeGameUser: (gameId: string, userEmail: string) => Promise<void>;
	updateGameUserRole: (gameId: string, userEmail: string, role: string) => Promise<void>;
	gameUsers: GameUser[];
	loadGameModules: (gameId: string) => Promise<void>;
	addGameModule: (gameId: string, moduleId: string) => Promise<void>;
	removeGameModule: (gameId: string, moduleId: string) => Promise<void>;
	gameModules: GameModule[];
	loadGameSites: (gameId: string) => Promise<void>;
	createGameSite: (gameId: string, name: string) => Promise<void>;
	updateGameSite: (gameId: string, siteId: string, name: string) => Promise<void>;
	deleteGameSite: (gameId: string, siteId: string) => Promise<void>;
	gameSites: GameSite[];
	selectedSiteId: string | null;
	selectSite: (siteId: string | null) => void;
	attachAuth: (apiFetch: AuthFetchFn) => void;
}

// Narrow helper type so we don't import full AuthState here.
type AuthFetchFn = <T = any>(
	input: string | URL | Request,
	init?: RequestInit & { autoJson?: boolean }
) => Promise<T | Response>;

class GameStateClass implements GameState {
	// Function injected from auth state to fetch API token
	private apiFetch: AuthFetchFn | null = null;

	attachAuth(apiFetch: AuthFetchFn) {
		this.apiFetch = apiFetch;
	}
	async deleteGame(id: string) {
		if (!id) {
			notificationService.error('Game ID is required');
			return;
		}
		if (!this.apiFetch) return;

		this.isLoading = true;
		try {
			const res = await this.apiFetch(`/api/games/${id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error(`Failed to delete game (${res.status})`);
			// Remove from local state
			this.games = this.games.filter((g) => g.id !== id);
			if (this.selectedGameId === id) this.selectedGameId = null;
			notificationService.success('Game deleted successfully');
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to delete game');
		} finally {
			this.isLoading = false;
		}
	}
	games = $state<GameSummary[]>([]);
	selectedGameId = $state<string | null>(null);
	isLoading = $state<boolean>(false);
	gameUsers = $state<GameUser[]>([]);
	gameModules = $state<GameModule[]>([]);
	gameSites = $state<GameSite[]>([]);
	selectedSiteId = $state<string | null>(null);

	async loadGames(userEmail: string) {
		if (!userEmail) {
			notificationService.error('User email is required');
			return;
		}
		if (!this.apiFetch) return;

		this.isLoading = true;
		try {
			const res = await this.apiFetch(`/api/games?email=${encodeURIComponent(userEmail)}`);
			if (!res.ok) throw new Error(`Failed to load games (${res.status})`);
			const data = (await res.json()) as GameSummary[];
			this.games = data;
			// Auto-select if only one
			if (data.length === 1) this.selectedGameId = data[0].id;
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to load games');
		} finally {
			this.isLoading = false;
		}
	}

	selectGame(id: string) {
		this.selectedGameId = id;
	}

	async createGame(userEmail: string, name: string) {
		if (!userEmail) {
			notificationService.error('User email is required');
			return;
		}
		if (!name) {
			notificationService.error('Game name is required');
			return;
		}
		if (!this.apiFetch) return;

		this.isLoading = true;
		try {
			const res = await this.apiFetch('/api/games', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email: userEmail, name })
			});
			if (!res.ok) throw new Error(`Failed to create game (${res.status})`);
			const created = (await res.json()) as GameSummary;
			this.games = [...this.games, created].sort((a, b) => a.name.localeCompare(b.name));
			this.selectedGameId = created.id;
			notificationService.success(`Game "${name}" created successfully`);
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to create game');
		} finally {
			this.isLoading = false;
		}
	}

	async updateGame(id: string, name: string) {
		if (!id) {
			notificationService.error('Game ID is required');
			return;
		}
		if (!name) {
			notificationService.error('Game name is required');
			return;
		}
		if (!this.apiFetch) return;

		this.isLoading = true;
		try {
			const res = await this.apiFetch(`/api/games/${id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name })
			});
			if (!res.ok) throw new Error(`Failed to update game (${res.status})`);
			const updated = (await res.json()) as GameSummary;
			this.games = this.games
				.map((g) => (g.id === id ? updated : g))
				.sort((a, b) => a.name.localeCompare(b.name));
			notificationService.success(`Game updated to "${name}"`);
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to update game');
		} finally {
			this.isLoading = false;
		}
	}

	async loadGameUsers(gameId: string) {
		if (!gameId || !this.apiFetch) return;
		try {
			const res = await this.apiFetch(`/api/games/${gameId}/users`);
			if (!res.ok) throw new Error(`Failed to load users (${res.status})`);
			const data = (await res.json()) as GameUser[];
			this.gameUsers = data.sort((a, b) => a.displayName.localeCompare(b.displayName));
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to load game users');
		}
	}

	async addGameUser(gameId: string, users: string[]) {
		if (!gameId || !this.apiFetch) return;
		try {
			const res = await this.apiFetch(`/api/games/${gameId}/users`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ emails: users })
			});
			if (!res.ok) throw new Error(`Failed to add users (${res.status})`);
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to add game users');
		}
	}

	async removeGameUser(gameId: string, userEmail: string) {
		if (!gameId || !this.apiFetch) return;
		try {
			const res = await this.apiFetch(`/api/games/${gameId}/users`, {
				method: 'DELETE',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email: userEmail })
			});
			if (!res.ok) throw new Error(`Failed to remove user (${res.status})`);
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to remove game user');
		}
	}

	async updateGameUserRole(gameId: string, userEmail: string, role: string) {
		if (!gameId || !this.apiFetch) return;
		try {
			const res = await this.apiFetch(`/api/games/${gameId}/users`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email: userEmail, role })
			});
			if (!res.ok) throw new Error(`Failed to update role (${res.status})`);
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to update game user role');
		}
	}

	async loadGameModules(gameId: string) {
		if (!gameId || !this.apiFetch) return;
		try {
			const res = await this.apiFetch(`/api/games/${gameId}/modules`);
			if (!res.ok) throw new Error(`Failed to load modules (${res.status})`);
			const data = (await res.json()) as GameModule[];
			this.gameModules = data.sort((a, b) => a.name.localeCompare(b.name));
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to load game modules');
		}
	}

	async addGameModule(gameId: string, moduleId: string) {
		if (!gameId || !moduleId || !this.apiFetch) return;
		try {
			const res = await this.apiFetch(`/api/games/${gameId}/modules`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ moduleId })
			});
			if (!res.ok) throw new Error(`Failed to add module (${res.status})`);
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to add game module');
		}
	}

	async removeGameModule(gameId: string, moduleId: string) {
		if (!gameId || !moduleId || !this.apiFetch) return;
		try {
			const res = await this.apiFetch(`/api/games/${gameId}/modules`, {
				method: 'DELETE',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ moduleId })
			});
			if (!res.ok) throw new Error(`Failed to remove module (${res.status})`);
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to remove game module');
		}
	}

	selectSite(siteId: string | null) {
		this.selectedSiteId = siteId;
	}

	async loadGameSites(gameId: string) {
		if (!gameId || !this.apiFetch) return;
		try {
			const res = await this.apiFetch(`/api/games/${gameId}/sites`);
			if (!res.ok) throw new Error(`Failed to load sites (${res.status})`);
			const data = (await res.json()) as GameSite[];
			this.gameSites = data.sort((a, b) => a.name.localeCompare(b.name));
			// Auto-select first site if none selected
			if (this.gameSites.length > 0 && !this.selectedSiteId) {
				this.selectedSiteId = this.gameSites[0].id;
			}
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to load game sites');
		}
	}

	async createGameSite(gameId: string, name: string) {
		if (!gameId || !name || !this.apiFetch) return;
		try {
			const res = await this.apiFetch(`/api/games/${gameId}/sites`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name })
			});
			if (!res.ok) throw new Error(`Failed to create site (${res.status})`);
			const created = (await res.json()) as GameSite;
			this.gameSites = [...this.gameSites, created].sort((a, b) => a.name.localeCompare(b.name));
			this.selectedSiteId = created.id;
			notificationService.success(`Site "${name}" created successfully`);
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to create site');
		}
	}

	async updateGameSite(gameId: string, siteId: string, name: string) {
		if (!gameId || !siteId || !name || !this.apiFetch) return;
		try {
			const res = await this.apiFetch(`/api/games/${gameId}/sites/${siteId}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name })
			});
			if (!res.ok) throw new Error(`Failed to update site (${res.status})`);
			const updated = (await res.json()) as GameSite;
			this.gameSites = this.gameSites
				.map((s) => (s.id === siteId ? updated : s))
				.sort((a, b) => a.name.localeCompare(b.name));
			notificationService.success(`Site renamed to "${name}"`);
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to update site');
		}
	}

	async deleteGameSite(gameId: string, siteId: string) {
		if (!gameId || !siteId || !this.apiFetch) return;
		try {
			const res = await this.apiFetch(`/api/games/${gameId}/sites/${siteId}`, {
				method: 'DELETE'
			});
			if (!res.ok) throw new Error(`Failed to delete site (${res.status})`);
			this.gameSites = this.gameSites.filter((s) => s.id !== siteId);
			// Clear selection if deleted site was selected
			if (this.selectedSiteId === siteId) {
				this.selectedSiteId = this.gameSites.length > 0 ? this.gameSites[0].id : null;
			}
			notificationService.success('Site deleted successfully');
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to delete site');
		}
	}
}

const DEFAULT_GAME_STATE_KEY = '$_game_state';

export const getGameState = (key = DEFAULT_GAME_STATE_KEY): GameState => getContext<GameState>(key);
export const setGameState = (key = DEFAULT_GAME_STATE_KEY): GameState => {
	const gs = new GameStateClass();
	return setContext(key, gs);
};
