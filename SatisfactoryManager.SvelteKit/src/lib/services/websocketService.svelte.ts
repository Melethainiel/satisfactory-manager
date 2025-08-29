import { browser } from '$app/environment';
import { v4 as uuidv4 } from 'uuid';
import type { WebSocketMessage, WebSocketMessageType } from '../server/websocket/types.js';

interface WebSocketServiceConfig {
	url: string;
	reconnectInterval?: number;
	maxReconnectAttempts?: number;
	pingInterval?: number;
}

interface ConnectionState {
	isConnected: boolean;
	isConnecting: boolean;
	isAuthenticated: boolean;
	reconnectCount: number;
	lastError: string | null;
	currentGameId: string | null;
	currentSiteId: string | null;
}

type MessageHandler = (message: WebSocketMessage) => void;
type ConnectionHandler = (connected: boolean) => void;
type ErrorHandler = (error: string) => void;

export class WebSocketService {
	private ws: WebSocket | null = null;
	private config: WebSocketServiceConfig;
	private reconnectTimer: NodeJS.Timeout | null = null;
	private pingTimer: NodeJS.Timeout | null = null;
	private messageHandlers = new Map<WebSocketMessageType, MessageHandler[]>();
	private connectionHandlers: ConnectionHandler[] = [];
	private errorHandlers: ErrorHandler[] = [];
	private pendingMessages: string[] = [];
	private authToken: string | null = null;

	// State management using Svelte 5 runes
	private _state = $state<ConnectionState>({
		isConnected: false,
		isConnecting: false,
		isAuthenticated: false,
		reconnectCount: 0,
		lastError: null,
		currentGameId: null,
		currentSiteId: null
	});

	constructor(config: WebSocketServiceConfig) {
		this.config = {
			reconnectInterval: 3000,
			maxReconnectAttempts: 10,
			pingInterval: 30000,
			...config
		};
	}

	/**
	 * Get current connection state (reactive)
	 */
	get state(): ConnectionState {
		return this._state;
	}

