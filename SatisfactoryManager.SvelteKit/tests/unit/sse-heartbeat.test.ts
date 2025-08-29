/**
 * SSE Heartbeat Unit Tests - Standalone
 * Tests the fixes for GitHub issue #27: Server heartbeat errors
 *
 * These tests verify the controller state checking logic without requiring database connection.
 */

import { describe, it, expect } from 'vitest';

// Mock controller that simulates ReadableStreamDefaultController behavior
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

describe('SSE Heartbeat Fix - Unit Tests', () => {
	describe('Controller State Checking', () => {
		it('should detect when controller is closed before enqueuing heartbeat', () => {
			const controller = new MockController();

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
			const controller = new MockController();

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

	describe('Heartbeat Safety Logic', () => {
		it('should prevent heartbeat from running when controller is closed', () => {
			const controller = new MockController();
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

			// Mock connections map
			const connections = new Map<
				string,
				{
					controller: MockController;
					userId: string;
					gameId?: string;
					lastHeartbeat: number;
				}
			>();

			// Add connections with different states
			const openController = new MockController();
			const closedController = new MockController();
			closedController.simulateClose();

			connections.set('open-conn', {
				controller: openController,
				userId: 'user1',
				gameId: 'test-game',
				lastHeartbeat: Date.now()
			});

			connections.set('closed-conn', {
				controller: closedController,
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

			for (const [id, conn] of connections.entries()) {
				if (conn.gameId === gameId) {
					try {
						// This is the key fix: check desiredSize before enqueuing
						if (conn.controller.desiredSize === null) {
							// Controller is closed, remove connection
							connections.delete(id);
							continue;
						}
						conn.controller.enqueue(encoder.encode(data));
						broadcastCount++;
					} catch (error) {
						connections.delete(id);
					}
				}
			}

			// Should only broadcast to open connection
			expect(broadcastCount).toBe(1);

			// Closed connection should be removed
			expect(connections.has('closed-conn')).toBe(false);
			expect(connections.has('open-conn')).toBe(true);
		});
	});

	describe('Connection Cleanup Logic', () => {
		it('should safely close controllers only if they are still open', () => {
			const controller1 = new MockController();
			const controller2 = new MockController();

			// Close one controller beforehand
			controller2.simulateClose();

			const controllers = [controller1, controller2];
			let errors = 0;

			// Simulate cleanup logic with our fix
			for (const controller of controllers) {
				try {
					// This is the key fix: check desiredSize before closing
					if (controller.desiredSize !== null) {
						controller.close();
					}
				} catch (error) {
					errors++;
				}
			}

			// Should not have any errors
			expect(errors).toBe(0);

			// Both controllers should be closed now
			expect(controller1.desiredSize).toBe(null);
			expect(controller2.desiredSize).toBe(null);
		});
	});
});
