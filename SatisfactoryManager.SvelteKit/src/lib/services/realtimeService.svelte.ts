import { browser } from '$app/environment';
import { getSSEService } from './sseService.svelte.js';
import { notificationService } from './notificationService.svelte.js';
import type {
	RealtimeMessage,
	ProductionInstanceCreatedMessage,
	ProductionInstanceUpdatedMessage,
	ProductionInstanceDeletedMessage,
	SiteCreatedMessage,
	SiteUpdatedMessage,
	SiteDeletedMessage,
	UserJoinedMessage,
	UserLeftMessage,
	ModuleVersionChangedMessage
} from '../types/realtime.js';
import type { AuthState } from '../states/authState.svelte.js';
import type { GameState } from '../states/gameState.svelte.js';

export interface OnlineUser {
	userId: string;
	userName: string;
	userEmail: string;
	siteId: string | null;
	activity: string | null;
	lastSeen: Date;
}

export interface RealtimeState {
	isConnected: boolean;
	isConnecting: boolean;
	onlineUsers: OnlineUser[];
	currentGameId: string | null;
	connectionError: string | null;
}

/**
 * Real-time service that integrates SSE with game state management
 */
export class RealtimeService {
	private sseService: ReturnType<typeof getSSEService> | null = null;
	private authState: AuthState | null = null;
	private gameState: GameState | null = null;
	private isInitialized = false;
	private handlersSetup = false;

	// Reactive state
	private _state = $state<RealtimeState>({
		isConnected: false,
		isConnecting: false,
		onlineUsers: [],
		currentGameId: null,
		connectionError: null
	});

	constructor() {
		// Don't initialize SSE service here - defer to when it's needed
	}

	/**
	 * Get SSE service, initializing it if needed (client-side only)
	 */
	private getSSEService() {
		if (!browser) {
			throw new Error('SSE service is only available on the client side');
		}

		if (!this.sseService) {
			this.sseService = getSSEService();

			// Setup handlers on first access
			if (!this.handlersSetup) {
				this.setupSSEHandlers();
				this.handlersSetup = true;
			}
		}

		return this.sseService;
	}

	/**
	 * Get current real-time state
	 */
	get state(): RealtimeState {
		return this._state;
	}

	/**
	 * Initialize the real-time service with auth and game states
	 */
	public initialize(authState: AuthState, gameState: GameState): void {
		this.authState = authState;
		this.gameState = gameState;
		this.isInitialized = true;

		// Connect to SSE if authenticated
		if (authState.isAuthenticated) {
			this.connect();
		}

		console.log('🔄 Real-time service initialized');
	}

	/**
	 * Handle authentication state changes (called from component context)
	 */
	public handleAuthStateChange(isAuthenticated: boolean): void {
		console.log('🔄 Auth state changed:', {
			isAuthenticated,
			currentlyConnected: this._state.isConnected,
			currentlyConnecting: this._state.isConnecting
		});

		if (isAuthenticated) {
			// Only connect if we're not already connected or connecting
			if (!this._state.isConnected && !this._state.isConnecting) {
				console.log('🔌 Starting connection due to auth state change');
				this.connect();
			} else {
				console.log('📋 Skipping connection - already connected or connecting');
			}
		} else {
			console.log('🔌 Disconnecting due to auth state change');
			this.disconnect();
		}
	}

	/**
	 * Handle game selection changes (called from component context)
	 */
	public handleGameChange(gameId: string | null): void {
		console.log('🎮 Game changed to:', gameId);

		if (gameId === this._state.currentGameId) {
			console.log('📋 Game ID unchanged, skipping join');
			return;
		}

		this._state.currentGameId = gameId;

		if (gameId && this._state.isConnected) {
			console.log('🚀 Attempting to join game room:', gameId);
			this.joinGame(gameId);
		} else {
			console.log('📋 Skipping game join - connected:', this._state.isConnected);
		}
	}

	/**
	 * Handle site selection changes (called from component context)
	 */
	public handleSiteChange(gameId: string | null, siteId: string | null): void {
		if (gameId && siteId && this._state.isConnected) {
			this.updatePresence(siteId, 'viewing_site');
		}
	}

