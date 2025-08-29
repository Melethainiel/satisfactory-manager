import type { Plugin } from 'vite';
import type { ViteDevServer } from 'vite';
import { WebSocketServer } from 'ws';

/**
 * Simple Vite plugin for WebSocket development server
 * This version doesn't import any SvelteKit or database modules
 * to avoid build-time import issues with $app and $env modules
 */
export function devWebSocketPlugin(): Plugin {
	return {
		name: 'dev-websocket-plugin',
		configureServer(server: ViteDevServer) {
			if (server.httpServer) {
				console.log('🔌 Setting up development WebSocket on Vite server (port 5173)...');
				
				// Create WebSocket server attached to Vite's HTTP server
				const wss = new WebSocketServer({ 
					server: server.httpServer, 
					path: '/ws' 
				});

				// Basic connection handling for development
				wss.on('connection', (ws, req) => {
					console.log('🔗 Development WebSocket connection established:', req.url);
					
					// Send a basic auth success message for development
					ws.send(JSON.stringify({
						type: 'auth',
						timestamp: new Date().toISOString(),
						messageId: 'dev-auth',
						data: { success: true, user: { id: 'dev-user', name: 'Development User' } }
					}));

					// Handle basic ping/pong for development
					ws.on('message', (data) => {
						try {
							const message = JSON.parse(data.toString());
							
							if (message.type === 'ping') {
								ws.send(JSON.stringify({
									type: 'pong',
									timestamp: new Date().toISOString(),
									messageId: message.messageId || 'pong'
								}));
							} else if (message.type === 'auth') {
								// Respond to auth requests in development
								ws.send(JSON.stringify({
									type: 'auth',
									timestamp: new Date().toISOString(),
									messageId: message.messageId,
									data: { success: true, user: { id: 'dev-user', name: 'Development User' } }
								}));
							} else {
								console.log('📨 Development WebSocket message:', message.type);
								
								// Echo back success for development
								if (message.messageId) {
									ws.send(JSON.stringify({
										type: message.type,
										timestamp: new Date().toISOString(),
										messageId: message.messageId,
										data: { success: true }
									}));
								}
							}
						} catch (error) {
							console.error('❌ Error parsing WebSocket message in development:', error);
						}
					});

					ws.on('close', () => {
						console.log('🔌 Development WebSocket connection closed');
					});

					ws.on('error', (error) => {
						console.error('❌ Development WebSocket error:', error);
					});
				});

				wss.on('error', (error) => {
					console.error('❌ Development WebSocket server error:', error);
				});

				// Handle server close
				server.httpServer.on('close', () => {
					console.log('🔌 Shutting down development WebSocket server...');
					wss.close();
				});

				console.log('✅ Development WebSocket server configured on ws://localhost:5173/ws');
			} else {
				console.warn('⚠️  Vite HTTP server not available for WebSocket integration');
			}
		}
	};
}