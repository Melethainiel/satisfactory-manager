import { WebSocketServer } from 'ws';
import { websocketService } from './websocketService.js';
import { unifiedWebSocketServer } from './unifiedServer.js';
import { dev } from '$app/environment';

let wsInitialized = false;
let wss: WebSocketServer | null = null;

/**
 * Initialize WebSocket server - different implementations for dev vs production
 * @param httpServer - Optional HTTP server for production unified mode
 */
export function initializeWebSocketServer(httpServer?: any): void {
	if (wsInitialized) {
		console.log('🔌 WebSocket server already initialized');
		return;
	}

	// Production mode: use unified HTTP+WebSocket server
	if (!dev && httpServer) {
		console.log('🔌 Initializing WebSocket in production mode (unified server)');
		unifiedWebSocketServer.initialize(httpServer);
		wsInitialized = true;
		return;
	}

	// Development mode: separate WebSocket server on port 8080
	if (dev) {
		try {
			console.log('🔌 Starting WebSocket server initialization in development mode...');

			// Create WebSocket server on port 8080 (separate from Vite)
			wss = new WebSocketServer({
				port: 8080,
				path: '/ws'
			});

			console.log('🔌 WebSocket server created on port 8080');

			// Handle server errors
			wss.on('error', (error: any) => {
				if (error.code === 'EADDRINUSE') {
					console.log('🔌 Port 8080 already in use, WebSocket server likely already running');
					wsInitialized = true; // Assume it's already working
				} else {
					console.error('❌ WebSocket server error:', error);
				}
			});

			// Test connection handler directly on the WebSocket server
			wss.on('connection', (ws, req) => {
				console.log('🔗 Direct connection event triggered!', req.url);
			});

			// Initialize our websocket service with the server
			websocketService.initialize(wss as any);

			wsInitialized = true;
			console.log('✅ WebSocket server initialized successfully on ws://localhost:8080/ws');
		} catch (error: any) {
			if (error.code === 'EADDRINUSE') {
				console.log('🔌 Port 8080 already in use, WebSocket server likely already running');
				wsInitialized = true; // Assume it's already working
			} else {
				console.error('❌ Failed to initialize WebSocket server:', error);
			}
		}
	} else {
		console.log(
			'🔌 WebSocket initialization skipped - not in development mode and no HTTP server provided'
		);
	}
}

export function shutdownWebSocketServer(): void {
	if (dev && wss) {
		// Development mode: shutdown separate WebSocket server
		wss.close();
		websocketService.shutdown();
		wsInitialized = false;
		console.log('🔌 Development WebSocket server shut down');
	} else if (!dev) {
		// Production mode: shutdown unified server
		unifiedWebSocketServer.shutdown();
		wsInitialized = false;
		console.log('🔌 Production unified server shut down');
	}
}