	/**
	 * Connect to WebSocket server
	 */
	public async connect(authToken: string): Promise<boolean> {
		if (!browser) return false;

		console.log('🔌 Attempting basic WebSocket connection:', this.config.url);
		this.authToken = authToken;
		this._state.isConnecting = true;
		this._state.lastError = null;

		try {
			// Close existing connection
			if (this.ws) {
				this.disconnect();
			}

			// Create WebSocket connection
			const wsUrl = this.config.url.replace('http', 'ws');
			console.log('🔌 Creating WebSocket connection to:', wsUrl);
			this.ws = new WebSocket(wsUrl);

			// Set up event handlers
			this.ws.onopen = this.handleOpen.bind(this);
			this.ws.onmessage = this.handleMessage.bind(this);
			this.ws.onclose = this.handleClose.bind(this);
			this.ws.onerror = this.handleError.bind(this);

			return new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error('Basic connection timeout - check server'));
				}, 8000); // Reduced timeout for basic connection

				const onConnect = (connected: boolean) => {
					clearTimeout(timeout);
					this.removeConnectionHandler(onConnect);
					if (connected && this._state.isAuthenticated) {
						console.log('✅ Basic WebSocket connection established successfully');
						resolve(true);
					} else {
						reject(new Error('Basic connection or authentication failed'));
					}
				};

				this.addConnectionHandler(onConnect);
			});
		} catch (error) {
			this._state.isConnecting = false;
			this._state.lastError = error instanceof Error ? error.message : 'Basic connection failed';
			this.notifyErrorHandlers(this._state.lastError);
			return false;
		}
	}

	/**
	 * Disconnect from WebSocket server
	 */
	public disconnect(): void {
		this.clearReconnectTimer();
		this.clearPingTimer();

		if (this.ws) {
			// Remove event handlers to prevent reconnection attempts
			this.ws.onopen = null;
			this.ws.onmessage = null;
			this.ws.onclose = null;
			this.ws.onerror = null;

			if (this.ws.readyState === WebSocket.OPEN) {
				this.ws.close();
			}
			this.ws = null;
		}

		this.updateConnectionState(false, false);
		this._state.isConnecting = false;
		this._state.currentGameId = null;
		this._state.currentSiteId = null;
	}

	/**
	 * Join a game room
	 */
	public async joinGame(gameId: string, siteId?: string): Promise<boolean> {
		if (!this._state.isAuthenticated) {
			throw new Error('Must be authenticated before joining game');
		}

		return new Promise((resolve, reject) => {
			const messageId = this.sendMessage({
				type: 'join_game',
				timestamp: new Date().toISOString(),
				messageId: uuidv4(),
				data: {
					gameId,
					siteId
				}
			} as any);

			console.log('🎮 Sent join_game message with messageId:', messageId);

			// Set up temporary handler for response
			const handleResponse = (message: WebSocketMessage) => {
				console.log('🎮 Received join_game response:', message.messageId, 'expected:', messageId);
				if (message.messageId === messageId) {
					this.removeMessageHandler('join_game', handleResponse);
					if ('data' in message && (message.data as any)?.success) {
						console.log('✅ Join game successful');
						this._state.currentGameId = gameId;
						this._state.currentSiteId = siteId || null;
						resolve(true);
					} else {
						console.log('❌ Join game failed:', message);
						reject(new Error('Failed to join game'));
					}
				}
			};

			this.addMessageHandler('join_game', handleResponse);

			// Timeout after 10 seconds
			setTimeout(() => {
				console.log('⏰ Join game timeout after 10 seconds for messageId:', messageId);
				this.removeMessageHandler('join_game', handleResponse);
				reject(new Error('Join game timeout'));
			}, 10000);
		});
	}

	/**
	 * Leave current game room
	 */
	public async leaveGame(): Promise<boolean> {
		if (!this._state.currentGameId) {
			return true; // Already not in a game
		}

		return new Promise((resolve, reject) => {
			const messageId = this.sendMessage({
				type: 'leave_game',
				timestamp: new Date().toISOString(),
				messageId: uuidv4(),
				data: {
					gameId: this._state.currentGameId!
				}
			} as any);

			// Set up temporary handler for response
			const handleResponse = (message: WebSocketMessage) => {
				if (message.messageId === messageId) {
					this.removeMessageHandler('leave_game', handleResponse);
					if ('data' in message && (message.data as any)?.success) {
						this._state.currentGameId = null;
						this._state.currentSiteId = null;
						resolve(true);
					} else {
						reject(new Error('Failed to leave game'));
					}
				}
			};

			this.addMessageHandler('leave_game', handleResponse);

			// Timeout after 5 seconds
			setTimeout(() => {
				this.removeMessageHandler('leave_game', handleResponse);
				reject(new Error('Leave game timeout'));
			}, 5000);
		});
	}

	/**
	 * Update user presence
	 */
	public updatePresence(siteId?: string, activity?: string): void {
		if (!this._state.isAuthenticated || !this._state.currentGameId) {
			return;
		}

		this.sendMessage({
			type: 'presence_update',
			timestamp: new Date().toISOString(),
			messageId: uuidv4(),
			data: {
				gameId: this._state.currentGameId,
				siteId,
				activity
			}
		} as any);

		// Update local state
		this._state.currentSiteId = siteId || null;
	}

	/**
	 * Send a message to the WebSocket server
	 */
	public sendMessage(message: WebSocketMessage): string {
		const messageText = JSON.stringify(message);

		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(messageText);
		} else {
			// Queue message for when connection is restored
			this.pendingMessages.push(messageText);
		}

		return message.messageId;
	}

	/**
	 * Add message handler for specific message type
	 */
	public addMessageHandler(type: WebSocketMessageType, handler: MessageHandler): void {
		if (!this.messageHandlers.has(type)) {
			this.messageHandlers.set(type, []);
		}
		this.messageHandlers.get(type)!.push(handler);
	}

	/**
	 * Remove message handler
	 */
	public removeMessageHandler(type: WebSocketMessageType, handler: MessageHandler): void {
		const handlers = this.messageHandlers.get(type);
		if (handlers) {
			const index = handlers.indexOf(handler);
			if (index !== -1) {
				handlers.splice(index, 1);
			}
		}
	}

	/**
	 * Add connection state change handler
	 */
	public addConnectionHandler(handler: ConnectionHandler): void {
		this.connectionHandlers.push(handler);
	}

	/**
	 * Remove connection state change handler
	 */
	public removeConnectionHandler(handler: ConnectionHandler): void {
		const index = this.connectionHandlers.indexOf(handler);
		if (index !== -1) {
			this.connectionHandlers.splice(index, 1);
		}
	}

	/**
	 * Add error handler
	 */
	public addErrorHandler(handler: ErrorHandler): void {
		this.errorHandlers.push(handler);
	}

	/**
	 * Remove error handler
	 */
	public removeErrorHandler(handler: ErrorHandler): void {
		const index = this.errorHandlers.indexOf(handler);
		if (index !== -1) {
			this.errorHandlers.splice(index, 1);
		}
	}

	/**
	 * Handle WebSocket open event
	 */
	private handleOpen(): void {
		console.log('🔌 Basic WebSocket connection opened');
		this._state.isConnecting = false;
		this._state.reconnectCount = 0;

		// Send basic authentication message
		if (this.authToken) {
			console.log('🔑 Sending authentication token');
			this.sendMessage({
				type: 'auth',
				timestamp: new Date().toISOString(),
				messageId: uuidv4(),
				data: {
					token: this.authToken
				}
			} as any);
		} else {
			console.error('❌ No auth token available for WebSocket authentication');
		}

		// Update connection state (not authenticated yet)
		this.updateConnectionState(true, false);
	}

	/**
	 * Handle WebSocket message event
	 */
	private handleMessage(event: MessageEvent): void {
		try {
			const message: WebSocketMessage = JSON.parse(event.data);

			// Handle authentication response
			if (message.type === 'auth') {
				const authData = message.data as any;
				if (authData.success || authData.user) {
					console.log('✅ Basic WebSocket authentication successful');
					this._state.isAuthenticated = true;
					this.sendPendingMessages();

					// Start ping timer only after successful authentication
					this.startPingTimer();

					// Notify connection handlers that we're fully ready
					this.notifyConnectionHandlers(true);
					console.log('🔄 WebSocket ready for use - connection stable');
				} else {
					console.error('❌ Basic WebSocket authentication failed:', authData);
					this._state.lastError = 'Authentication failed';
					this.notifyErrorHandlers('Authentication failed');
				}
				return;
			}

			// Handle pong response
			if (message.type === 'pong') {
				// Connection is alive
				return;
			}

			// Handle error messages
			if (message.type === 'error') {
				const errorData = message.data as any;
				console.error('❌ WebSocket error:', errorData.message);
				this._state.lastError = errorData.message;
				this.notifyErrorHandlers(errorData.message);

				// Handle auth errors by disconnecting
				if (errorData.code === 'AUTH_REQUIRED' || errorData.code === 'AUTH_FAILED') {
					this._state.isAuthenticated = false;
				}
				return;
			}

			// Dispatch message to handlers
			const handlers = this.messageHandlers.get(message.type);
			if (handlers) {
				handlers.forEach((handler) => {
					try {
						handler(message);
					} catch (error) {
						console.error('❌ Error in message handler:', error);
					}
				});
			} else {
				console.log('📨 Unhandled message type:', message.type);
			}
		} catch (error) {
			console.error('❌ Error parsing WebSocket message:', error);
		}
	}

	/**
	 * Handle WebSocket close event
	 */
	private handleClose(event: CloseEvent): void {
		console.log('🔌 WebSocket disconnected:', event.code, event.reason);

		this.clearPingTimer();
		this.updateConnectionState(false, false);
		this._state.isConnecting = false;

		// Attempt to reconnect if not manually disconnected
		if (event.code !== 1000 && this._state.reconnectCount < this.config.maxReconnectAttempts!) {
			this.scheduleReconnect();
		}
	}

	/**
	 * Handle WebSocket error event
	 */
	private handleError(): void {
		console.error('❌ WebSocket connection error');
		this._state.lastError = 'Connection error';
		this.notifyErrorHandlers('Connection error');
	}

	/**
	 * Schedule reconnection attempt
	 */
	private scheduleReconnect(): void {
		if (this.reconnectTimer) return;

		this._state.reconnectCount++;
		const delay = Math.min(
			this.config.reconnectInterval! * Math.pow(2, this._state.reconnectCount - 1),
			30000 // Max 30 seconds
		);

		console.log(`🔄 Scheduling reconnect attempt ${this._state.reconnectCount} in ${delay}ms`);

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			if (this.authToken) {
				this.connect(this.authToken);
			}
		}, delay);
	}

	/**
	 * Clear reconnect timer
	 */
	private clearReconnectTimer(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}

	/**
	 * Start ping timer to keep connection alive
	 */
	private startPingTimer(): void {
		this.clearPingTimer();

		this.pingTimer = setInterval(() => {
			if (this.ws && this.ws.readyState === WebSocket.OPEN) {
				this.sendMessage({
					type: 'ping',
					timestamp: new Date().toISOString(),
					messageId: uuidv4()
				} as any);
			}
		}, this.config.pingInterval);
	}

	/**
	 * Clear ping timer
	 */
	private clearPingTimer(): void {
		if (this.pingTimer) {
			clearInterval(this.pingTimer);
			this.pingTimer = null;
		}
	}

	/**
	 * Send pending messages that were queued while disconnected
	 */
	private sendPendingMessages(): void {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.pendingMessages.forEach((message) => {
				this.ws!.send(message);
			});
			this.pendingMessages = [];
		}
	}

	/**
	 * Update connection state and notify handlers
	 */
	private updateConnectionState(connected: boolean, authenticated: boolean): void {
		const wasConnected = this._state.isConnected;
		this._state.isConnected = connected;
		this._state.isAuthenticated = authenticated;

		if (wasConnected !== connected) {
			this.notifyConnectionHandlers(connected);
		}
	}

	/**
	 * Notify connection handlers
	 */
	private notifyConnectionHandlers(connected: boolean): void {
		this.connectionHandlers.forEach((handler) => {
			try {
				handler(connected);
			} catch (error) {
				console.error('❌ Error in connection handler:', error);
			}
		});
	}

	/**
	 * Notify error handlers
	 */
	private notifyErrorHandlers(error: string): void {
		this.errorHandlers.forEach((handler) => {
			try {
				handler(error);
			} catch (error) {
				console.error('❌ Error in error handler:', error);
			}
		});
	}
}

// Create singleton instance
let websocketService: WebSocketService | null = null;

export function getWebSocketService(): WebSocketService {
	if (!websocketService) {
		// Determine WebSocket URL based on environment
		let wsUrl: string;

		if (browser) {
			// Client-side: check if we're in development or production
			const isDev = location.port === '5173'; // Vite dev server port
			const isSecure = location.protocol === 'https:';
			const wsProtocol = isSecure ? 'wss:' : 'ws:';
			
			if (isDev) {
				// Development: separate WebSocket server on port 8080
				wsUrl = `${wsProtocol}//${location.hostname}:8080/ws`;
			} else {
				// Production: unified server on same port as HTTP
				const port = location.port ? `:${location.port}` : '';
				wsUrl = `${wsProtocol}//${location.hostname}${port}/ws`;
			}
		} else {
			// Server-side fallback (shouldn't be used but kept for safety)
			wsUrl = 'ws://localhost:8080/ws';
		}

		console.log('🔌 WebSocket service configured with URL:', wsUrl);

		websocketService = new WebSocketService({
			url: wsUrl
		});
	}

	return websocketService;
}
