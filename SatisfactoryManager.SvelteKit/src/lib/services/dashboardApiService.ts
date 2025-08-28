// Frontend API service for game dashboard
// This service handles API calls to the game dashboard endpoints

export interface GameDashboardData {
	gameId: string;
	sites: Array<{
		siteId: string;
		siteName: string;
		totalProduction: Array<{ itemId: string; itemName: string; rate: number }>;
		totalConsumption: Array<{ itemId: string; itemName: string; rate: number }>;
		powerConsumption: number;
		powerProduction: number;
		instanceCount: number;
		buildingCount: number;
		averageEfficiency: number;
	}>;
	aggregated: {
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
	};
	performance: {
		topProducingSites: Array<{ siteId: string; siteName: string; productionScore: number }>;
		powerEfficiencyBySite: Array<{ siteId: string; siteName: string; efficiency: number }>;
		bottlenecks: Array<{ itemId: string; itemName: string; deficit: number; sites: string[] }>;
	};
	lastUpdated: Date;
}

export class DashboardApiService {
	private baseUrl = '/api/games';

	/**
	 * Get dashboard data for a game
	 * @param gameId - The game ID
	 * @param useCache - Whether to use cached data (default: true)
	 * @param authToken - JWT authentication token
	 */
	async getGameDashboard(
		gameId: string,
		useCache: boolean = true,
		authToken: string
	): Promise<GameDashboardData> {
		const url = new URL(`${this.baseUrl}/${gameId}/dashboard`, window.location.origin);
		if (!useCache) {
			url.searchParams.set('cache', 'false');
		}

		const response = await fetch(url.toString(), {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${authToken}`,
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch dashboard data: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();

		// Convert lastUpdated string back to Date
		data.lastUpdated = new Date(data.lastUpdated);

		return data;
	}

	/**
	 * Force refresh dashboard data
	 * @param gameId - The game ID
	 * @param authToken - JWT authentication token
	 */
	async refreshGameDashboard(gameId: string, authToken: string): Promise<GameDashboardData> {
		const response = await fetch(`${this.baseUrl}/${gameId}/dashboard`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${authToken}`,
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			throw new Error(
				`Failed to refresh dashboard data: ${response.status} ${response.statusText}`
			);
		}

		const data = await response.json();

		// Convert lastUpdated string back to Date
		data.lastUpdated = new Date(data.lastUpdated);

		return data;
	}

	/**
	 * Check if dashboard data is stale (older than 5 minutes)
	 */
	isDashboardStale(lastUpdated: Date): boolean {
		const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
		return lastUpdated < fiveMinutesAgo;
	}

	/**
	 * Format production rate for display
	 */
	formatProductionRate(rate: number): string {
		if (rate < 1) {
			return `${(rate * 60).toFixed(2)}/h`;
		}
		return `${rate.toFixed(2)}/min`;
	}

	/**
	 * Format power consumption/production
	 */
	formatPower(power: number): string {
		if (power >= 1000) {
			return `${(power / 1000).toFixed(2)} GW`;
		}
		return `${power.toFixed(2)} MW`;
	}

	/**
	 * Get color class for net balance (positive/negative)
	 */
	getBalanceColorClass(balance: number): string {
		if (balance > 0) return 'text-green-600';
		if (balance < 0) return 'text-red-600';
		return 'text-gray-600';
	}

	/**
	 * Get efficiency color class based on percentage
	 */
	getEfficiencyColorClass(efficiency: number): string {
		if (efficiency >= 0.9) return 'text-green-600';
		if (efficiency >= 0.7) return 'text-yellow-600';
		return 'text-red-600';
	}
}

export const dashboardApiService = new DashboardApiService();
