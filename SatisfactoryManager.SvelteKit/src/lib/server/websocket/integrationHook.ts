import { initializeWebSocketServer } from './websocketInit.js';

/**
 * Integration hook for SvelteKit Node.js adapter
 * This module provides utilities to integrate WebSocket with the HTTP server
 */

/**
 * Initialize WebSocket integration with SvelteKit HTTP server
 * This should be called after the HTTP server is created by the Node.js adapter
 *
 * @param httpServer - The HTTP server instance from SvelteKit
 */
export function initializeWebSocketIntegration(httpServer: any): void {
	const isDev = process.env.NODE_ENV !== 'production';
	
	if (!isDev && httpServer) {
		console.log('🔗 Initializing WebSocket integration with SvelteKit HTTP server');

		// Add upgrade handler for WebSocket connections
		httpServer.on('upgrade', (request: any, socket: any, head: any) => {
			console.log('🔗 HTTP upgrade request received for:', request.url);

			if (request.url === '/ws') {
				// Let the unified WebSocket server handle the upgrade
				console.log('🔗 Handling WebSocket upgrade for /ws');
			} else {
				console.log('🔗 Unknown upgrade request, destroying socket');
				socket.destroy();
			}
		});

		// Initialize the unified WebSocket server
		initializeWebSocketServer(httpServer);

		console.log('✅ WebSocket integration with SvelteKit completed');
	} else if (isDev) {
		console.log('🔗 Development mode: WebSocket integration skipped (using Vite plugin)');
	} else {
		console.log('🔗 No HTTP server provided for WebSocket integration');
	}
}

/**
 * Initialize WebSocket integration - simplified and safe approach
 * Development: Handled by Vite plugin on same port as HTTP
 * Production: Handled by custom server wrapper on same port as HTTP
 */
export function autoInitializeWebSocketIntegration(): void {
	const isDev = process.env.NODE_ENV !== 'production';
	
	if (isDev) {
		// Development mode: WebSocket integration handled by Vite plugin
		console.log('🔗 Development mode: WebSocket handled by Vite plugin');
		initializeWebSocketServer();
		return;
	}

	// Production mode: WebSocket integration should be handled by custom server wrapper
	// This function is only called as fallback if custom server is not used
	console.log('⚠️  Production fallback: WebSocket should be handled by custom server wrapper');
	console.log('🔗 Using fallback standalone WebSocket server (this should not happen in normal deployment)...');
	
	try {
		initializeWebSocketServer();
		console.log('✅ Fallback WebSocket server initialized successfully');
	} catch (error: any) {
		console.error('❌ Failed to initialize fallback WebSocket server:', error);
	}
}
