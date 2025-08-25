import { getContext, setContext } from 'svelte';
import { notificationService } from '$lib/services/notificationService.svelte';

export interface GameSummary {
	id: string;
	name: string;
	role?: string;
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
	selectedVersion: string | null;
	selectedVersionId: string | null;
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

export interface ProductionInstanceData {
	id: string;
	siteId: string;
	recipeVersionId: string;
	buildingId: string;
	buildingCount: number;
	efficiencyRatio: number;
	notes?: string;
	createdAt: Date;
	updatedAt: Date;
	// Related data populated from API
	site?: {
		id: string;
		name: string;
		gameId: string;
	};
	recipe?: {
		id: string;
		displayName: string;
		className: string;
	};
	recipeVersion?: {
		id: string;
		manufacturingDuration: number;
	};
	building?: {
		id: string;
		name: string;
		className: string;
		type: string;
	};
	products?: Array<{
		itemId: string;
		count: number;
		item: {
			displayName: string;
			className: string;
			form: string;
		};
	}>;
	ingredients?: Array<{
		itemId: string;
		count: number;
		item: {
			displayName: string;
			className: string;
			form: string;
		};
	}>;
}

export interface ProductionOverview {
	totalProduction: Array<{ itemId: string; itemName: string; rate: number }>;
	totalConsumption: Array<{ itemId: string; itemName: string; rate: number }>;
	netBalance: Array<{ itemId: string; itemName: string; balance: number }>;
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
	setGameModuleVersion: (gameId: string, moduleId: string, versionId: string) => Promise<void>;
	gameModules: GameModule[];
	loadGameSites: (gameId: string) => Promise<void>;
	createGameSite: (gameId: string, name: string) => Promise<void>;
	updateGameSite: (gameId: string, siteId: string, name: string) => Promise<void>;
	deleteGameSite: (gameId: string, siteId: string) => Promise<void>;
	gameSites: GameSite[];
	selectedSiteId: string | null;
	selectSite: (siteId: string | null) => void;
	// Recipe instances management
	siteProductionInstances: ProductionInstanceData[];
	loadSiteProductionInstances: (siteId: string) => Promise<void>;
	createProductionInstance: (siteId: string, data: {
		recipeVersionId: string;
		buildingId: string;
		buildingCount: number;
		efficiencyRatio?: number;
		notes?: string;
	}) => Promise<void>;
	updateProductionInstance: (instanceId: string, data: {
		recipeVersionId?: string;
		buildingId?: string;
		buildingCount?: number;
		efficiencyRatio?: number;
		notes?: string;
	}) => Promise<void>;
	deleteProductionInstance: (instanceId: string) => Promise<void>;
	// Production calculations
	siteProductionOverview: ProductionOverview | null;
	loadSiteProductionOverview: (siteId: string) => Promise<void>;
	attachAuth: (apiFetch: AuthFetchFn) => void;
	getApiFetch: () => AuthFetchFn | null;
	getUserRole: (userEmail: string) => string | null;
	canManageSettings: (userEmail: string) => boolean;
	canManageSites: (userEmail: string) => boolean;
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

	getApiFetch(): AuthFetchFn | null {
		return this.apiFetch;
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
	// Recipe instances state
	siteProductionInstances = $state<ProductionInstanceData[]>([]);
	siteProductionOverview = $state<ProductionOverview | null>(null);

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

	async setGameModuleVersion(gameId: string, moduleId: string, versionId: string) {
		if (!gameId || !moduleId || !versionId || !this.apiFetch) return;
		try {
			const res = await this.apiFetch(`/api/games/${gameId}/modules/${moduleId}/version`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ versionId })
			});
			if (!res.ok) throw new Error(`Failed to set module version (${res.status})`);

			// Reload modules to get updated version info
			await this.loadGameModules(gameId);
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to set module version');
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

	// Production instances management
	async loadSiteProductionInstances(siteId: string) {
		if (!siteId || !this.apiFetch) return;

		this.isLoading = true;
		try {
			const response = await this.apiFetch(`/api/sites/${siteId}/production-instances`);
			if (!response.ok) throw new Error(`Failed to load production instances (${response.status})`);
			
			const data = await response.json();
			if (data.success) {
				// Convert string dates to Date objects
				this.siteProductionInstances = data.data.map((instance: any) => ({
					...instance,
					buildingCount: parseFloat(instance.buildingCount),
					efficiencyRatio: parseFloat(instance.efficiencyRatio),
					createdAt: new Date(instance.createdAt),
					updatedAt: new Date(instance.updatedAt)
				}));
			}
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to load production instances');
		} finally {
			this.isLoading = false;
		}
	}

