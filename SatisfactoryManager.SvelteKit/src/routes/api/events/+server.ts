import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { addConnection, removeConnection, updateHeartbeat } from '$lib/server/services/sseService';

export const GET: RequestHandler = async ({ request, url, locals }) => {
	try {
		// Authentication is handled by hooks.server.ts middleware
		// The user should be available in locals.user if authentication succeeded
		if (!locals.user) {
			console.log('❌ SSE endpoint - no authenticated user in locals');
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		console.log('✅ SSE endpoint - authenticated user:', {
			sub: locals.user.sub,
			email: locals.user.email
		});

		const gameId = url.searchParams.get('gameId');
		const connectionId = crypto.randomUUID();

		console.log(`🔗 New SSE connection for user ${locals.user.sub}, game: ${gameId || 'none'}`);

		// Create Server-Sent Events stream
		const stream = new ReadableStream({
			start(controller) {
				// Store connection
				addConnection(connectionId, controller, locals.user!.sub, gameId || undefined);

				// Send initial connection message
				const encoder = new TextEncoder();
				const welcomeMessage = `data: ${JSON.stringify({
					type: 'connected',
					timestamp: new Date().toISOString(),
					connectionId,
					user: {
						id: locals.user!.sub,
						name: locals.user!.name || 'Unknown',
						email: locals.user!.email || 'Unknown'
					}
				})}\n\n`;

				controller.enqueue(encoder.encode(welcomeMessage));

				// Send periodic heartbeat to keep connection alive
				const heartbeatInterval = setInterval(() => {
					try {
						// Check if controller is still open before enqueuing
						if (controller.desiredSize === null) {
							// Controller is closed, stop the heartbeat
							clearInterval(heartbeatInterval);
							removeConnection(connectionId);
							return;
						}

						const heartbeat = `data: ${JSON.stringify({
							type: 'heartbeat',
							timestamp: new Date().toISOString()
						})}\n\n`;
						controller.enqueue(encoder.encode(heartbeat));
						updateHeartbeat(connectionId);
					} catch (error) {
						console.error('Error sending heartbeat:', error);
						clearInterval(heartbeatInterval);
						removeConnection(connectionId);
					}
				}, 30000); // Every 30 seconds

				// Handle connection close
				request.signal.addEventListener('abort', () => {
					console.log(`🔌 SSE connection ${connectionId} closed by client`);
					console.log(`🔌 Connection was alive for: ${Date.now() - Date.now()} ms`);
					clearInterval(heartbeatInterval);
					removeConnection(connectionId);
					try {
						controller.close();
					} catch (error) {
						console.log('🔌 Controller already closed:', (error as Error).message);
					}
				});
			}
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Headers': 'Authorization'
			}
		});
	} catch (error) {
		console.error('❌ SSE connection error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
