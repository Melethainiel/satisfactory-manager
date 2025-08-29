import { browser } from '$app/environment';

interface SSEMessage {
	type: string;
	timestamp: string;
	connectionId?: string;
	user?: {
		id: string;
		name: string;
		email: string;
	};
	data?: any;
}

interface SSEServiceConfig {
	baseUrl?: string;
	reconnectInterval?: number;
	maxReconnectAttempts?: number;
}

interface ConnectionState {
	isConnected: boolean;
	isConnecting: boolean;
	reconnectCount: number;
	lastError: string | null;
	connectionId: string | null;
}

type MessageHandler = (message: SSEMessage) => void;
type ConnectionHandler = (connected: boolean) => void;
type ErrorHandler = (error: string) => void;

export class SSEService {
	private eventSource: EventSource | null = null;
	private config: Required<SSEServiceConfig>;
	private reconnectTimer: NodeJS.Timeout | null = null;
	private messageHandlers = new Map<string, MessageHandler[]>();
	private connectionHandlers: ConnectionHandler[] = [];
	private errorHandlers: ErrorHandler[] = [];
	private authToken: string | null = null;
	private currentGameId: string | null = null;

	// State management using Svelte 5 runes
	private _state = $state<ConnectionState>({
		isConnected: false,
		isConnecting: false,
		reconnectCount: 0,
		lastError: null,
		connectionId: null
	});

	constructor(config: SSEServiceConfig = {}) {
		this.config = {
			baseUrl: config.baseUrl || '/api/events',
			reconnectInterval: config.reconnectInterval || 3000,
			maxReconnectAttempts: config.maxReconnectAttempts || 10
		};
	}

	/**
	 * Get current connection state (reactive)
	 */
	get state(): ConnectionState {
		return this._state;
	}

	/**
	 * Connect to SSE stream
	 */
	public async connect(authToken: string, gameId?: string): Promise<boolean> {
		if (!browser) return false;

		// Prevent multiple connection attempts
		if (this._state.isConnecting) {
			console.log('🔄 SSE connection already in progress, waiting...');
			// Wait for current connection to complete instead of skipping
			let retries = 0;
			while (this._state.isConnecting && retries < 50) { // Wait up to 5 seconds
				await new Promise(resolve => setTimeout(resolve, 100));
				retries++;
			}
			if (this._state.isConnecting) {
				console.log('⏰ Previous connection attempt timed out, forcing new connection');
				this._state.isConnecting = false;
			}
		}

		console.log('🔌 Attempting SSE connection:', { gameId });
		this.authToken = authToken;
		this.currentGameId = gameId || null;
		this._state.isConnecting = true;
		this._state.lastError = null;

		try {
			// Close existing connection
			if (this.eventSource) {
				this.disconnect();
			}

			// Build URL with token and game ID
			const url = new URL(this.config.baseUrl, window.location.origin);
			url.searchParams.set('token', authToken);
			if (gameId) {
				url.searchParams.set('gameId', gameId);
			}

			console.log('🔌 Creating SSE connection');

			// Create EventSource (token passed via URL parameter)
			this.eventSource = new EventSource(url.toString());
			console.log('🔌 EventSource created, readyState:', this.eventSource.readyState);
			
			// Set up event handlers
			this.eventSource.onopen = this.handleOpen.bind(this);
			this.eventSource.onmessage = this.handleMessage.bind(this);
			this.eventSource.onerror = this.handleError.bind(this);

			return new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					console.log('⏰ SSE connection timed out after 10 seconds');
					this._state.isConnecting = false;
					reject(new Error('SSE connection timeout after 10 seconds'));
				}, 10000);

				const onConnect = (connected: boolean) => {
					clearTimeout(timeout);
					this.removeConnectionHandler(onConnect);
					if (connected) {
						console.log('✅ SSE connection established');
						resolve(true);
					} else {
						console.log('❌ SSE connection failed');
						this._state.isConnecting = false;
						reject(new Error('SSE connection failed'));
					}
				};

