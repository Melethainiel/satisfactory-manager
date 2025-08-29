import { WebSocketServer } from 'ws';
import { websocketService } from './websocketService.js';

let wsInitialized = false;
let wss: WebSocketServer | null = null;

/**
 * Initialize WebSocket server - used by Vite plugin for development mode only
 * For production, the custom server.js handles WebSocket integration directly
 * @param httpServer - Optional HTTP server (used by Vite plugin)
 */
export function initializeWebSocketServer(httpServer?: any): void {
	if (wsInitialized) {
		console.log('🔌 WebSocket server already initialized');
		return;
	}

	// This function is now only used by the Vite plugin in development mode
	// Production uses the custom server.js wrapper instead
	const isDev = process.env.NODE_ENV !== 'production';
	
	if (isDev) {
		// Use the provided HTTP server (from Vite plugin) instead of separate port
		if (httpServer) {
			console.log('🔌 Initializing WebSocket on Vite HTTP server (unified port)...');
			
			// Let the Vite plugin handle WebSocket server creation
			// This is just a placeholder - actual initialization happens in websocketPlugin.ts
			wsInitialized = true;
			console.log('✅ WebSocket initialization delegated to Vite plugin');
			return;
		}
		
		console.log('⚠️  No HTTP server provided to WebSocket initializer');
	} else {
		// Production mode: WebSocket should be handled by custom server.js wrapper
		console.log('🔌 Production mode: WebSocket integration should be handled by server.js');
		wsInitialized = true;
	}
}

export function shutdownWebSocketServer(): void {
	const isDev = process.env.NODE_ENV !== 'production';
	
	if (isDev && wss) {
		// Development mode: shutdown WebSocket server
		wss.close();
		websocketService.shutdown();
		wsInitialized = false;
		console.log('🔌 Development WebSocket server shut down');
	} else {
		// Production mode: shutdown handled by server.js
		console.log('🔌 Production mode: shutdown handled by server.js');
		wsInitialized = false;
	}
}
