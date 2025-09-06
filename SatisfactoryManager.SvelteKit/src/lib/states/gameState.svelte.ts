import { getContext, setContext } from 'svelte';
import { notificationService } from '$lib/services/notificationService.svelte';
import { apiService } from '$lib/services/apiService';

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
	recipeVersionId: string | null;
	buildingVersionId: string;
	extractedItemVersionId: string | null;
	fuelItemVersionId: string | null;
	extractorPurity: string | null;
	buildingCount: string;
	efficiencyRatio: string;
	somersloopCount: number;
	isBuilt: boolean;
	notes: string | null;
	createdAt: Date;
	updatedAt: Date;
	// Calculated production metrics
	production: {
		itemsPerMinute: number;
		totalProduction: number;
		buildingUtilization: number;
		powerConsumption: number;
		powerProduction: number;
	};
	// Related data populated from API
	site: {
		id: string;
		name: string;
		gameId: string;
	};
	recipe: {
		id: string;
		displayName: string;
		className: string;
	} | null;
	recipeVersion: {
		id: string;
		manufacturingDuration: string;
	} | null;
	building: {
		id: string;
		name: string;
		className: string;
		type: string;
	};
	buildingVersion: {
		id: string;
		output: string | null;
		energyConsumption: string | null;
		energyProduction: string | null;
		productionShardSlotSize: number;
	} | null;
	products: Array<{
		itemId: string;
		count: string;
		actualRate: number;
		item: {
			displayName: string;
			className: string;
			form: string;
		};
	}>;
	ingredients: Array<{
		itemId: string;
		count: string;
		actualRate: number;
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
	totalPowerConsumption: number;
	totalPowerProduction: number;
	netPowerBalance: number;
}

export interface ProductionMetrics {
	totalInstances: number;
	totalBuildings: number;
	averageEfficiency: number;
	uniqueItems: number;
	lastUpdated: Date;
}

export interface ProductionSummary {
	instances: ProductionInstanceData[];
	overview: ProductionOverview;
	metrics: ProductionMetrics;
}

// Dashboard interfaces
export interface GameDashboardSiteData {
	siteId: string;
	siteName: string;
	totalProduction: Array<{ itemId: string; itemName: string; rate: number }>;
	totalConsumption: Array<{ itemId: string; itemName: string; rate: number }>;
	powerConsumption: number;
	powerProduction: number;
	instanceCount: number;
	buildingCount: number;
	averageEfficiency: number;
}

export interface GameDashboardAggregatedData {
	totalProduction: Array<{
		itemId: string;
		itemName: string;
		rate: number;
		sites: Array<{ siteId: string; siteName: string; rate: number }>;
	}>;
	totalConsumption: Array<{
		itemId: string;
		itemName: string;
		rate: number;
		sites: Array<{ siteId: string; siteName: string; rate: number }>;
	}>;
	netBalance: Array<{ itemId: string; itemName: string; balance: number }>;
	totalPowerConsumption: number;
	totalPowerProduction: number;
	netPowerBalance: number;
	totalInstances: number;
	totalBuildings: number;
	averageEfficiency: number;
	uniqueItems: number;
}

export interface GameDashboardPerformanceData {
	topProducingSites: Array<{ siteId: string; siteName: string; productionScore: number }>;
	powerEfficiencyBySite: Array<{ siteId: string; siteName: string; efficiency: number }>;
	bottlenecks: Array<{ itemId: string; itemName: string; deficit: number; sites: string[] }>;
}

