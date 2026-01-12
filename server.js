#!/usr/bin/env node

/**
 * Custom production server for SvelteKit with SSE support
 * This replaces the default SvelteKit Node.js adapter server
 * Handles HTTP requests and Server-Sent Events
 */

import { handler } from './build/handler.js';
import { createServer } from 'http';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function initializeServer() {
	console.log('🚀 Starting production server with SSE support...');

	// Create HTTP server with SvelteKit handler
	const server = createServer(handler);

	// Start the server
	server.listen(PORT, HOST, () => {
		console.log(`🌐 Server running on http://${HOST}:${PORT}`);
		console.log('✅ HTTP server with SSE support started');
	});

	// Graceful shutdown handlers
	const gracefulShutdown = () => {
		console.log('🛑 Shutdown signal received, closing gracefully...');

		server.close(() => {
			console.log('✅ HTTP server closed');
			process.exit(0);
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