	async createProductionInstance(siteId: string, data: {
		recipeVersionId: string;
		buildingId: string;
		buildingCount: number;
		efficiencyRatio?: number;
		notes?: string;
	}) {
		if (!siteId || !this.apiFetch) return;

		this.isLoading = true;
		try {
			const response = await this.apiFetch(`/api/sites/${siteId}/production-instances`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
			
			if (!response.ok) throw new Error(`Failed to create production instance (${response.status})`);
			
			const result = await response.json();
			if (result.success) {
				// Reload instances to get the new one with full details
				await this.loadSiteProductionInstances(siteId);
				// Reload production overview
				await this.loadSiteProductionOverview(siteId);
				notificationService.success('Production instance created successfully');
			}
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to create production instance');
		} finally {
			this.isLoading = false;
		}
	}

	async updateProductionInstance(instanceId: string, data: {
		recipeVersionId?: string;
		buildingId?: string;
		buildingCount?: number;
		efficiencyRatio?: number;
		notes?: string;
	}) {
		if (!instanceId || !this.apiFetch) return;

		this.isLoading = true;
		try {
			const response = await this.apiFetch(`/api/sites/_/production-instances/${instanceId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
			
			if (!response.ok) throw new Error(`Failed to update production instance (${response.status})`);
			
			const result = await response.json();
			if (result.success) {
				// Find the instance and reload the site's instances
				const instance = this.siteProductionInstances.find((i: ProductionInstanceData) => i.id === instanceId);
				if (instance) {
					await this.loadSiteProductionInstances(instance.siteId);
					await this.loadSiteProductionOverview(instance.siteId);
				}
				notificationService.success('Production instance updated successfully');
			}
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to update production instance');
		} finally {
			this.isLoading = false;
		}
	}

	async deleteProductionInstance(instanceId: string) {
		if (!instanceId || !this.apiFetch) return;

		this.isLoading = true;
		try {
			const response = await this.apiFetch(`/api/sites/_/production-instances/${instanceId}`, {
				method: 'DELETE'
			});
			
			if (!response.ok) throw new Error(`Failed to delete production instance (${response.status})`);
			
			const result = await response.json();
			if (result.success) {
				// Find the instance and reload the site's instances
				const instance = this.siteProductionInstances.find((i: ProductionInstanceData) => i.id === instanceId);
				if (instance) {
					await this.loadSiteProductionInstances(instance.siteId);
					await this.loadSiteProductionOverview(instance.siteId);
				}
				notificationService.success('Production instance deleted successfully');
			}
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to delete production instance');
		} finally {
			this.isLoading = false;
		}
	}

	async loadSiteProductionOverview(siteId: string) {
		if (!siteId || !this.apiFetch) return;

		try {
			const response = await this.apiFetch(`/api/sites/${siteId}/production-overview`);
			if (!response.ok) throw new Error(`Failed to load production overview (${response.status})`);
			
			const data = await response.json();
			if (data.success) {
				this.siteProductionOverview = data.data;
			}
		} catch (e: any) {
			console.error('Failed to load production overview:', e);
			this.siteProductionOverview = null;
		}
	}

	getUserRole(userEmail: string): string | null {
		const currentUser = this.gameUsers.find((u) => u.email === userEmail.toLowerCase());
		return currentUser?.role || null;
	}

	canManageSettings(userEmail: string): boolean {
		const currentUser = this.gameUsers.find((u) => u.email === userEmail.toLowerCase());
		return currentUser ? ['Administrator', 'Owner'].includes(currentUser.role) : false;
	}

	canManageSites(userEmail: string): boolean {
		const currentUser = this.gameUsers.find((u) => u.email === userEmail.toLowerCase());
		return currentUser
			? ['Contributor', 'Administrator', 'Owner'].includes(currentUser.role)
			: false;
	}
}

const DEFAULT_GAME_STATE_KEY = '$_game_state';

export const getGameState = (key = DEFAULT_GAME_STATE_KEY): GameState => getContext<GameState>(key);
export const setGameState = (key = DEFAULT_GAME_STATE_KEY): GameState => {
	const gs = new GameStateClass();
	return setContext(key, gs);
};
