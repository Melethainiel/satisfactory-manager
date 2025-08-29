import type { Plugin } from 'vite';
import type { ViteDevServer } from 'vite';
import { websocketService } from './websocketService.js';

export function websocketPlugin(): Plugin {
	return {
		name: 'websocket-plugin',
		configureServer(server: ViteDevServer) {
			if (server.httpServer) {
				// Initialize WebSocket server with the HTTP server
				websocketService.initialize(server.httpServer);

				console.log('🔌 WebSocket server plugin configured');

				// Handle server close
				server.httpServer.on('close', () => {
					websocketService.shutdown();
				});
			}
		},
		buildStart() {
			console.log('🔧 WebSocket plugin build started');
		}
	};
}