export interface GameDashboardData {
	sites: GameDashboardSiteData[];
	aggregated: GameDashboardAggregatedData;
	performance: GameDashboardPerformanceData;
	lastUpdated: Date;
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
	selectSite: (siteId: string | null, updateUrl?: boolean) => void;
	// Production management - consolidated
	siteProductionSummary: ProductionSummary | null;
	loadSiteProductionSummary: (siteId: string, fresh?: boolean) => Promise<void>;
	createProductionInstance: (
		siteId: string,
		data: {
			recipeVersionId?: string;
			buildingVersionId: string;
			buildingCount: number;
			efficiencyRatio?: number;
			notes?: string;
			extractedItemVersionId?: string;
			fuelItemVersionId?: string;
		}
	) => Promise<void>;
	updateProductionInstance: (
		instanceId: string,
		data: {
			recipeVersionId?: string;
			buildingVersionId?: string;
			buildingCount?: number;
			efficiencyRatio?: number;
			isBuilt?: boolean;
			notes?: string;
		}
	) => Promise<void>;
	updateProductionInstanceBuiltStatus: (instanceId: string, isBuilt: boolean) => Promise<boolean>;
	deleteProductionInstanceOptimistic: (instanceId: string) => Promise<boolean>;
	deleteProductionInstance: (instanceId: string) => Promise<void>;
	// Dashboard management
	gameDashboard: GameDashboardData | null;
	isDashboardLoading: boolean;
	dashboardError: string | null;
	loadGameDashboard: (gameId: string, forceRefresh?: boolean) => Promise<void>;
	refreshGameDashboard: (gameId: string) => Promise<void>;
	clearDashboardData: () => void;
	// Backward compatibility getters
	get siteProductionInstances(): ProductionInstanceData[];
	get siteProductionOverview(): ProductionOverview | null;
	attachAuth: (apiFetch: AuthFetchFn) => void;
	getApiFetch: () => AuthFetchFn | null;
	getUserRole: (userEmail: string) => string | null;
	canManageSettings: (userEmail: string) => boolean;
	canManageSites: (userEmail: string) => boolean;
	// Real-time integration
	attachRealtime: (realtimeService: any) => void;
}

// Narrow helper type so we don't import full AuthState here.
type AuthFetchFn = <T = any>(
	input: string | URL | Request,
	init?: RequestInit & { autoJson?: boolean }
) => Promise<T | Response>;

class GameStateClass implements GameState {
	// Function injected from auth state to fetch API token
	private apiFetch: AuthFetchFn | null = null;
	// Real-time service for WebSocket integration
	private realtimeService: any = null;

	attachAuth(apiFetch: AuthFetchFn) {
		this.apiFetch = apiFetch;
		// Initialize the centralized API service
		apiService.setApiFetch(apiFetch);
	}

	getApiFetch(): AuthFetchFn | null {
		return this.apiFetch;
	}

