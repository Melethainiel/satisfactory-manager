import { WebSocketServer } from 'ws';
import { websocketService } from './websocketService.js';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';

/**
 * Unified HTTP+WebSocket server for production deployment
 * Uses the same HTTP server as SvelteKit for WebSocket upgrades
 */
export class UnifiedWebSocketServer {
	private wss: WebSocketServer | null = null;
	private httpServer: any = null;
	private isInitialized = false;

	/**
	 * Initialize WebSocket server using existing HTTP server
	 * This integrates with SvelteKit's Node.js adapter HTTP server
	 */
	public initialize(httpServer: any): void {
		if (this.isInitialized) {
			console.log('🔌 Unified WebSocket server already initialized');
			return;
		}

		try {
			console.log('🔌 Initializing unified HTTP+WebSocket server...');

			this.httpServer = httpServer;

			// Create WebSocket server without a separate port
			// It will use the HTTP server for upgrade requests
			this.wss = new WebSocketServer({
				server: httpServer,
				path: '/ws'
			});

			console.log('🔌 WebSocket server attached to HTTP server on /ws');

			// Handle WebSocket server errors
			this.wss.on('error', (error: any) => {
				console.error('❌ Unified WebSocket server error:', error);
			});

			// Log connection events
			this.wss.on('connection', (ws: any, req: IncomingMessage) => {
				console.log('🔗 WebSocket connection established via HTTP server:', req.url);
			});

			// Initialize our websocket service with the server
			websocketService.initialize(this.wss as any);

			this.isInitialized = true;
			console.log('✅ Unified HTTP+WebSocket server initialized successfully');
		} catch (error: any) {
			console.error('❌ Failed to initialize unified WebSocket server:', error);
		}
	}

	/**
	 * Handle HTTP upgrade requests to WebSocket
	 * This is called by the HTTP server when it receives an upgrade request
	 */
	public handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
		if (!this.wss) {
			console.error('❌ WebSocket server not initialized for upgrade request');
			socket.destroy();
			return;
		}

		// Check if the request is for our WebSocket path
		if (request.url === '/ws') {
			this.wss.handleUpgrade(request, socket, head, (ws) => {
				this.wss!.emit('connection', ws, request);
			});
		} else {
			// Not a WebSocket request, destroy the socket
			socket.destroy();
		}
	}

	/**
	 * Shutdown the unified server
	 */
	public shutdown(): void {
		if (this.wss) {
			console.log('🔌 Shutting down unified WebSocket server...');
			this.wss.close();
			websocketService.shutdown();
			this.isInitialized = false;
			this.wss = null;
			console.log('🔌 Unified WebSocket server shut down');
		}
	}

	/**
	 * Get the WebSocket server instance
	 */
	public getWebSocketServer(): WebSocketServer | null {
		return this.wss;
	}

	/**
	 * Check if the server is initialized
	 */
	public isReady(): boolean {
		return this.isInitialized && this.wss !== null;
	}
}

// Export singleton instance
export const unifiedWebSocketServer = new UnifiedWebSocketServer();
