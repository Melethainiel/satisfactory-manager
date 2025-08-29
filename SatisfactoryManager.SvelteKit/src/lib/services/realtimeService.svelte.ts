import { browser } from '$app/environment';
import { getWebSocketService } from './websocketService.svelte.js';
import { notificationService } from './notificationService.svelte.js';
import type {
	WebSocketMessage,
	ProductionInstanceCreatedMessage,
	ProductionInstanceUpdatedMessage,
	ProductionInstanceDeletedMessage,
	SiteCreatedMessage,
	SiteUpdatedMessage,
	SiteDeletedMessage,
	UserJoinedMessage,
	UserLeftMessage,
	ModuleVersionChangedMessage
} from '../server/websocket/types.js';
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
 * Real-time service that integrates WebSocket with game state management
 */
export class RealtimeService {
	private wsService = getWebSocketService();
	private authState: AuthState | null = null;
	private gameState: GameState | null = null;
	private isInitialized = false;

	// Reactive state
	private _state = $state<RealtimeState>({
		isConnected: false,
		isConnecting: false,
		onlineUsers: [],
		currentGameId: null,
		connectionError: null
	});

	constructor() {
		if (browser) {
			this.setupWebSocketHandlers();
		}
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

		// Connect to WebSocket if authenticated
		if (authState.isAuthenticated) {
			this.connect();
		}

		console.log('🔄 Real-time service initialized');
	}

	/**
	 * Handle authentication state changes (called from component context)
	 */
	public handleAuthStateChange(isAuthenticated: boolean): void {
		if (isAuthenticated) {
			if (!this._state.isConnected && !this._state.isConnecting) {
				this.connect();
			}
		} else {
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
	 * Connect to WebSocket
	 */
	private async connect(): Promise<void> {
		if (!this.authState || this._state.isConnecting) {
			console.log('🔄 Cannot connect: no auth state or already connecting', {
				hasAuthState: !!this.authState,
				isConnecting: this._state.isConnecting
			});
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

			console.log('🔑 Got access token for WebSocket authentication');
			const connected = await this.wsService.connect(accessToken);
			if (connected) {
				this._state.isConnected = true;
				this._state.isConnecting = false;
				console.log('✅ Real-time service connected and authenticated');

				// Auto-join game room if we have a selected game
				if (this.gameState?.selectedGameId) {
					console.log('🎮 Auto-joining game room after connection:', this.gameState.selectedGameId);
					await this.joinGame(this.gameState.selectedGameId);
				}
			}
		} catch (error) {
			this._state.isConnecting = false;
			this._state.connectionError = error instanceof Error ? error.message : 'Connection failed';
			console.error('❌ Real-time connection failed:', error);
		}
	}

	/**
	 * Disconnect from WebSocket
	 */
	public disconnect(): void {
		this.wsService.disconnect();
		this._state.isConnected = false;
		this._state.isConnecting = false;
		this._state.onlineUsers = [];
		this._state.currentGameId = null;
		console.log('🔌 Real-time service disconnected');
	}

	/**
	 * Join a game room (mainly used for debugging, server handles joining automatically)
	 */
	public async joinGame(gameId: string): Promise<boolean> {
		if (!this._state.isConnected) {
			console.warn('⚠️ Cannot join game: not connected to WebSocket');
			return false;
		}

		try {
			const siteId = this.gameState?.selectedSiteId || undefined;
			const joined = await this.wsService.joinGame(gameId, siteId);

			if (joined) {
				this._state.currentGameId = gameId;
				console.log(`🎮 Joined game room: ${gameId}`);
				return true;
			}
		} catch (error) {
			console.error('❌ Failed to join game:', error);
			// No user notification since server handles joining automatically
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
			const left = await this.wsService.leaveGame();
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
	 * Update user presence
	 */
	public updatePresence(siteId?: string, activity?: string): void {
		if (!this._state.isConnected) return;

		this.wsService.updatePresence(siteId, activity);
	}

	/**
	 * Setup WebSocket message handlers
	 */
	private setupWebSocketHandlers(): void {
		// Connection state handlers
		this.wsService.addConnectionHandler((connected) => {
			this._state.isConnected = connected;
			if (!connected) {
				this._state.onlineUsers = [];
				this._state.currentGameId = null;
			}
		});

		this.wsService.addErrorHandler((error) => {
			this._state.connectionError = error;
		});

		// Production instance handlers
		this.wsService.addMessageHandler('production_instance_created', (message) => {
			this.handleProductionInstanceCreated(message);
		});

		this.wsService.addMessageHandler('production_instance_updated', (message) => {
			this.handleProductionInstanceUpdated(message);
		});

		this.wsService.addMessageHandler('production_instance_deleted', (message) => {
			this.handleProductionInstanceDeleted(message);
		});

		// Site handlers
		this.wsService.addMessageHandler('site_created', (message) => {
			this.handleSiteCreated(message);
		});

		this.wsService.addMessageHandler('site_updated', (message) => {
			this.handleSiteUpdated(message);
		});

		this.wsService.addMessageHandler('site_deleted', (message) => {
			this.handleSiteDeleted(message);
		});

		// User presence handlers
		this.wsService.addMessageHandler('user_joined', (message) => {
			this.handleUserJoined(message);
		});

		this.wsService.addMessageHandler('user_left', (message) => {
			this.handleUserLeft(message);
		});

		// Module version change handler
		this.wsService.addMessageHandler('module_version_changed', (message) => {
			this.handleModuleVersionChanged(message);
		});
	}

	/**
	 * Handle production instance created message
	 */
	private handleProductionInstanceCreated(message: WebSocketMessage): void {
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
	private handleProductionInstanceUpdated(message: WebSocketMessage): void {
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
	private handleProductionInstanceDeleted(message: WebSocketMessage): void {
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
	private handleSiteCreated(message: WebSocketMessage): void {
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
	private handleSiteUpdated(message: WebSocketMessage): void {
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
	private handleSiteDeleted(message: WebSocketMessage): void {
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
	private handleUserJoined(message: WebSocketMessage): void {
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
	private handleUserLeft(message: WebSocketMessage): void {
		const data = (message as UserLeftMessage).data;

		// Remove user from online users list
		this._state.onlineUsers = this._state.onlineUsers.filter((u) => u.userId !== data.userId);

		// Show notification
		notificationService.info(`${data.userName} left the game`);
	}

	/**
	 * Handle module version changed message
	 */
	private handleModuleVersionChanged(message: WebSocketMessage): void {
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