	attachRealtime(realtimeService: any) {
		this.realtimeService = realtimeService;
	}
	async deleteGame(id: string) {
		if (!id) {
			notificationService.error('Game ID is required');
			return;
		}

		this.isLoading = true;
		try {
			await apiService.delete(`/api/games/${id}`);
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
	// Production state - consolidated
	siteProductionSummary = $state<ProductionSummary | null>(null);
	// Dashboard state
	gameDashboard = $state<GameDashboardData | null>(null);
	isDashboardLoading = $state<boolean>(false);
	dashboardError = $state<string | null>(null);

	// Backward compatibility getters
	get siteProductionInstances(): ProductionInstanceData[] {
		return this.siteProductionSummary?.instances || [];
	}

	get siteProductionOverview(): ProductionOverview | null {
		return this.siteProductionSummary?.overview || null;
	}

	async loadGames(userEmail: string) {
		if (!userEmail) {
			notificationService.error('User email is required');
			return;
		}

		this.isLoading = true;
		try {
			const data = await apiService.get<GameSummary[]>(
				`/api/games?email=${encodeURIComponent(userEmail)}`
			);
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
		this.isLoading = true;
		try {
			const created = await apiService.post<GameSummary>('/api/games', { email: userEmail, name });
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
		this.isLoading = true;
		try {
			const updated = await apiService.patch<GameSummary>(`/api/games/${id}`, { name });
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
		if (!gameId) return;
		try {
			const data = await apiService.get<GameUser[]>(`/api/games/${gameId}/users`);
			this.gameUsers = data.sort((a, b) => a.displayName.localeCompare(b.displayName));
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to load game users');
		}
	}

	async addGameUser(gameId: string, users: string[]) {
		if (!gameId) return;
		try {
			await apiService.post(`/api/games/${gameId}/users`, { emails: users });
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to add game users');
		}
	}

	async removeGameUser(gameId: string, userEmail: string) {
		if (!gameId) return;
		try {
			await apiService.delete(`/api/games/${gameId}/users`, {
				body: JSON.stringify({ email: userEmail }),
				headers: { 'content-type': 'application/json' }
			});
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to remove game user');
		}
	}

	async updateGameUserRole(gameId: string, userEmail: string, role: string) {
		if (!gameId) return;
		try {
			await apiService.patch(`/api/games/${gameId}/users`, { email: userEmail, role });
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to update game user role');
		}
	}

	async loadGameModules(gameId: string) {
		if (!gameId) return;
		try {
			const data = await apiService.get<GameModule[]>(`/api/games/${gameId}/modules`);
			this.gameModules = data.sort((a, b) => a.name.localeCompare(b.name));
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to load game modules');
		}
	}

	async addGameModule(gameId: string, moduleId: string) {
		if (!gameId || !moduleId) return;
		try {
			await apiService.post(`/api/games/${gameId}/modules`, { moduleId });
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to add game module');
		}
	}

	async removeGameModule(gameId: string, moduleId: string) {
		if (!gameId || !moduleId) return;
		try {
			await apiService.delete(`/api/games/${gameId}/modules`, {
				body: JSON.stringify({ moduleId }),
				headers: { 'content-type': 'application/json' }
			});
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to remove game module');
		}
	}

	async setGameModuleVersion(gameId: string, moduleId: string, versionId: string) {
		if (!gameId || !moduleId || !versionId) return;
		try {
			const result = await apiService.put(`/api/games/${gameId}/modules/${moduleId}/version`, {
				versionId
			});

			// Show migration results if any
			if (result && typeof result === 'object' && 'migrationResult' in result && result.migrationResult) {
				const migration = result.migrationResult as any;
				if (migration.success) {
					if (migration.migratedInstancesCount > 0) {
						notificationService.success(
							`Module version updated successfully. ${migration.migratedInstancesCount} production instances migrated.`
						);

						if (migration.warnings.length > 0) {
							migration.warnings.forEach((warning: string) => notificationService.info(warning));
						}
					} else {
						notificationService.success('Module version updated successfully.');
					}
				} else {
					notificationService.warning(
						`Module version updated, but ${migration.failedInstancesCount} production instances could not be migrated automatically.`
					);

					if (migration.failedInstances.length > 0) {
						migration.failedInstances.forEach((instance: any) =>
							notificationService.warning(
								`Failed to migrate instance in ${instance.siteName}: ${instance.reason}`
							)
						);
					}
				}
			} else {
				notificationService.success('Module version updated successfully.');
			}

			// Reload modules to get updated version info
			await this.loadGameModules(gameId);

			// If we have a selected site, refresh its production data
			if (this.selectedSiteId) {
				await this.loadSiteProductionSummary(this.selectedSiteId, true);
			}
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to set module version');
		}
	}

	selectSite(siteId: string | null, updateUrl: boolean = true) {
		this.selectedSiteId = siteId;

		if (updateUrl && typeof window !== 'undefined') {
			const url = new URL(window.location.href);
			if (siteId) {
				url.searchParams.set('siteId', siteId);
			} else {
				url.searchParams.delete('siteId');
			}
			window.history.replaceState({}, '', url.toString());
		}
	}

	async loadGameSites(gameId: string) {
		if (!gameId) return;
		try {
			const data = await apiService.get<GameSite[]>(`/api/games/${gameId}/sites`);
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
		if (!gameId || !name) return;
		try {
			const created = await apiService.post<GameSite>(`/api/games/${gameId}/sites`, { name });
			this.gameSites = [...this.gameSites, created].sort((a, b) => a.name.localeCompare(b.name));
			this.selectedSiteId = created.id;

			notificationService.success(`Site "${name}" created successfully`);
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to create site');
		}
	}

	async updateGameSite(gameId: string, siteId: string, name: string) {
		if (!gameId || !siteId || !name) return;
		try {
			const updated = await apiService.patch<GameSite>(`/api/games/${gameId}/sites/${siteId}`, {
				name
			});
			this.gameSites = this.gameSites
				.map((s) => (s.id === siteId ? updated : s))
				.sort((a, b) => a.name.localeCompare(b.name));

			notificationService.success(`Site renamed to "${name}"`);
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to update site');
		}
	}

	async deleteGameSite(gameId: string, siteId: string) {
		if (!gameId || !siteId) return;
		try {
			await apiService.delete(`/api/games/${gameId}/sites/${siteId}`);
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

	// Production management - consolidated
	async loadSiteProductionSummary(siteId: string, fresh: boolean = false) {
		if (!siteId) return;

		this.isLoading = true;
		try {
			const url = `/api/sites/${siteId}/production-summary${fresh ? '?fresh=true' : ''}`;
			const data = await apiService.get(url) as any;
			if (data.success) {
				// Convert string dates to Date objects in the data
				const summary = data.data as ProductionSummary;
				summary.instances = summary.instances.map((instance: any) => ({
					...instance,
					createdAt: new Date(instance.createdAt),
					updatedAt: new Date(instance.updatedAt)
				}));
				summary.metrics.lastUpdated = new Date(summary.metrics.lastUpdated);

				this.siteProductionSummary = summary;
			}
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to load production summary');
		} finally {
			this.isLoading = false;
		}
	}

	async createProductionInstance(
		siteId: string,
		data: {
			recipeVersionId?: string;
			buildingVersionId: string;
			buildingCount: number;
			efficiencyRatio?: number;
			notes?: string;
			extractedItemVersionId?: string;
			fuelItemVersionId?: string;
		}
	) {
		if (!siteId) return;

		this.isLoading = true;
		try {
			const result = await apiService.post(`/api/sites/${siteId}/production-instances`, data) as any;
			if (result.success) {
				// Reload production summary to get updated data
				await this.loadSiteProductionSummary(siteId, true);

				notificationService.success('Production instance created successfully');
			}
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to create production instance');
		} finally {
			this.isLoading = false;
		}
	}

	async updateProductionInstance(
		instanceId: string,
		data: {
			recipeVersionId?: string;
			buildingVersionId?: string;
			buildingCount?: number;
			efficiencyRatio?: number;
			isBuilt?: boolean;
			notes?: string;
		}
	) {
		if (!instanceId) return;

		// Find the instance to get its siteId
		const instance = this.siteProductionInstances.find(
			(i: ProductionInstanceData) => i.id === instanceId
		);
		if (!instance) {
			notificationService.error('Production instance not found');
			return;
		}

		this.isLoading = true;
		try {
			const result = await apiService.patch(
				`/api/sites/${instance.siteId}/production-instances/${instanceId}`,
				data
			) as any;
			if (result.success) {
				// Reload production summary to get updated data
				await this.loadSiteProductionSummary(instance.siteId, true);

				notificationService.success('Production instance updated successfully');
			}
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to update production instance');
		} finally {
			this.isLoading = false;
		}
	}

	// Optimistic update for built status - no global loading
	async updateProductionInstanceBuiltStatus(instanceId: string, isBuilt: boolean) {
		if (!instanceId) return false;

		// Find the instance to get its siteId
		const instance = this.siteProductionInstances.find(
			(i: ProductionInstanceData) => i.id === instanceId
		);
		if (!instance) {
			notificationService.error('Production instance not found');
			return false;
		}

		// Optimistic update - immediately update local state
		if (this.siteProductionSummary?.instances) {
			const instanceIndex = this.siteProductionSummary.instances.findIndex(
				(i) => i.id === instanceId
			);
			if (instanceIndex !== -1) {
				// Create a new array with updated instance
				const updatedInstances = [...this.siteProductionSummary.instances];
				updatedInstances[instanceIndex] = {
					...updatedInstances[instanceIndex],
					isBuilt
				};
				this.siteProductionSummary = {
					...this.siteProductionSummary,
					instances: updatedInstances
				};
			}
		}

		// Background API call
		try {
			const result = await apiService.patch(
				`/api/sites/${instance.siteId}/production-instances/${instanceId}`,
				{ isBuilt }
			) as any;
			if (result.success) {
				// No need to reload - optimistic update is sufficient for built status
				return true;
			} else {
				throw new Error('Server returned unsuccessful result');
			}
		} catch (e: any) {
			// Rollback optimistic update on error
			if (this.siteProductionSummary?.instances) {
				const instanceIndex = this.siteProductionSummary.instances.findIndex(
					(i) => i.id === instanceId
				);
				if (instanceIndex !== -1) {
					const updatedInstances = [...this.siteProductionSummary.instances];
					updatedInstances[instanceIndex] = {
						...updatedInstances[instanceIndex],
						isBuilt: !isBuilt // Revert back
					};
					this.siteProductionSummary = {
						...this.siteProductionSummary,
						instances: updatedInstances
					};
				}
			}

			notificationService.error(e?.message ?? 'Failed to update built status');
			return false;
		}
	}

	// Optimistic delete - immediate removal with rollback on error
	async deleteProductionInstanceOptimistic(instanceId: string) {
		if (!instanceId) return false;

		// Find the instance to get its siteId and store for rollback
		const instance = this.siteProductionInstances.find(
			(i: ProductionInstanceData) => i.id === instanceId
		);
		if (!instance) {
			notificationService.error('Production instance not found');
			return false;
		}

		// Store instance for potential rollback
		const instanceBackup = { ...instance };

		// Optimistic update - immediately remove from local state
		if (this.siteProductionSummary?.instances) {
			const updatedInstances = this.siteProductionSummary.instances.filter(
				(i) => i.id !== instanceId
			);
			this.siteProductionSummary = {
				...this.siteProductionSummary,
				instances: updatedInstances
			};
		}

		// Background API call
		try {
			const result = await apiService.delete(
				`/api/sites/${instance.siteId}/production-instances/${instanceId}`
			) as any;
			if (result.success) {
				notificationService.success('Production instance deleted successfully');
				return true;
			} else {
				throw new Error('Server returned unsuccessful result');
			}
		} catch (e: any) {
			// Rollback optimistic update on error - restore the instance
			if (this.siteProductionSummary?.instances) {
				const updatedInstances = [...this.siteProductionSummary.instances, instanceBackup];
				// Sort by creation date to maintain consistent order
				updatedInstances.sort(
					(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
				);
				this.siteProductionSummary = {
					...this.siteProductionSummary,
					instances: updatedInstances
				};
			}

			notificationService.error(e?.message ?? 'Failed to delete production instance');
			return false;
		}
	}

	async deleteProductionInstance(instanceId: string) {
		if (!instanceId) return;

		// Find the instance to get its siteId
		const instance = this.siteProductionInstances.find(
			(i: ProductionInstanceData) => i.id === instanceId
		);
		if (!instance) {
			notificationService.error('Production instance not found');
			return;
		}

		this.isLoading = true;
		try {
			const result = await apiService.delete(
				`/api/sites/${instance.siteId}/production-instances/${instanceId}`
			) as any;
			if (result.success) {
				// Reload production summary to get updated data
				await this.loadSiteProductionSummary(instance.siteId, true);
				notificationService.success('Production instance deleted successfully');
			}
		} catch (e: any) {
			notificationService.error(e?.message ?? 'Failed to delete production instance');
		} finally {
			this.isLoading = false;
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

	// Dashboard management methods
	async loadGameDashboard(gameId: string, forceRefresh: boolean = false) {
		if (!gameId) return;

		this.isDashboardLoading = true;
		this.dashboardError = null;

		try {
			const url = `/api/games/${gameId}/dashboard${forceRefresh ? '?fresh=true' : ''}`;
			const data = await apiService.get<GameDashboardData>(url);

			// Convert string dates to Date objects
			const dashboardData = data;
			dashboardData.lastUpdated = new Date(dashboardData.lastUpdated);

			this.gameDashboard = dashboardData;
		} catch (e: any) {
			this.dashboardError = e?.message ?? 'Failed to load dashboard data';
			notificationService.error(this.dashboardError || 'Failed to load dashboard data');
		} finally {
			this.isDashboardLoading = false;
		}
	}

	async refreshGameDashboard(gameId: string) {
		return await this.loadGameDashboard(gameId, true);
	}

	clearDashboardData() {
		this.gameDashboard = null;
		this.dashboardError = null;
	}
}

const DEFAULT_GAME_STATE_KEY = '$_game_state';

export const getGameState = (key = DEFAULT_GAME_STATE_KEY): GameState => getContext<GameState>(key);
export const setGameState = (key = DEFAULT_GAME_STATE_KEY): GameState => {
	const gs = new GameStateClass();
	return setContext(key, gs);
};