				this.addConnectionHandler(onConnect);
			});

		} catch (error) {
			this._state.isConnecting = false;
			this._state.lastError = error instanceof Error ? error.message : 'Connection failed';
			this.notifyErrorHandlers(this._state.lastError);
			return false;
		}
	}

	/**
	 * Disconnect from SSE stream
	 */
	public disconnect(): void {
		console.log('🔌 Disconnecting SSE service...');
		
		this.clearReconnectTimer();

		if (this.eventSource) {
			this.eventSource.onopen = null;
			this.eventSource.onmessage = null;
			this.eventSource.onerror = null;
			this.eventSource.close();
			this.eventSource = null;
		}

		// Reset state
		this._state.isConnected = false;
		this._state.isConnecting = false;
		this._state.reconnectCount = 0;
		this._state.lastError = null;
		this._state.connectionId = null;
		
		// Notify handlers
		this.notifyConnectionHandlers(false);
		
		console.log('✅ SSE service disconnected');
	}

	/**
	 * Join a specific game (reconnect with game ID)
	 */
	public async joinGame(gameId: string): Promise<boolean> {
		if (!this.authToken) {
			throw new Error('Must be authenticated before joining game');
		}

		console.log('🎮 Joining game room:', gameId);
		
		// Ensure clean disconnection before reconnecting
		this.disconnect();
		
		// Small delay to ensure cleanup completes
		await new Promise(resolve => setTimeout(resolve, 50));
		
		return await this.connect(this.authToken, gameId);
	}

	/**
	 * Leave current game (reconnect without game ID)
	 */
	public async leaveGame(): Promise<boolean> {
		if (!this.authToken) {
			return true;
		}

		console.log('🚪 Leaving game room');
		
		// Ensure clean disconnection before reconnecting
		this.disconnect();
		
		// Small delay to ensure cleanup completes
		await new Promise(resolve => setTimeout(resolve, 50));
		
		return await this.connect(this.authToken);
	}

	/**
	 * Handle SSE open event
	 */
	private handleOpen(): void {
		console.log('🔌 SSE connection opened');
		this._state.isConnecting = false;
		this._state.reconnectCount = 0;
	}

	/**
	 * Handle SSE message event
	 */
	private handleMessage(event: MessageEvent): void {
		try {
			const message: SSEMessage = JSON.parse(event.data);
			console.log('📨 SSE message:', message.type);
			
			// Handle connection confirmation
			if (message.type === 'connected') {
				console.log('✅ SSE authentication successful');
				this._state.isConnected = true;
				this._state.connectionId = message.connectionId || null;
				this.notifyConnectionHandlers(true);
				return;
			}

			// Handle heartbeat
			if (message.type === 'heartbeat') {
				// Connection is alive
				return;
			}

			// Handle error messages
			if (message.type === 'error') {
				const errorData = message.data as any;
				console.error('❌ SSE error:', errorData.message);
				this._state.lastError = errorData.message;
				this.notifyErrorHandlers(errorData.message);
				return;
			}

			// Dispatch message to handlers
			const handlers = this.messageHandlers.get(message.type);
			if (handlers) {
				handlers.forEach((handler) => {
					try {
						handler(message);
					} catch (error) {
						console.error('❌ Error in SSE message handler:', error);
					}
				});
			} else {
				console.log('📨 Unhandled SSE message type:', message.type);
			}

		} catch (error) {
			console.error('❌ Error parsing SSE message:', error);
		}
	}

	/**
	 * Handle SSE error event
	 */
	private handleError(event: Event): void {
		console.error('❌ SSE connection error:', event);
		console.error('❌ EventSource readyState:', this.eventSource?.readyState);
		console.error('❌ EventSource URL:', this.eventSource?.url);
		
		this._state.isConnected = false;
		this._state.lastError = 'Connection error';
		this.notifyErrorHandlers('Connection error');
		this.notifyConnectionHandlers(false);

		// Attempt to reconnect if not manually disconnected
		if (this._state.reconnectCount < this.config.maxReconnectAttempts) {
			this.scheduleReconnect();
		} else {
			this._state.isConnecting = false;
			console.log('❌ Max reconnection attempts reached');
		}
	}

	/**
	 * Schedule reconnection attempt
	 */
	private scheduleReconnect(): void {
		if (this.reconnectTimer) return;

		this._state.reconnectCount++;
		const delay = Math.min(
			this.config.reconnectInterval * Math.pow(2, this._state.reconnectCount - 1),
			30000 // Max 30 seconds
		);

		console.log(`🔄 Scheduling SSE reconnect attempt ${this._state.reconnectCount}/${this.config.maxReconnectAttempts} in ${delay}ms`);

		this.reconnectTimer = setTimeout(async () => {
			this.reconnectTimer = null;
			
			// Check if we should still reconnect
			if (!this.authToken || this._state.reconnectCount >= this.config.maxReconnectAttempts) {
				console.log('🚫 Stopping SSE reconnection attempts');
				return;
			}

			try {
				await this.connect(this.authToken, this.currentGameId || undefined);
			} catch (error) {
				console.error('❌ SSE reconnection attempt failed:', error);
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
	 * Add message handler for specific message type
	 */
	public addMessageHandler(type: string, handler: MessageHandler): void {
		if (!this.messageHandlers.has(type)) {
			this.messageHandlers.set(type, []);
		}
		this.messageHandlers.get(type)!.push(handler);
	}

	/**
	 * Remove message handler
	 */
	public removeMessageHandler(type: string, handler: MessageHandler): void {
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
	 * Notify connection handlers
	 */
	private notifyConnectionHandlers(connected: boolean): void {
		this.connectionHandlers.forEach((handler) => {
			try {
				handler(connected);
			} catch (error) {
				console.error('❌ Error in SSE connection handler:', error);
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
				console.error('❌ Error in SSE error handler:', error);
			}
		});
	}
}

// Create singleton instance
let sseService: SSEService | null = null;

export function getSSEService(): SSEService {
	if (!browser) {
		throw new Error('SSE service should only be initialized on the client side');
	}
	
	if (!sseService) {
		console.log('🔌 SSE service initialized');
		sseService = new SSEService();
	}

	return sseService;
}