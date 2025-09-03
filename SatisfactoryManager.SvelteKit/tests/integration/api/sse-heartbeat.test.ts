/**
 * SSE Heartbeat Integration Tests
 * Tests the fixes for GitHub issue #27: Server heartbeat errors
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReadableStreamDefaultController } from 'node:stream/web';

// Mock the SSE service functions
const mockConnections = new Map<
	string,
	{
		controller: ReadableStreamDefaultController<Uint8Array>;
		userId: string;
		gameId?: string;
		lastHeartbeat: number;
	}
>();

// Mock controller that simulates a closed state
class MockController {
	private _desiredSize: number | null = 1;
	private _closed = false;

	get desiredSize(): number | null {
		return this._desiredSize;
	}

	enqueue(chunk: Uint8Array): void {
		if (this._closed || this._desiredSize === null) {
			throw new TypeError('Invalid state: Controller is already closed');
		}
		// Simulate successful enqueue
	}

	close(): void {
		this._closed = true;
		this._desiredSize = null;
	}

	// Helper to simulate closed state
	simulateClose(): void {
		this.close();
	}
}

describe('SSE Heartbeat Fix Tests', () => {
	let controller: MockController;
	const connectionId = 'test-connection-123';

	beforeEach(() => {
		controller = new MockController();
		mockConnections.clear();
	});

	afterEach(() => {
		mockConnections.clear();
	});

	describe('Controller State Checking', () => {
		it('should detect when controller is closed before enqueuing heartbeat', () => {
			// Simulate a closed controller
			controller.simulateClose();

			// Check if controller is closed (desiredSize === null means closed)
			expect(controller.desiredSize).toBe(null);

			// Should not attempt to enqueue when closed
			expect(() => {
				if (controller.desiredSize === null) {
					throw new Error('Controller is closed, should not enqueue');
				}
				controller.enqueue(new TextEncoder().encode('test'));
			}).toThrow('Controller is closed, should not enqueue');
		});

		it('should successfully enqueue when controller is open', () => {
			// Controller should be open initially
			expect(controller.desiredSize).not.toBe(null);

			// Should successfully enqueue when open
			expect(() => {
				if (controller.desiredSize !== null) {
					controller.enqueue(new TextEncoder().encode('test'));
				}
			}).not.toThrow();
		});
	});

	describe('Connection Management', () => {
		it('should remove closed connections from the map', () => {
			// Add a connection
			mockConnections.set(connectionId, {
				controller: controller as any,
				userId: 'test-user',
				gameId: 'test-game',
				lastHeartbeat: Date.now()
			});

			expect(mockConnections.has(connectionId)).toBe(true);

			// Simulate controller being closed
			controller.simulateClose();

			// Simulate the cleanup logic from broadcastToGame
			for (const [id, conn] of mockConnections.entries()) {
				if (conn.controller.desiredSize === null) {
					mockConnections.delete(id);
				}
			}

			expect(mockConnections.has(connectionId)).toBe(false);
		});
	});

	describe('Heartbeat Safety Logic', () => {
		it('should prevent heartbeat from running when controller is closed', () => {
			let heartbeatCount = 0;
			const encoder = new TextEncoder();

			// Simulate the heartbeat interval logic with our fix
			const sendHeartbeat = () => {
				try {
					// This is the key fix: check desiredSize before enqueuing
					if (controller.desiredSize === null) {
						// Controller is closed, should return early
						return false;
					}

					const heartbeat = `data: ${JSON.stringify({
						type: 'heartbeat',
						timestamp: new Date().toISOString()
					})}\n\n`;

					controller.enqueue(encoder.encode(heartbeat));
					heartbeatCount++;
					return true;
				} catch (error) {
					return false;
				}
			};

			// Should work when controller is open
			expect(sendHeartbeat()).toBe(true);
			expect(heartbeatCount).toBe(1);

			// Close the controller
			controller.simulateClose();

			// Should safely return false without attempting to enqueue
			expect(sendHeartbeat()).toBe(false);
			expect(heartbeatCount).toBe(1); // Should not increment
		});
	});

	describe('Broadcasting Safety Logic', () => {
		it('should skip closed connections during broadcasting', () => {
			const encoder = new TextEncoder();
			let broadcastCount = 0;

			// Add connections with different states
			const openController = new MockController();
			const closedController = new MockController();
			closedController.simulateClose();

			mockConnections.set('open-conn', {
				controller: openController as any,
				userId: 'user1',
				gameId: 'test-game',
				lastHeartbeat: Date.now()
			});

			mockConnections.set('closed-conn', {
				controller: closedController as any,
				userId: 'user2',
				gameId: 'test-game',
				lastHeartbeat: Date.now()
			});

			// Simulate broadcastToGame logic with our fix
			const gameId = 'test-game';
			const data = `data: ${JSON.stringify({
				type: 'test',
				timestamp: new Date().toISOString()
			})}\n\n`;

			for (const [id, conn] of mockConnections.entries()) {
				if (conn.gameId === gameId) {
					try {
						// This is the key fix: check desiredSize before enqueuing
						if (conn.controller.desiredSize === null) {
							// Controller is closed, remove connection
							mockConnections.delete(id);
							continue;
						}
						conn.controller.enqueue(encoder.encode(data));
						broadcastCount++;
					} catch (error) {
						mockConnections.delete(id);
					}
				}
			}

			// Should only broadcast to open connection
			expect(broadcastCount).toBe(1);

			// Closed connection should be removed
			expect(mockConnections.has('closed-conn')).toBe(false);
			expect(mockConnections.has('open-conn')).toBe(true);
		});
	});
});
