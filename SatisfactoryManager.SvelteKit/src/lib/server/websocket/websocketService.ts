import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import {
	users,
	games,
	userGames,
	websocketConnections,
	userPresence,
	gameActivityLogs,
	type GameUserRole
} from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { WebSocketMessageSchema } from './types';
import type {
	WebSocketMessage,
	ConnectionInfo,
	GameRoom,
	ErrorMessage,
	AuthMessage,
	JoinGameMessage,
	LeaveGameMessage,
	PresenceUpdateMessage,
	PingMessage,
	PongMessage
} from './types';

export class WebSocketService {
	private wss: WebSocketServer | null = null;
	private connections = new Map<string, ConnectionInfo>();
	private webSockets = new Map<string, WebSocket>();
	private gameRooms = new Map<string, GameRoom>();
	private pingInterval: NodeJS.Timeout | null = null;

	constructor() {
		this.setupPingInterval();
	}

	/**
	 * Initialize WebSocket server
	 */
	public initialize(serverOrWss: any): void {
		// Check if we're getting a WebSocketServer directly or an HTTP server
		if (serverOrWss && typeof serverOrWss.on === 'function' && serverOrWss.clients) {
			// It's already a WebSocketServer
			console.log('🔌 Using existing WebSocket server');
			this.wss = serverOrWss;
		} else {
			// It's an HTTP server, create WebSocketServer
			console.log('🔌 Creating WebSocket server from HTTP server');
			this.wss = new WebSocketServer({
				server: serverOrWss,
				path: '/ws',
				verifyClient: (info: any) => {
					// Basic verification - detailed auth happens after connection
					return true;
				}
			});
		}

		this.wss!.on('connection', this.handleConnection.bind(this));
		console.log('🔌 WebSocket server initialized on /ws');
	}

	/**
	 * Handle new WebSocket connection
	 */
	private async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
		const connectionId = uuidv4();
		const userAgent = req.headers['user-agent'] || 'Unknown';
		const ipAddress = this.getClientIpAddress(req);

		console.log(`📡 New WebSocket connection: ${connectionId} from ${ipAddress}`);

		// Set up connection state
		ws.on('message', (data) => this.handleMessage(connectionId, data.toString()));
		ws.on('close', () => this.handleDisconnection(connectionId));
		ws.on('error', (error) => this.handleError(connectionId, error));
		ws.on('pong', () => this.handlePong(connectionId));

		// Store WebSocket instance
		this.webSockets.set(connectionId, ws);

