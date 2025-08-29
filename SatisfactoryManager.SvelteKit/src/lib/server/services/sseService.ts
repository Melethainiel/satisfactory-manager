// Server-side SSE connection management and broadcasting

// Store active SSE connections
const connections = new Map<string, { 
	controller: ReadableStreamDefaultController<Uint8Array>;
	userId: string;
	gameId?: string;
	lastHeartbeat: number;
}>();

// Cleanup inactive connections every 30 seconds
setInterval(() => {
	const now = Date.now();
	for (const [id, conn] of connections.entries()) {
		if (now - conn.lastHeartbeat > 60000) { // 1 minute timeout
			try {
				conn.controller.close();
			} catch (error) {
				console.error('Error closing SSE connection:', error);
			}
			connections.delete(id);
			console.log(`🔌 SSE connection ${id} cleaned up due to timeout`);
		}
	}
}, 30000);

export function addConnection(connectionId: string, controller: ReadableStreamDefaultController<Uint8Array>, userId: string, gameId?: string) {
	connections.set(connectionId, {
		controller,
		userId,
		gameId,
		lastHeartbeat: Date.now()
	});
}

export function removeConnection(connectionId: string) {
	connections.delete(connectionId);
}

export function updateHeartbeat(connectionId: string) {
	const conn = connections.get(connectionId);
	if (conn) {
		conn.lastHeartbeat = Date.now();
	}
}

// Broadcast message to specific connections
export function broadcastToGame(gameId: string, message: any) {
	const encoder = new TextEncoder();
	const data = `data: ${JSON.stringify({
		...message,
		timestamp: new Date().toISOString()
	})}\n\n`;

	let broadcastCount = 0;
	for (const [id, conn] of connections.entries()) {
		if (conn.gameId === gameId) {
			try {
				conn.controller.enqueue(encoder.encode(data));
				broadcastCount++;
			} catch (error) {
				console.error(`Error broadcasting to connection ${id}:`, error);
				connections.delete(id);
			}
		}
	}

	if (broadcastCount > 0) {
		console.log(`📡 Broadcasted message to ${broadcastCount} connections for game ${gameId}`);
	}
}

// Broadcast to specific user
export function broadcastToUser(userId: string, message: any) {
	const encoder = new TextEncoder();
	const data = `data: ${JSON.stringify({
		...message,
		timestamp: new Date().toISOString()
	})}\n\n`;

	for (const [id, conn] of connections.entries()) {
		if (conn.userId === userId) {
			try {
				conn.controller.enqueue(encoder.encode(data));
				console.log(`📡 Broadcasted message to user ${userId}`);
			} catch (error) {
				console.error(`Error broadcasting to user ${userId}:`, error);
				connections.delete(id);
			}
		}
	}
}

// Get connection stats
export function getConnectionStats() {
	const stats = {
		totalConnections: connections.size,
		gameConnections: {} as Record<string, number>,
		users: new Set<string>()
	};

	for (const conn of connections.values()) {
		stats.users.add(conn.userId);
		if (conn.gameId) {
			stats.gameConnections[conn.gameId] = (stats.gameConnections[conn.gameId] || 0) + 1;
		}
	}

	return {
		...stats,
		uniqueUsers: stats.users.size
	};
}