import type { Plugin } from 'vite';
import type { ViteDevServer } from 'vite';
import { WebSocketServer } from 'ws';
import { websocketService } from './websocketService.js';

/**
 * Vite plugin for unified WebSocket development server
 * Integrates WebSocket directly into Vite's HTTP server (port 5173)
 */
export function websocketPlugin(): Plugin {
	return {
		name: 'unified-websocket-plugin',
		configureServer(server: ViteDevServer) {
			if (server.httpServer) {
				console.log('🔌 Configuring unified WebSocket on Vite server (port 5173)...');
				
				// Create WebSocket server attached to Vite's HTTP server
				const wss = new WebSocketServer({ 
					server: server.httpServer, 
					path: '/ws' 
				});

				// Initialize our websocket service
				try {
					websocketService.initialize(wss as any);
					console.log('✅ WebSocket service integrated with Vite server');
				} catch (error) {
					console.error('❌ Failed to initialize WebSocket service:', error);
				}

				// Log WebSocket connections
				wss.on('connection', (ws, req) => {
					console.log('🔗 Development WebSocket connection:', req.url);
				});

				wss.on('error', (error) => {
					console.error('❌ Development WebSocket error:', error);
				});

				// Handle server close
				server.httpServer.on('close', () => {
					console.log('🔌 Shutting down development WebSocket server...');
					wss.close();
					websocketService.shutdown();
				});

				console.log('🔌 WebSocket server configured on ws://localhost:5173/ws');
			} else {
				console.warn('⚠️  Vite HTTP server not available for WebSocket integration');
			}
		},
		buildStart() {
			console.log('🔧 Unified WebSocket plugin build started');
		}
	};
}
