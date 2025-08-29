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

	// In production, check if we should use integrated or standalone WebSocket server
	const useIntegratedWebSocket = process.env.USE_INTEGRATED_WEBSOCKET === 'true' || 
									process.env.NODE_ENV === 'production';
	
	if (useIntegratedWebSocket) {
		console.log('🔗 Production mode: attempting to integrate WebSocket with HTTP server...');
		
		// Try to hook into the HTTP server creation process
		// This is a hack to access the SvelteKit Node.js adapter server
		const originalCreateServer = require('http').createServer;
		require('http').createServer = function(...args: any[]) {
			const server = originalCreateServer.apply(this, args);
			
			// Initialize WebSocket on this HTTP server after a short delay
			setTimeout(() => {
				console.log('🔌 HTTP server detected, initializing integrated WebSocket...');
				try {
					initializeWebSocketServer(server);
					console.log('✅ WebSocket server integrated with HTTP server');
				} catch (error) {
					console.error('❌ Failed to integrate WebSocket, falling back to standalone:', error);
					initializeWebSocketServer(); // Fallback to standalone
				}
			}, 2000);
			
			return server;
		};
		
		console.log('🔗 HTTP server hook installed, waiting for server creation...');
	} else {
		// Fallback to standalone WebSocket server
		console.log('🔗 Initializing standalone WebSocket server for production...');
		try {
			const wsPort = process.env.WEBSOCKET_PORT ? parseInt(process.env.WEBSOCKET_PORT) : 8080;
			console.log(`🔌 Starting production WebSocket server on port ${wsPort}...`);
			
			initializeWebSocketServer();
			console.log('✅ Production WebSocket server initialized successfully');
		} catch (error: any) {
			console.error('❌ Failed to initialize production WebSocket server:', error);
		}
	}
}