	/**
	 * Connect to SSE
	 */
	private async connect(): Promise<void> {
		if (!this.authState) {
			console.log('🚫 Cannot connect: no auth state available');
			return;
		}

		if (this._state.isConnecting) {
			console.log('🔄 Connection already in progress, skipping new attempt');
			return;
		}

		if (this._state.isConnected) {
			console.log('📋 Already connected, skipping connection attempt');
			return;
		}

		console.log('🔄 Starting real-time service connection...');
		this._state.isConnecting = true;
		this._state.connectionError = null;

		try {
			// Get access token using the auth state method
			const accessToken = await this.authState.getApiAccessToken();
			if (!accessToken) {
				throw new Error('Failed to obtain access token');
			}

			console.log('🔑 Got access token for SSE authentication');
			const gameId = this.gameState?.selectedGameId;
			const connected = await this.getSSEService().connect(accessToken, gameId || undefined);
			if (connected) {
				this._state.isConnected = true;
				this._state.isConnecting = false;
				this._state.currentGameId = gameId || null;
				console.log('✅ Real-time service connected and authenticated');
			} else {
				this._state.isConnecting = false;
				throw new Error('Connection failed - check server availability');
			}
		} catch (error) {
			this._state.isConnecting = false;
			this._state.connectionError = error instanceof Error ? error.message : 'Connection failed';
			console.error('❌ Real-time connection failed:', error);
		}
	}

	/**
	 * Disconnect from SSE
	 */
	public disconnect(): void {
		if (this.sseService) {
			this.sseService.disconnect();
		}
		this._state.isConnected = false;
		this._state.isConnecting = false;
		this._state.onlineUsers = [];
		this._state.currentGameId = null;
		console.log('🔌 Real-time service disconnected');
	}

	/**
	 * Join a game room (reconnect SSE with game ID)
	 */
	public async joinGame(gameId: string): Promise<boolean> {
		if (!this._state.isConnected) {
			console.warn('⚠️ Cannot join game: not connected to SSE');
			return false;
		}

		try {
			const joined = await this.getSSEService().joinGame(gameId);

			if (joined) {
				this._state.currentGameId = gameId;
				console.log(`🎮 Joined game room: ${gameId}`);
				return true;
			}
		} catch (error) {
			console.error('❌ Failed to join game:', error);
		}

		return false;
	}

	/**
	 * Leave current game room
	 */
	public async leaveGame(): Promise<boolean> {
		if (!this._state.isConnected || !this._state.currentGameId) {
			return true;
		}

		try {
			const left = await this.getSSEService().leaveGame();
			if (left) {
				this._state.currentGameId = null;
				this._state.onlineUsers = [];
				console.log('🚪 Left game room');
				return true;
			}
		} catch (error) {
			console.error('❌ Failed to leave game:', error);
		}

		return false;
	}

	/**
	 * Update user presence (note: SSE is receive-only, presence updates handled via API)
	 */
	public updatePresence(siteId?: string, activity?: string): void {
		if (!this._state.isConnected) return;

		// For SSE, presence updates would be sent via regular API calls
		// This is a placeholder for future implementation
		console.log('📍 Presence update (SSE):', { siteId, activity });
	}

	/**
	 * Setup SSE message handlers
	 */
	private setupSSEHandlers(): void {
		// Connection state handlers
		this.sseService!.addConnectionHandler((connected) => {
			this._state.isConnected = connected;
			if (!connected) {
				this._state.onlineUsers = [];
				this._state.currentGameId = null;
			}
		});

		this.sseService!.addErrorHandler((error) => {
			this._state.connectionError = error;
		});

		// Production instance handlers
		this.sseService!.addMessageHandler('production_instance_created', (message) => {
			this.handleProductionInstanceCreated(message as any);
		});

		this.sseService!.addMessageHandler('production_instance_updated', (message) => {
			this.handleProductionInstanceUpdated(message as any);
		});

		this.sseService!.addMessageHandler('production_instance_deleted', (message) => {
			this.handleProductionInstanceDeleted(message as any);
		});

		// Site handlers
		this.sseService!.addMessageHandler('site_created', (message) => {
			this.handleSiteCreated(message as any);
		});

		this.sseService!.addMessageHandler('site_updated', (message) => {
			this.handleSiteUpdated(message as any);
		});

		this.sseService!.addMessageHandler('site_deleted', (message) => {
			this.handleSiteDeleted(message as any);
		});

		// User presence handlers
		this.sseService!.addMessageHandler('user_joined', (message) => {
			this.handleUserJoined(message as any);
		});

		this.sseService!.addMessageHandler('user_left', (message) => {
			this.handleUserLeft(message as any);
		});

		// Module version change handler
		this.sseService!.addMessageHandler('module_version_changed', (message) => {
			this.handleModuleVersionChanged(message as any);
		});
	}

	/**
	 * Handle production instance created message
	 */
	private handleProductionInstanceCreated(message: RealtimeMessage): void {
		const data = (message as ProductionInstanceCreatedMessage).data;

		// Don't handle our own messages
		if (data.userId === this.authState?.user?.id) {
			return;
		}

		// Refresh production data if we're viewing the same site
		if (this.gameState?.selectedSiteId === data.siteId) {
			this.gameState.loadSiteProductionSummary(data.siteId, true);
		}

		// Notification removed - too noisy
	}

