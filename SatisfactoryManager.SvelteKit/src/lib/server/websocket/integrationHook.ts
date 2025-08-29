import { initializeWebSocketServer } from './websocketInit.js';
import { dev } from '$app/environment';

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
	if (!dev && httpServer) {
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
	} else if (dev) {
		console.log('🔗 Development mode: WebSocket integration skipped (using separate server)');
	} else {
		console.log('🔗 No HTTP server provided for WebSocket integration');
	}
}

/**
 * Auto-detect SvelteKit HTTP server and initialize WebSocket integration
 * This is a helper function that tries to hook into the server creation process
 */
export function autoInitializeWebSocketIntegration(): void {
	if (dev) {
		// In development, use the regular WebSocket initialization
		initializeWebSocketServer();
		return;
	}

	// In production, we need to wait for the HTTP server to be created
	// This will be called from the application startup
	console.log('🔗 Auto-initialization for WebSocket integration ready');
}
