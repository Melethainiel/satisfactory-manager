#!/usr/bin/env node

/**
 * Custom production server for unified HTTP + WebSocket on same port
 * This replaces the default SvelteKit Node.js adapter server
 * Handles both HTTP requests and WebSocket upgrades on the same port
 */

import { handler } from './build/handler.js';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function initializeServer() {
	console.log('🚀 Starting custom production server...');

	// Create HTTP server with SvelteKit handler
	const server = createServer(handler);

	// Create WebSocket server on the same HTTP server
	const wss = new WebSocketServer({ 
		server, 
		path: '/ws'
	});

	console.log('🔌 WebSocket server attached to HTTP server on /ws');

	// Basic WebSocket handling - for now just log connections
	wss.on('connection', (ws, req) => {
		console.log('🔗 WebSocket connection established:', req.url);
		
		// Send welcome message
		ws.send(JSON.stringify({
			type: 'connected',
			message: 'WebSocket connection established',
			timestamp: new Date().toISOString()
		}));
		
		// Handle messages
		ws.on('message', (data) => {
			try {
				const message = JSON.parse(data.toString());
				console.log('📨 Received WebSocket message:', message.type);
				
				// Echo back for testing
				ws.send(JSON.stringify({
					type: 'echo',
					data: message,
					timestamp: new Date().toISOString()
				}));
			} catch (error) {
				console.error('❌ Error parsing WebSocket message:', error);
			}
		});
		
		// Handle disconnection
		ws.on('close', () => {
			console.log('🔌 WebSocket connection closed');
		});
		
		// Handle errors
		ws.on('error', (error) => {
			console.error('❌ WebSocket error:', error);
		});
	});

	wss.on('error', (error) => {
		console.error('❌ WebSocket server error:', error);
	});

	console.log('✅ WebSocket server initialized successfully');

	// Start the server
	server.listen(PORT, HOST, () => {
		console.log(`🌐 Server running on http://${HOST}:${PORT}`);
		console.log(`🔌 WebSocket available on ws://${HOST}:${PORT}/ws`);
		console.log('✅ HTTP and WebSocket on unified port');
	});

	// Graceful shutdown handlers
	const gracefulShutdown = () => {
		console.log('🛑 Shutdown signal received, closing gracefully...');
		
		// Close WebSocket server
		wss.close(() => {
			console.log('✅ WebSocket server closed');
			
			// Close HTTP server after WebSocket server
			server.close(() => {
				console.log('✅ HTTP server closed');
				process.exit(0);
			});
		});
	};

	process.on('SIGTERM', gracefulShutdown);
	process.on('SIGINT', gracefulShutdown);
}

// Initialize and start the server
initializeServer().catch((error) => {
	console.error('❌ Failed to initialize server:', error);
	process.exit(1);
});