	/**
	 * Handle production instance updated message
	 */
	private handleProductionInstanceUpdated(message: RealtimeMessage): void {
		const data = (message as ProductionInstanceUpdatedMessage).data;

		// Don't handle our own messages
		if (data.userId === this.authState?.user?.id) {
			return;
		}

		// Refresh production data if we're viewing the same site
		if (this.gameState?.selectedSiteId === data.siteId) {
			this.gameState.loadSiteProductionSummary(data.siteId, true);
		}

		// Notification removed - too noisy
	}

	/**
	 * Handle production instance deleted message
	 */
	private handleProductionInstanceDeleted(message: RealtimeMessage): void {
		const data = (message as ProductionInstanceDeletedMessage).data;

		// Don't handle our own messages
		if (data.userId === this.authState?.user?.id) {
			return;
		}

		// Refresh production data if we're viewing the same site
		if (this.gameState?.selectedSiteId === data.siteId) {
			this.gameState.loadSiteProductionSummary(data.siteId, true);
		}

		// Notification removed - too noisy
	}

	/**
	 * Handle site created message
	 */
	private handleSiteCreated(message: RealtimeMessage): void {
		const data = (message as SiteCreatedMessage).data;

		// Don't handle our own messages
		if (data.userId === this.authState?.user?.id) {
			return;
		}

		// Refresh sites list
		if (this.gameState?.selectedGameId === data.gameId) {
			this.gameState.loadGameSites(data.gameId);
		}

		// Notification removed - too noisy
	}

	/**
	 * Handle site updated message
	 */
	private handleSiteUpdated(message: RealtimeMessage): void {
		const data = (message as SiteUpdatedMessage).data;

		// Don't handle our own messages
		if (data.userId === this.authState?.user?.id) {
			return;
		}

		// Refresh sites list
		if (this.gameState?.selectedGameId === data.gameId) {
			this.gameState.loadGameSites(data.gameId);
		}

		// Notification removed - too noisy
	}

	/**
	 * Handle site deleted message
	 */
	private handleSiteDeleted(message: RealtimeMessage): void {
		const data = (message as SiteDeletedMessage).data;

		// Don't handle our own messages
		if (data.userId === this.authState?.user?.id) {
			return;
		}

		// Refresh sites list
		if (this.gameState?.selectedGameId === data.gameId) {
			this.gameState.loadGameSites(data.gameId);
		}

		// Notification removed - too noisy
	}

	/**
	 * Handle user joined message
	 */
	private handleUserJoined(message: RealtimeMessage): void {
		const data = (message as UserJoinedMessage).data;

		// Don't handle our own join messages
		if (data.userId === this.authState?.user?.id) {
			return;
		}

		// Add user to online users list
		const existingUserIndex = this._state.onlineUsers.findIndex((u) => u.userId === data.userId);
		const newUser: OnlineUser = {
			userId: data.userId,
			userName: data.userName,
			userEmail: data.userEmail,
			siteId: data.siteId || null,
			activity: data.activity || null,
			lastSeen: new Date()
		};

		if (existingUserIndex >= 0) {
			this._state.onlineUsers[existingUserIndex] = newUser;
		} else {
			this._state.onlineUsers = [...this._state.onlineUsers, newUser];
		}

		// Show notification
		notificationService.info(`${data.userName} joined the game`);
	}

	/**
	 * Handle user left message
	 */
	private handleUserLeft(message: RealtimeMessage): void {
		const data = (message as UserLeftMessage).data;

		// Remove user from online users list
		this._state.onlineUsers = this._state.onlineUsers.filter((u) => u.userId !== data.userId);

		// Show notification
		notificationService.info(`${data.userName} left the game`);
	}

	/**
	 * Handle module version changed message
	 */
	private handleModuleVersionChanged(message: RealtimeMessage): void {
		const data = (message as ModuleVersionChangedMessage).data;

		// Don't handle our own messages
		if (data.userId === this.authState?.user?.id) {
			return;
		}

		// Refresh modules list
		if (this.gameState?.selectedGameId === data.gameId) {
			this.gameState.loadGameModules(data.gameId);
		}

		// Notification removed - too noisy
	}

	// getSiteName method removed - no longer needed

	/**
	 * Get online users for current game
	 */
	public getOnlineUsers(): OnlineUser[] {
		return this._state.onlineUsers;
	}

	/**
	 * Check if a specific user is online
	 */
	public isUserOnline(userId: string): boolean {
		return this._state.onlineUsers.some((u) => u.userId === userId);
	}

	/**
	 * Get users currently viewing a specific site
	 */
	public getUsersInSite(siteId: string): OnlineUser[] {
		return this._state.onlineUsers.filter((u) => u.siteId === siteId);
	}
}

// Create singleton instance
let realtimeService: RealtimeService | null = null;

export function getRealtimeService(): RealtimeService {
	if (!realtimeService) {
		realtimeService = new RealtimeService();
	}
	return realtimeService;
}
