import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST } from '../../../src/routes/api/games/[id]/sites/+server';
import {
	GET as GETById,
	PATCH,
	DELETE
} from '../../../src/routes/api/games/[id]/sites/[siteId]/+server';
import { testUsers, testGames } from '../../setup/fixtures';
import { getTestDb } from '../../setup/test-db';
import { users, games, userGames, sites } from '../../../src/lib/server/db/schema';
import { eq } from 'drizzle-orm';

describe('/api/games/[id]/sites', () => {
	let testUserId: string;
	let testGameId: string;
	let testSiteId: string;

	beforeEach(async () => {
		const db = getTestDb();

		// Create test user
		const [user] = await db.insert(users).values(testUsers[0]).returning();
		testUserId = user.id;

		// Create test game
		const [game] = await db.insert(games).values(testGames[0]).returning();
		testGameId = game.id;

		// Link user to game as Owner
		await db.insert(userGames).values({
			userId: testUserId,
			gameId: testGameId,
			role: 'Owner'
		});

		// Create a test site
		const [site] = await db
			.insert(sites)
			.values({
				name: 'Test Site',
				gameId: testGameId
			})
			.returning();
		testSiteId = site.id;
	});

	describe('GET /api/games/[id]/sites', () => {
		it('should return all sites for a game', async () => {
			const request = new Request(`http://localhost/api/games/${testGameId}/sites`);
			const response = await GET({
				request,
				params: { id: testGameId },
				url: new URL(request.url)
			} as any);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(Array.isArray(data)).toBe(true);
			expect(data.length).toBeGreaterThan(0);
			expect(data[0]).toHaveProperty('id');
			expect(data[0]).toHaveProperty('name');
			expect(data[0]).toHaveProperty('gameId');
			expect(data[0]).toHaveProperty('createdAt');
			expect(data[0]).toHaveProperty('updatedAt');
			expect(data[0].gameId).toBe(testGameId);
		});

		it('should return empty array for game with no sites', async () => {
			const db = getTestDb();

			// Create a new game with no sites
			const [newGame] = await db.insert(games).values({ name: 'Empty Game' }).returning();

			const request = new Request(`http://localhost/api/games/${newGame.id}/sites`);
			const response = await GET({
				request,
				params: { id: newGame.id },
				url: new URL(request.url)
			} as any);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(Array.isArray(data)).toBe(true);
			expect(data.length).toBe(0);
		});

		it('should return 404 for non-existent game', async () => {
			const fakeGameId = '00000000-0000-0000-0000-000000000000';
			const request = new Request(`http://localhost/api/games/${fakeGameId}/sites`);
			const response = await GET({
				request,
				params: { id: fakeGameId },
				url: new URL(request.url)
			} as any);

			expect(response.status).toBe(404);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Game not found');
		});

		it('should return 400 when game ID is missing', async () => {
			const request = new Request('http://localhost/api/games//sites');
			const response = await GET({
				request,
				params: { id: '' },
				url: new URL(request.url)
			} as any);

			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Game ID is required');
		});
	});

	describe('POST /api/games/[id]/sites', () => {
		it('should create a new site with Contributor role', async () => {
			const db = getTestDb();

			// Create a contributor user
			const [contributor] = await db
				.insert(users)
				.values({
					displayName: 'Contributor User',
					email: 'contributor@example.com'
				})
				.returning();

			await db.insert(userGames).values({
				userId: contributor.id,
				gameId: testGameId,
				role: 'Contributor'
			});

			const siteData = {
				name: 'New Factory Site'
			};

			const request = new Request(`http://localhost/api/games/${testGameId}/sites`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(siteData)
			});

			const response = await POST({
				request,
				params: { id: testGameId },
				locals: { user: { email: 'contributor@example.com' } }
			} as any);

			expect(response.status).toBe(201);

			const data = await response.json();
			expect(data).toHaveProperty('id');
			expect(data.name).toBe(siteData.name);
			expect(data.gameId).toBe(testGameId);

			// Check Location header
			expect(response.headers.get('Location')).toBe(`/api/games/${testGameId}/sites/${data.id}`);
		});

		it('should create a new site with Administrator role', async () => {
			const db = getTestDb();

			// Create an administrator user
			const [admin] = await db
				.insert(users)
				.values({
					displayName: 'Admin User',
					email: 'admin@example.com'
				})
				.returning();

			await db.insert(userGames).values({
				userId: admin.id,
				gameId: testGameId,
				role: 'Administrator'
			});

			const siteData = {
				name: 'Admin Site'
			};

			const request = new Request(`http://localhost/api/games/${testGameId}/sites`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(siteData)
			});

			const response = await POST({
				request,
				params: { id: testGameId },
				locals: { user: { email: 'admin@example.com' } }
			} as any);

			expect(response.status).toBe(201);

			const data = await response.json();
			expect(data).toHaveProperty('id');
			expect(data.name).toBe(siteData.name);
		});

		it('should create a new site with Owner role', async () => {
			const siteData = {
				name: 'Owner Site'
			};

			const request = new Request(`http://localhost/api/games/${testGameId}/sites`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(siteData)
			});

			const response = await POST({
				request,
				params: { id: testGameId },
				locals: { user: { email: testUsers[0].email } }
			} as any);

			expect(response.status).toBe(201);

			const data = await response.json();
			expect(data).toHaveProperty('id');
			expect(data.name).toBe(siteData.name);
		});

		it('should return 403 for Reader role', async () => {
			const db = getTestDb();

			// Create a reader user
			const [reader] = await db
				.insert(users)
				.values({
					displayName: 'Reader User',
					email: 'reader@example.com'
				})
				.returning();

			await db.insert(userGames).values({
				userId: reader.id,
				gameId: testGameId,
				role: 'Reader'
			});

			const siteData = {
				name: 'Reader Attempt Site'
			};

			const request = new Request(`http://localhost/api/games/${testGameId}/sites`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(siteData)
			});

			const response = await POST({
				request,
				params: { id: testGameId },
				locals: { user: { email: 'reader@example.com' } }
			} as any);

			expect(response.status).toBe(403);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Forbidden');
		});

		it('should return 401 for unauthorized users', async () => {
			const siteData = {
				name: 'Unauthorized Site'
			};

			const request = new Request(`http://localhost/api/games/${testGameId}/sites`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(siteData)
			});

			const response = await POST({
				request,
				params: { id: testGameId },
				locals: { user: { email: 'nonexistent@example.com' } }
			} as any);

			expect(response.status).toBe(401);
		});

		it('should return 400 when name is missing', async () => {
			const siteData = {};

			const request = new Request(`http://localhost/api/games/${testGameId}/sites`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(siteData)
			});

			const response = await POST({
				request,
				params: { id: testGameId },
				locals: { user: { email: testUsers[0].email } }
			} as any);

			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Site name is required');
		});

		it('should return 400 when name is too long', async () => {
			const siteData = {
				name: 'A'.repeat(201) // Exceeds 200 character limit
			};

			const request = new Request(`http://localhost/api/games/${testGameId}/sites`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(siteData)
			});

			const response = await POST({
				request,
				params: { id: testGameId },
				locals: { user: { email: testUsers[0].email } }
			} as any);

			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Site name cannot exceed 200 characters');
		});

		it('should return 404 for non-existent game', async () => {
			const fakeGameId = '00000000-0000-0000-0000-000000000000';
			const siteData = {
				name: 'Test Site'
			};

			const request = new Request(`http://localhost/api/games/${fakeGameId}/sites`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(siteData)
			});

			const response = await POST({
				request,
				params: { id: fakeGameId },
				locals: { user: { email: testUsers[0].email } }
			} as any);

			expect(response.status).toBe(404);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Game not found');
		});

		it('should return 400 with invalid JSON body', async () => {
			const request = new Request(`http://localhost/api/games/${testGameId}/sites`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: 'invalid json'
			});

			const response = await POST({
				request,
				params: { id: testGameId },
				locals: { user: { email: testUsers[0].email } }
			} as any);

			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Invalid JSON body');
		});
	});

	describe('GET /api/games/[id]/sites/[siteId]', () => {
		it('should return a specific site', async () => {
			const request = new Request(`http://localhost/api/games/${testGameId}/sites/${testSiteId}`);
			const response = await GETById({
				request,
				params: { id: testGameId, siteId: testSiteId },
				url: new URL(request.url)
			} as any);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.id).toBe(testSiteId);
			expect(data.gameId).toBe(testGameId);
			expect(data).toHaveProperty('name');
			expect(data).toHaveProperty('createdAt');
			expect(data).toHaveProperty('updatedAt');
		});

		it('should return 404 for non-existent site', async () => {
			const fakeSiteId = '00000000-0000-0000-0000-000000000000';
			const request = new Request(`http://localhost/api/games/${testGameId}/sites/${fakeSiteId}`);
			const response = await GETById({
				request,
				params: { id: testGameId, siteId: fakeSiteId },
				url: new URL(request.url)
			} as any);

			expect(response.status).toBe(404);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Site not found');
		});

		it('should return 404 when site belongs to different game', async () => {
			const db = getTestDb();

			// Create another game and site
			const [otherGame] = await db.insert(games).values({ name: 'Other Game' }).returning();

			const [otherSite] = await db
				.insert(sites)
				.values({
					name: 'Other Site',
					gameId: otherGame.id
				})
				.returning();

			const request = new Request(`http://localhost/api/games/${testGameId}/sites/${otherSite.id}`);
			const response = await GETById({
				request,
				params: { id: testGameId, siteId: otherSite.id },
				url: new URL(request.url)
			} as any);

			expect(response.status).toBe(404);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Site not found in this game');
		});

		it('should return 404 for non-existent game', async () => {
			const fakeGameId = '00000000-0000-0000-0000-000000000000';
			const request = new Request(`http://localhost/api/games/${fakeGameId}/sites/${testSiteId}`);
			const response = await GETById({
				request,
				params: { id: fakeGameId, siteId: testSiteId },
				url: new URL(request.url)
			} as any);

			expect(response.status).toBe(404);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Game not found');
		});
	});

	describe('PATCH /api/games/[id]/sites/[siteId]', () => {
		it('should update site with Contributor role', async () => {
			const db = getTestDb();

			// Create a contributor user
			const [contributor] = await db
				.insert(users)
				.values({
					displayName: 'Contributor User',
					email: 'contributor@example.com'
				})
				.returning();

			await db.insert(userGames).values({
				userId: contributor.id,
				gameId: testGameId,
				role: 'Contributor'
			});

			const updateData = {
				name: 'Updated Site Name'
			};

			const request = new Request(`http://localhost/api/games/${testGameId}/sites/${testSiteId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updateData)
			});

			const response = await PATCH({
				request,
				params: { id: testGameId, siteId: testSiteId },
				locals: { user: { email: 'contributor@example.com' } }
			} as any);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.id).toBe(testSiteId);
			expect(data.name).toBe(updateData.name);
			expect(data.gameId).toBe(testGameId);
		});

		it('should return 403 for Reader role', async () => {
			const db = getTestDb();

			// Create a reader user
			const [reader] = await db
				.insert(users)
				.values({
					displayName: 'Reader User',
					email: 'reader@example.com'
				})
				.returning();

			await db.insert(userGames).values({
				userId: reader.id,
				gameId: testGameId,
				role: 'Reader'
			});

			const updateData = {
				name: 'Reader Update Attempt'
			};

			const request = new Request(`http://localhost/api/games/${testGameId}/sites/${testSiteId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updateData)
			});

			const response = await PATCH({
				request,
				params: { id: testGameId, siteId: testSiteId },
				locals: { user: { email: 'reader@example.com' } }
			} as any);

			expect(response.status).toBe(403);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Forbidden');
		});

		it('should return 404 for non-existent site', async () => {
			const fakeSiteId = '00000000-0000-0000-0000-000000000000';
			const updateData = {
				name: 'Non-existent Site Update'
			};

			const request = new Request(`http://localhost/api/games/${testGameId}/sites/${fakeSiteId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updateData)
			});

			const response = await PATCH({
				request,
				params: { id: testGameId, siteId: fakeSiteId },
				locals: { user: { email: testUsers[0].email } }
			} as any);

			expect(response.status).toBe(404);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Site not found');
		});

		it('should return 400 when name is missing', async () => {
			const updateData = {};

			const request = new Request(`http://localhost/api/games/${testGameId}/sites/${testSiteId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updateData)
			});

			const response = await PATCH({
				request,
				params: { id: testGameId, siteId: testSiteId },
				locals: { user: { email: testUsers[0].email } }
			} as any);

			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Site name is required');
		});
	});

	describe('DELETE /api/games/[id]/sites/[siteId]', () => {
		it('should delete site with Contributor role', async () => {
			const db = getTestDb();

			// Create a contributor user
			const [contributor] = await db
				.insert(users)
				.values({
					displayName: 'Contributor User',
					email: 'contributor@example.com'
				})
				.returning();

			await db.insert(userGames).values({
				userId: contributor.id,
				gameId: testGameId,
				role: 'Contributor'
			});

			const request = new Request(`http://localhost/api/games/${testGameId}/sites/${testSiteId}`, {
				method: 'DELETE'
			});

			const response = await DELETE({
				request,
				params: { id: testGameId, siteId: testSiteId },
				locals: { user: { email: 'contributor@example.com' } }
			} as any);

			expect(response.status).toBe(204);

			// Verify site is deleted
			const deletedSite = await db.select().from(sites).where(eq(sites.id, testSiteId));

			expect(deletedSite.length).toBe(0);
		});

		it('should return 403 for Reader role', async () => {
			const db = getTestDb();

			// Create a reader user
			const [reader] = await db
				.insert(users)
				.values({
					displayName: 'Reader User',
					email: 'reader@example.com'
				})
				.returning();

			await db.insert(userGames).values({
				userId: reader.id,
				gameId: testGameId,
				role: 'Reader'
			});

			const request = new Request(`http://localhost/api/games/${testGameId}/sites/${testSiteId}`, {
				method: 'DELETE'
			});

			const response = await DELETE({
				request,
				params: { id: testGameId, siteId: testSiteId },
				locals: { user: { email: 'reader@example.com' } }
			} as any);

			expect(response.status).toBe(403);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Forbidden');
		});

		it('should return 404 for non-existent site', async () => {
			const fakeSiteId = '00000000-0000-0000-0000-000000000000';

			const request = new Request(`http://localhost/api/games/${testGameId}/sites/${fakeSiteId}`, {
				method: 'DELETE'
			});

			const response = await DELETE({
				request,
				params: { id: testGameId, siteId: fakeSiteId },
				locals: { user: { email: testUsers[0].email } }
			} as any);

			expect(response.status).toBe(404);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Site not found');
		});
	});

	describe('Edge Cases and Performance', () => {
		it('should handle many sites efficiently', async () => {
			const db = getTestDb();

			// Create many sites
			const siteCount = 50;
			const bulkSites = Array.from({ length: siteCount }, (_, i) => ({
				name: `Bulk Site ${i}`,
				gameId: testGameId
			}));

			const startTime = Date.now();
			await db.insert(sites).values(bulkSites);
			const insertTime = Date.now() - startTime;

			expect(insertTime).toBeLessThan(2000); // Should be fast

			// Test querying all sites
			const queryStartTime = Date.now();
			const request = new Request(`http://localhost/api/games/${testGameId}/sites`);
			const response = await GET({
				request,
				params: { id: testGameId },
				url: new URL(request.url)
			} as any);
			const queryTime = Date.now() - queryStartTime;

			expect(response.status).toBe(200);
			expect(queryTime).toBeLessThan(1000); // Should be fast

			const data = await response.json();
			expect(data.length).toBeGreaterThanOrEqual(siteCount);
		});

		it('should handle long site names at boundary', async () => {
			const exactLimitName = 'A'.repeat(200); // Exactly 200 characters

			const siteData = {
				name: exactLimitName
			};

			const request = new Request(`http://localhost/api/games/${testGameId}/sites`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(siteData)
			});

			const response = await POST({
				request,
				params: { id: testGameId },
				locals: { user: { email: testUsers[0].email } }
			} as any);

			expect(response.status).toBe(201);

			const data = await response.json();
			expect(data.name).toBe(exactLimitName);
			expect(data.name.length).toBe(200);
		});

		it('should handle empty string name validation', async () => {
			const siteData = {
				name: '   ' // Only whitespace
			};

			const request = new Request(`http://localhost/api/games/${testGameId}/sites`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(siteData)
			});

			const response = await POST({
				request,
				params: { id: testGameId },
				locals: { user: { email: testUsers[0].email } }
			} as any);

			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Site name is required');
		});

		it('should trim whitespace from site names', async () => {
			const siteData = {
				name: '   Trimmed Site Name   '
			};

			const request = new Request(`http://localhost/api/games/${testGameId}/sites`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(siteData)
			});

			const response = await POST({
				request,
				params: { id: testGameId },
				locals: { user: { email: testUsers[0].email } }
			} as any);

			expect(response.status).toBe(201);

			const data = await response.json();
			expect(data.name).toBe('Trimmed Site Name');
		});
	});

	describe('Authorization Edge Cases', () => {
		it('should handle user not in game', async () => {
			const db = getTestDb();

			// Create a user not associated with the game
			const [outsider] = await db
				.insert(users)
				.values({
					displayName: 'Outsider User',
					email: 'outsider@example.com'
				})
				.returning();

			const siteData = {
				name: 'Unauthorized Site'
			};

			const request = new Request(`http://localhost/api/games/${testGameId}/sites`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(siteData)
			});

			const response = await POST({
				request,
				params: { id: testGameId },
				locals: { user: { email: 'outsider@example.com' } }
			} as any);

			expect(response.status).toBe(403);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Forbidden');
		});

		it('should handle missing authorization header', async () => {
			const siteData = {
				name: 'No Auth Site'
			};

			const request = new Request(`http://localhost/api/games/${testGameId}/sites`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(siteData)
			});

			const response = await POST({
				request,
				params: { id: testGameId },
				locals: {} // No user in locals
			} as any);

			expect(response.status).toBe(401);
		});
	});
});