		// Send auth required message
		this.sendMessage(connectionId, {
			type: 'error',
			timestamp: new Date().toISOString(),
			messageId: uuidv4(),
			data: {
				code: 'AUTH_REQUIRED',
				message: 'Authentication required. Send auth message with JWT token.'
			}
		});
	}

	/**
	 * Handle incoming WebSocket message
	 */
	private async handleMessage(connectionId: string, data: Buffer | string): Promise<void> {
		try {
			const messageText = data.toString();
			const messageData = JSON.parse(messageText);
			console.log(
				'📨 Server received message:',
				messageData.type,
				'messageId:',
				messageData.messageId
			);

			// Validate message structure
			const validationResult = WebSocketMessageSchema.safeParse(messageData);
			if (!validationResult.success) {
				this.sendError(
					connectionId,
					'INVALID_MESSAGE',
					'Invalid message format',
					validationResult.error
				);
				return;
			}

			const message = validationResult.data;

			// Handle different message types
			console.log('📨 Processing message type:', message.type);
			switch (message.type) {
				case 'auth':
					await this.handleAuthMessage(connectionId, message as AuthMessage);
					break;
				case 'join_game':
					console.log('🎮 About to call handleJoinGame for', connectionId);
					await this.handleJoinGame(connectionId, message as JoinGameMessage);
					break;
				case 'leave_game':
					await this.handleLeaveGame(connectionId, message as LeaveGameMessage);
					break;
				case 'presence_update':
					await this.handlePresenceUpdate(connectionId, message as PresenceUpdateMessage);
					break;
				case 'ping':
					await this.handlePing(connectionId, message as PingMessage);
					break;
				default:
					this.sendError(
						connectionId,
						'UNSUPPORTED_MESSAGE_TYPE',
						`Message type '${message.type}' is not supported`
					);
			}
		} catch (error) {
			console.error('❌ Error handling WebSocket message:', error);
			this.sendError(connectionId, 'MESSAGE_PROCESSING_ERROR', 'Failed to process message');
		}
	}

	/**
	 * Handle authentication message
	 */
	private async handleAuthMessage(connectionId: string, message: AuthMessage): Promise<void> {
		try {
			console.log(`🔑 WebSocket auth attempt from ${connectionId}`);
			const { token } = message.data;

			// Validate JWT token using the same logic as the main app
			console.log(`🔑 Validating JWT token for ${connectionId}`);
			const tokenValidation = await this.validateJwtToken(token);
			if (tokenValidation.error) {
				console.error(`❌ JWT validation failed for ${connectionId}:`, tokenValidation.error);
				this.sendError(connectionId, 'AUTH_FAILED', tokenValidation.error);
				return;
			}

			console.log(`✅ JWT valid for ${connectionId}, email: ${tokenValidation.email}`);

			// Get user from database
			const [user] = await db
				.select()
				.from(users)
				.where(eq(users.email, tokenValidation.email!.toLowerCase()))
				.limit(1);

			if (!user) {
				this.sendError(connectionId, 'USER_NOT_FOUND', 'User not found in system');
				return;
			}

			// Create connection info
			const connectionInfo: ConnectionInfo = {
				id: connectionId,
				userId: user.id,
				userEmail: user.email,
				userName: user.displayName,
				gameId: null,
				siteId: null,
				lastPing: new Date(),
				connectedAt: new Date(),
				role: null
			};

			this.connections.set(connectionId, connectionInfo);

			// Store connection in database
			await db
				.insert(websocketConnections)
				.values({
					id: uuidv4(),
					userId: user.id,
					gameId: null, // Will be updated when user joins a game
					connectionId: connectionId,
					connectedAt: new Date(),
					lastPingAt: new Date(),
					userAgent: '',
					ipAddress: ''
				})
				.onConflictDoNothing();

			console.log(
				`✅ User authenticated: ${user.displayName} (${user.email}) - ABOUT TO CALL AUTO-DETECTION`
			);
			console.log('🔍 DEBUG: Execution reached line after authentication success');

			// Auto-detect and join game after authentication
			console.log(
				'🔄 About to call autoDetectAndJoinGame for connection:',
				connectionId,
				'user:',
				user.id
			);
			try {
				await this.autoDetectAndJoinGame(connectionId, user.id);
			} catch (autoDetectError) {
				console.error('❌ Error in autoDetectAndJoinGame call:', autoDetectError);
			}

			// Send success response
			this.sendMessage(connectionId, {
				type: 'auth',
				timestamp: new Date().toISOString(),
				messageId: uuidv4(),
				data: {
					success: true,
					user: {
						id: user.id,
						name: user.displayName,
						email: user.email
					}
				}
			} as any);
		} catch (error) {
			console.error('❌ Authentication failed:', error);
			this.sendError(connectionId, 'AUTH_FAILED', 'Authentication failed');
		}
	}

	/**
	 * Auto-detect and join game based on user's current context
	 * This replaces explicit join_game messages for better reliability
	 */
	private async autoDetectAndJoinGame(connectionId: string, userId: string): Promise<void> {
		try {
			console.log('🔍 Auto-detecting game context for user:', userId, 'connection:', connectionId);

			// SIMPLIFIED APPROACH: Just get the first game the user has access to
			const userGamesList = await db
				.select({
					gameId: userGames.gameId,
					role: userGames.role
				})
				.from(userGames)
				.where(eq(userGames.userId, userId))
				.limit(1);

			console.log('🔍 Found games for user:', userGamesList.length);

			if (userGamesList.length === 0) {
				console.log('🔍 No games found for user, skipping auto-join');
				return;
			}

			const gameToJoin = userGamesList[0];
			console.log(
				`🎯 Auto-joining user to game: ${gameToJoin.gameId} with role: ${gameToJoin.role}`
			);

			// Join the game automatically using the same logic as handleJoinGame
			await this.autoJoinGameRoom(connectionId, gameToJoin.gameId, null, gameToJoin.role);
			console.log('✅ Auto-join completed successfully');
		} catch (error) {
			console.error('❌ Error in auto-detect game:', error);
			// Don't fail the connection if auto-join fails
		}
	}

	/**
	 * Automatically join game room (used by auto-detection)
	 */
	private async autoJoinGameRoom(
		connectionId: string,
		gameId: string,
		siteId: string | null,
		role: GameUserRole
	): Promise<void> {
		const connection = this.connections.get(connectionId);
		if (!connection) return;

		// Update connection info
		connection.gameId = gameId;
		connection.siteId = siteId;
		connection.role = role;

		// Update database connection
		await db
			.update(websocketConnections)
			.set({
				gameId: gameId,
				lastPingAt: new Date()
			})
			.where(eq(websocketConnections.connectionId, connectionId));

		// Join the game room
		await this.joinGameRoom(connectionId, gameId);

		// Update user presence
		await this.updateUserPresence(connection.userId, gameId, siteId, 'joined_game', true);

		// Log activity
		await this.logGameActivity(
			gameId,
			connection.userId,
			'user_joined',
			'user',
			connection.userId,
			connection.userName,
			`${connection.userName} joined the game`,
			JSON.stringify({ siteId })
		);

		console.log(`🎮 User ${connection.userName} auto-joined game ${gameId}`);

		// Broadcast user joined to other users in the game
		this.broadcastToGameRoom(
			gameId,
			{
				type: 'user_joined',
				timestamp: new Date().toISOString(),
				messageId: uuidv4(),
				data: {
					gameId: gameId,
					userId: connection.userId,
					userName: connection.userName,
					userEmail: connection.userEmail,
					siteId: siteId || undefined,
					activity: 'joined_game'
				}
			},
			connectionId
		);
	}

	/**
	 * Handle join game message
	 */
	private async handleJoinGame(connectionId: string, message: JoinGameMessage): Promise<void> {
		console.log('🎮 Server received join_game message:', message.messageId, 'from', connectionId);
		const connection = this.connections.get(connectionId);
		if (!connection) {
			console.log('❌ Connection not found for', connectionId);
			this.sendError(connectionId, 'NOT_AUTHENTICATED', 'Must authenticate before joining game');
			return;
		}

		const { gameId, siteId } = message.data;

		try {
			// Verify user has access to this game
			const [userGame] = await db
				.select()
				.from(userGames)
				.where(and(eq(userGames.userId, connection.userId), eq(userGames.gameId, gameId)))
				.limit(1);

			if (!userGame) {
				this.sendError(connectionId, 'ACCESS_DENIED', 'User does not have access to this game');
				return;
			}

			// Leave current game if any
			if (connection.gameId) {
				await this.leaveGameRoom(connectionId);
			}

			// Update connection info
			connection.gameId = gameId;
			connection.siteId = siteId || null;
			connection.role = userGame.role;

			// Join game room
			await this.joinGameRoom(connectionId, gameId);

			// Update user presence
			await this.updateUserPresence(connection.userId, gameId, siteId || null, 'joined_game');

			// Update database connection record
			await db
				.update(websocketConnections)
				.set({
					gameId: gameId,
					lastPingAt: new Date()
				})
				.where(eq(websocketConnections.connectionId, connectionId));

			// Log activity
			await this.logGameActivity(
				gameId,
				connection.userId,
				'user_joined',
				'user',
				connection.userId,
				connection.userName,
				`${connection.userName} joined the game`,
				JSON.stringify({ siteId })
			);

			console.log(`🎮 User ${connection.userName} joined game ${gameId}`);

			// Send success response with the same messageId
			console.log('🎮 Sending join_game response:', message.messageId, 'to', connectionId);
			this.sendMessage(connectionId, {
				type: 'join_game',
				timestamp: new Date().toISOString(),
				messageId: message.messageId,
				data: {
					success: true,
					gameId: gameId,
					siteId: siteId,
					role: userGame.role
				}
			} as any);

			// Broadcast user joined to other users in the game
			this.broadcastToGameRoom(
				gameId,
				{
					type: 'user_joined',
					timestamp: new Date().toISOString(),
					messageId: uuidv4(),
					data: {
						gameId: gameId,
						userId: connection.userId,
						userName: connection.userName,
						userEmail: connection.userEmail,
						siteId: siteId,
						activity: 'joined_game'
					}
				},
				connectionId
			);
		} catch (error) {
			console.error('❌ Error joining game:', error);
			this.sendError(connectionId, 'JOIN_GAME_FAILED', 'Failed to join game');
		}
	}

	/**
	 * Handle leave game message
	 */
	private async handleLeaveGame(connectionId: string, message: LeaveGameMessage): Promise<void> {
		const connection = this.connections.get(connectionId);
		if (!connection || !connection.gameId) {
			this.sendError(connectionId, 'NOT_IN_GAME', 'Not currently in a game');
			return;
		}

		try {
			await this.leaveGameRoom(connectionId);

			// Send success response with the same messageId
			this.sendMessage(connectionId, {
				type: 'leave_game',
				timestamp: new Date().toISOString(),
				messageId: message.messageId,
				data: {
					success: true
				}
			} as any);
		} catch (error) {
			console.error('❌ Error leaving game:', error);
			this.sendError(connectionId, 'LEAVE_GAME_FAILED', 'Failed to leave game');
		}
	}

	/**
	 * Handle presence update
	 */
	private async handlePresenceUpdate(
		connectionId: string,
		message: PresenceUpdateMessage
	): Promise<void> {
		const connection = this.connections.get(connectionId);
		if (!connection || !connection.gameId) {
			this.sendError(connectionId, 'NOT_IN_GAME', 'Must be in a game to update presence');
			return;
		}

		const { siteId, activity } = message.data;

		try {
			// Update connection info
			connection.siteId = siteId || null;

			// Update user presence
			await this.updateUserPresence(
				connection.userId,
				connection.gameId,
				siteId || null,
				activity || null
			);

			// Update game room presence
			const gameRoom = this.gameRooms.get(connection.gameId);
			if (gameRoom && gameRoom.userPresence.has(connection.userId)) {
				const presence = gameRoom.userPresence.get(connection.userId)!;
				presence.siteId = siteId || null;
				presence.activity = activity || null;
				presence.lastSeen = new Date();
			}

			// Send success response
			this.sendMessage(connectionId, {
				type: 'presence_update',
				timestamp: new Date().toISOString(),
				messageId: uuidv4(),
				data: {
					success: true
				}
			} as any);
		} catch (error) {
			console.error('❌ Error updating presence:', error);
			this.sendError(connectionId, 'PRESENCE_UPDATE_FAILED', 'Failed to update presence');
		}
	}

	/**
	 * Handle ping message
	 */
	private async handlePing(connectionId: string, message: PingMessage): Promise<void> {
		const connection = this.connections.get(connectionId);
		if (connection) {
			connection.lastPing = new Date();
		}

		// Send pong response
		this.sendMessage(connectionId, {
			type: 'pong',
			timestamp: new Date().toISOString(),
			messageId: uuidv4()
		});
	}

	/**
	 * Handle pong message
	 */
	private handlePong(connectionId: string): void {
		const connection = this.connections.get(connectionId);
		if (connection) {
			connection.lastPing = new Date();
		}
	}

	/**
	 * Handle disconnection
	 */
	private async handleDisconnection(connectionId: string): Promise<void> {
		console.log(`📡 WebSocket disconnected: ${connectionId}`);

		const connection = this.connections.get(connectionId);
		if (connection) {
			// Leave game room if in one
			if (connection.gameId) {
				await this.leaveGameRoom(connectionId);
			}

			// Remove connection from database
			await db
				.delete(websocketConnections)
				.where(eq(websocketConnections.connectionId, connectionId));
		}

		// Clean up
		this.connections.delete(connectionId);
		this.webSockets.delete(connectionId);
	}

	/**
	 * Handle WebSocket error
	 */
	private handleError(connectionId: string, error: Error): void {
		console.error(`❌ WebSocket error for ${connectionId}:`, error);
	}

	/**
	 * Join game room
	 */
	private async joinGameRoom(connectionId: string, gameId: string): Promise<void> {
		const connection = this.connections.get(connectionId);
		if (!connection) return;

		// Get or create game room
		let gameRoom = this.gameRooms.get(gameId);
		if (!gameRoom) {
			gameRoom = {
				gameId: gameId,
				connections: new Set(),
				userPresence: new Map()
			};
			this.gameRooms.set(gameId, gameRoom);
		}

		// Add connection to room
		gameRoom.connections.add(connectionId);
		gameRoom.userPresence.set(connection.userId, {
			userId: connection.userId,
			userName: connection.userName,
			userEmail: connection.userEmail,
			siteId: connection.siteId,
			activity: null,
			lastSeen: new Date()
		});
	}

	/**
	 * Leave game room
	 */
	private async leaveGameRoom(connectionId: string): Promise<void> {
		const connection = this.connections.get(connectionId);
		if (!connection || !connection.gameId) return;

		const gameId = connection.gameId;
		const gameRoom = this.gameRooms.get(gameId);

		if (gameRoom) {
			// Remove connection from room
			gameRoom.connections.delete(connectionId);
			gameRoom.userPresence.delete(connection.userId);

			// Broadcast user left to other users
			this.broadcastToGameRoom(
				gameId,
				{
					type: 'user_left',
					timestamp: new Date().toISOString(),
					messageId: uuidv4(),
					data: {
						gameId: gameId,
						userId: connection.userId,
						userName: connection.userName
					}
				},
				connectionId
			);

			// Clean up empty room
			if (gameRoom.connections.size === 0) {
				this.gameRooms.delete(gameId);
			}
		}

		// Update user presence to offline
		await this.updateUserPresence(connection.userId, gameId, null, null, false);

		// Log activity
		await this.logGameActivity(
			gameId,
			connection.userId,
			'user_left',
			'user',
			connection.userId,
			connection.userName,
			`${connection.userName} left the game`,
			''
		);

		// Update connection info
		connection.gameId = null;
		connection.siteId = null;
		connection.role = null;
	}

	/**
	 * Update user presence in database
	 */
	private async updateUserPresence(
		userId: string,
		gameId: string,
		siteId: string | null,
		activity: string | null,
		isOnline: boolean = true
	): Promise<void> {
		try {
			await db
				.insert(userPresence)
				.values({
					id: uuidv4(),
					userId: userId,
					gameId: gameId,
					isOnline: isOnline,
					lastSeenAt: new Date(),
					currentSiteId: siteId,
					activity: activity
				})
				.onConflictDoUpdate({
					target: [userPresence.userId, userPresence.gameId],
					set: {
						isOnline: isOnline,
						lastSeenAt: new Date(),
						currentSiteId: siteId,
						activity: activity
					}
				});
		} catch (error) {
			console.error('❌ Error updating user presence:', error);
		}
	}

	/**
	 * Log game activity
	 */
	private async logGameActivity(
		gameId: string,
		userId: string,
		activityType: any,
		entityType: string | null,
		entityId: string | null,
		entityName: string | null,
		changeDescription: string,
		changeData: string
	): Promise<void> {
		try {
			await db.insert(gameActivityLogs).values({
				id: uuidv4(),
				gameId: gameId,
				userId: userId,
				activityType: activityType,
				entityType: entityType,
				entityId: entityId,
				entityName: entityName,
				changeDescription: changeDescription,
				changeData: changeData,
				createdAt: new Date()
			});
		} catch (error) {
			console.error('❌ Error logging game activity:', error);
		}
	}

	/**
	 * Broadcast message to all users in a game room
	 */
	public broadcastToGameRoom(
		gameId: string,
		message: WebSocketMessage,
		excludeConnectionId?: string
	): void {
		const gameRoom = this.gameRooms.get(gameId);
		console.log(`📡 broadcastToGameRoom called for game ${gameId}, gameRoom exists:`, !!gameRoom);

		if (!gameRoom) {
			console.log(
				`📡 No active game room for gameId: ${gameId}, checking for active connections to recreate room`
			);

			// Check if there are any active connections for this game
			const activeConnections = Array.from(this.connections.values()).filter(
				(conn) => conn.gameId === gameId
			);

			if (activeConnections.length === 0) {
				console.log(`📡 No active connections for game ${gameId}, skipping broadcast`);
				return;
			}

			// Recreate the game room with active connections
			console.log(
				`📡 Recreating game room for ${gameId} with ${activeConnections.length} connections`
			);
			const newGameRoom = {
				gameId: gameId,
				connections: new Set(activeConnections.map((conn) => conn.id)),
				userPresence: new Map()
			};
			this.gameRooms.set(gameId, newGameRoom);

			// Update the gameRoom variable to use the newly created room
			const recreatedRoom = this.gameRooms.get(gameId)!;
			console.log(
				`📡 Broadcasting to ${recreatedRoom.connections.size} connections in recreated room for game ${gameId}`
			);

			const messageText = JSON.stringify(message);
			for (const connectionId of recreatedRoom.connections) {
				if (excludeConnectionId && connectionId === excludeConnectionId) continue;

				const ws = this.webSockets.get(connectionId);
				if (ws && ws.readyState === WebSocket.OPEN) {
					try {
						console.log(`📡 Sending message to connection ${connectionId}:`, message.type);
						ws.send(messageText);
					} catch (error) {
						console.error(`❌ Error broadcasting to ${connectionId}:`, error);
					}
				} else {
					console.log(`📡 Connection ${connectionId} is not ready, readyState:`, ws?.readyState);
				}
			}
			return;
		}

		console.log(`📡 Broadcasting to ${gameRoom.connections.size} connections in game ${gameId}`);
		const messageText = JSON.stringify(message);

		for (const connectionId of gameRoom.connections) {
			if (excludeConnectionId && connectionId === excludeConnectionId) continue;

			const ws = this.webSockets.get(connectionId);
			if (ws && ws.readyState === WebSocket.OPEN) {
				try {
					console.log(`📡 Sending message to connection ${connectionId}:`, message.type);
					ws.send(messageText);
				} catch (error) {
					console.error(`❌ Error broadcasting to ${connectionId}:`, error);
				}
			} else {
				console.log(`📡 Connection ${connectionId} is not ready, readyState:`, ws?.readyState);
			}
		}
	}

	/**
	 * Send message to specific connection
	 */
	private sendMessage(connectionId: string, message: any): void {
		const ws = this.webSockets.get(connectionId);
		if (ws && ws.readyState === WebSocket.OPEN) {
			try {
				ws.send(JSON.stringify(message));
			} catch (error) {
				console.error(`❌ Error sending message to ${connectionId}:`, error);
			}
		}
	}

	/**
	 * Send error message
	 */
	private sendError(connectionId: string, code: string, message: string, details?: any): void {
		const errorMessage: ErrorMessage = {
			type: 'error',
			timestamp: new Date().toISOString(),
			messageId: uuidv4(),
			data: {
				code: code,
				message: message,
				details: details
			}
		};

		this.sendMessage(connectionId, errorMessage);
	}

	/**
	 * Setup ping interval to keep connections alive
	 */
	private setupPingInterval(): void {
		this.pingInterval = setInterval(() => {
			this.pingAllConnections();
		}, 30000); // 30 seconds
	}

	/**
	 * Ping all connections to keep them alive
	 */
	private pingAllConnections(): void {
		for (const [connectionId, ws] of this.webSockets.entries()) {
			if (ws.readyState === WebSocket.OPEN) {
				try {
					ws.ping();
				} catch (error) {
					console.error(`❌ Error pinging connection ${connectionId}:`, error);
				}
			}
		}
	}

	/**
	 * Get client IP address from request
	 */
	private getClientIpAddress(req: IncomingMessage): string {
		const xForwardedFor = req.headers['x-forwarded-for'];
		if (xForwardedFor) {
			return (Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor).split(',')[0].trim();
		}
		return req.socket.remoteAddress || 'Unknown';
	}

	/**
	 * Validate JWT token with Azure B2C (using simplified validation like the main app)
	 */
	private async validateJwtToken(
		token: string
	): Promise<{ email?: string; displayName?: string; error?: string }> {
		try {
			// Basic JWT parsing (without signature verification for now)
			const parts = token.split('.');
			if (parts.length !== 3) {
				return { error: 'Invalid token format' };
			}

			// Decode payload (second part)
			const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

			// Check token expiration
			if (payload.exp && Date.now() >= payload.exp * 1000) {
				return { error: 'Token expired' };
			}

			// Extract email from token claims
			const email = payload.emails?.[0] || payload.email || payload.preferred_username;
			if (!email) {
				return { error: 'No email found in token' };
			}

			// Extract display name
			const displayName = payload.name || payload.given_name || 'Unknown User';

			return { email, displayName };
		} catch (error) {
			console.error('Error validating JWT token:', error);
			return { error: 'Token validation failed' };
		}
	}

	/**
	 * Get connections count for a game
	 */
	public getGameConnectionsCount(gameId: string): number {
		const gameRoom = this.gameRooms.get(gameId);
		return gameRoom ? gameRoom.connections.size : 0;
	}

	/**
	 * Get online users for a game
	 */
	public getOnlineUsersForGame(
		gameId: string
	): Array<{ userId: string; userName: string; siteId: string | null; activity: string | null }> {
		const gameRoom = this.gameRooms.get(gameId);
		if (!gameRoom) return [];

		return Array.from(gameRoom.userPresence.values()).map((presence) => ({
			userId: presence.userId,
			userName: presence.userName,
			siteId: presence.siteId,
			activity: presence.activity
		}));
	}

	/**
	 * Cleanup on shutdown
	 */
	public shutdown(): void {
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
		}

		// Close all connections
		for (const ws of this.webSockets.values()) {
			if (ws.readyState === WebSocket.OPEN) {
				ws.close();
			}
		}

		// Close server
		if (this.wss) {
			this.wss.close();
		}

		console.log('🔌 WebSocket server shutdown complete');
	}

	/**
	 * Create a properly formatted WebSocket message with timestamp and messageId
	 */
	public createMessage(type: string, data: any): any {
		return {
			timestamp: new Date().toISOString(),
			messageId: uuidv4(),
			type,
			data
		};
	}
}

// Singleton instance
export const websocketService = new WebSocketService();
