#!/usr/bin/env node

/**
 * Custom production server for unified HTTP + WebSocket on same port
 * This replaces the default SvelteKit Node.js adapter server
 * Handles both HTTP requests and WebSocket upgrades on the same port
 */

import { handler } from './build/handler.js';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

// Import WebSocket service 
import { websocketService } from './build/server/chunks/websocketService.js';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

console.log('🚀 Starting custom production server...');

// Create HTTP server with SvelteKit handler
const server = createServer(handler);

// Create WebSocket server on the same HTTP server
const wss = new WebSocketServer({ 
	server, 
	path: '/ws' 
});

console.log('🔌 WebSocket server attached to HTTP server on /ws');

// Initialize our WebSocket service
try {
	websocketService.initialize(wss);
	console.log('✅ WebSocket service initialized successfully');
} catch (error) {
	console.error('❌ Failed to initialize WebSocket service:', error);
	console.log('⚠️  Server will continue without WebSocket functionality');
}

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
	console.log('🔗 WebSocket connection established:', req.url);
	// ws will be handled by websocketService
});

wss.on('error', (error) => {
	console.error('❌ WebSocket server error:', error);
});

// Start the server
server.listen(PORT, HOST, () => {
	console.log(`🌐 Server running on http://${HOST}:${PORT}`);
	console.log(`🔌 WebSocket available on ws://${HOST}:${PORT}/ws`);
	console.log('✅ HTTP and WebSocket on unified port');
});

// Graceful shutdown
process.on('SIGTERM', () => {
	console.log('🛑 SIGTERM received, shutting down gracefully...');
	
	server.close(() => {
		console.log('✅ HTTP server closed');
		
		wss.close(() => {
			console.log('✅ WebSocket server closed');
			process.exit(0);
		});
	});
});

process.on('SIGINT', () => {
	console.log('🛑 SIGINT received, shutting down gracefully...');
	
	server.close(() => {
		console.log('✅ HTTP server closed');
		
		wss.close(() => {
			console.log('✅ WebSocket server closed');
			process.exit(0);
		});
	});
});