import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST } from '../../../src/routes/api/games/+server';
import { GET as GETById, PUT, DELETE } from '../../../src/routes/api/games/[id]/+server';
import { GET as GETUsers, POST as POSTUser, DELETE as DELETEUser } from '../../../src/routes/api/games/[id]/users/+server';
import { testUsers, testGames } from '../../setup/fixtures';
import { getTestDb } from '../../setup/test-db';
import { users, games, userGames } from '../../../src/lib/server/db/schema';

describe('/api/games', () => {
	let testUserId: string;
	let testGameId: string;

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
	});

	describe('GET /api/games', () => {
		it('should return games for user email', async () => {
			const url = new URL('http://localhost/api/games');
			url.searchParams.set('email', testUsers[0].email);

			const request = new Request(url.toString());
			const response = await GET({ request, url } as any);

			expect(response.status).toBe(200);
			
			const data = await response.json();
			expect(Array.isArray(data)).toBe(true);
			expect(data.length).toBeGreaterThan(0);
			expect(data[0]).toHaveProperty('id');
			expect(data[0]).toHaveProperty('name');
			expect(data[0]).toHaveProperty('role');
		});

		it('should return 400 when email parameter is missing', async () => {
			const url = new URL('http://localhost/api/games');
			const request = new Request(url.toString());
			const response = await GET({ request, url } as any);

			expect(response.status).toBe(400);
			
			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Email query parameter is required');
		});

		it('should return empty array for non-existent user', async () => {
			const url = new URL('http://localhost/api/games');
			url.searchParams.set('email', 'nonexistent@example.com');

			const request = new Request(url.toString());
			const response = await GET({ request, url } as any);

			expect(response.status).toBe(200);
			
			const data = await response.json();
			expect(Array.isArray(data)).toBe(true);
			expect(data.length).toBe(0);
		});
	});

	describe('POST /api/games', () => {
		it('should create a new game with valid data', async () => {
			const gameData = {
				email: testUsers[0].email,
				name: 'New Test Game'
			};

			const request = new Request('http://localhost/api/games', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(gameData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(201);
			
			const data = await response.json();
			expect(data).toHaveProperty('id');
			expect(data.name).toBe(gameData.name);

			// Check Location header
			expect(response.headers.get('Location')).toBe(`/api/games/${data.id}`);
		});

		it('should return 400 when email is missing', async () => {
			const gameData = {
				name: 'Test Game'
			};

			const request = new Request('http://localhost/api/games', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(gameData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(400);
			
			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Email and name are required');
		});

		it('should return 400 when name is missing', async () => {
			const gameData = {
				email: testUsers[0].email
			};

			const request = new Request('http://localhost/api/games', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(gameData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(400);
			
			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Email and name are required');
		});

		it('should return 404 when user does not exist', async () => {
			const gameData = {
				email: 'nonexistent@example.com',
				name: 'Test Game'
			};

			const request = new Request('http://localhost/api/games', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(gameData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(404);
			
			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('User not found');
		});
	});

	describe('GET /api/games/[id]', () => {
		it('should return game by id', async () => {
			const request = new Request(`http://localhost/api/games/${testGameId}`);
			const response = await GETById({ 
				request, 
				params: { id: testGameId },
				url: new URL(request.url)
			} as any);

			expect(response.status).toBe(200);
			
			const data = await response.json();
			expect(data.id).toBe(testGameId);
			expect(data.name).toBe(testGames[0].name);
		});

		it('should return 404 for non-existent game', async () => {
			const fakeId = '00000000-0000-0000-0000-000000000000';
			const request = new Request(`http://localhost/api/games/${fakeId}`);
			const response = await GETById({ 
				request, 
				params: { id: fakeId },
				url: new URL(request.url)
			} as any);

			expect(response.status).toBe(404);
		});
	});

	describe('PUT /api/games/[id]', () => {
		it('should update game with valid data', async () => {
			const updateData = {
				name: 'Updated Game Name'
			};

			const request = new Request(`http://localhost/api/games/${testGameId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updateData)
			});

			const response = await PUT({ 
				request, 
				params: { id: testGameId }
			} as any);

			expect(response.status).toBe(200);
			
			const data = await response.json();
			expect(data.id).toBe(testGameId);
			expect(data.name).toBe(updateData.name);
		});

		it('should return 404 for non-existent game', async () => {
			const fakeId = '00000000-0000-0000-0000-000000000000';
			const updateData = {
				name: 'Updated Game Name'
			};

			const request = new Request(`http://localhost/api/games/${fakeId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updateData)
			});

			const response = await PUT({ 
				request, 
				params: { id: fakeId }
			} as any);

			expect(response.status).toBe(404);
		});
	});

	describe('DELETE /api/games/[id]', () => {
		it('should delete game successfully', async () => {
			const request = new Request(`http://localhost/api/games/${testGameId}`, {
				method: 'DELETE'
			});

			const response = await DELETE({ 
				request, 
				params: { id: testGameId }
			} as any);

			expect(response.status).toBe(204);

			// Verify game is deleted
			const getRequest = new Request(`http://localhost/api/games/${testGameId}`);
			const getResponse = await GETById({ 
				request: getRequest, 
				params: { id: testGameId },
				url: new URL(getRequest.url)
			} as any);

			expect(getResponse.status).toBe(404);
		});

		it('should return 404 for non-existent game', async () => {
			const fakeId = '00000000-0000-0000-0000-000000000000';
			const request = new Request(`http://localhost/api/games/${fakeId}`, {
				method: 'DELETE'
			});

			const response = await DELETE({ 
				request, 
				params: { id: fakeId }
			} as any);

			expect(response.status).toBe(404);
		});
	});

	describe('/api/games/[id]/users', () => {
		it('should return users for a game', async () => {
			const request = new Request(`http://localhost/api/games/${testGameId}/users`);
			const response = await GETUsers({ 
				request, 
				params: { id: testGameId },
				url: new URL(request.url)
			} as any);

			expect(response.status).toBe(200);
			
			const data = await response.json();
			expect(Array.isArray(data)).toBe(true);
			expect(data.length).toBeGreaterThan(0);
			expect(data[0]).toHaveProperty('userId');
			expect(data[0]).toHaveProperty('role');
			expect(data[0]).toHaveProperty('user');
		});

		it('should add user to game', async () => {
			// Create another test user
			const db = getTestDb();
			const [user2] = await db.insert(users).values(testUsers[1]).returning();

			const userData = {
				email: user2.email,
				role: 'Contributor'
			};

			const request = new Request(`http://localhost/api/games/${testGameId}/users`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(userData)
			});

			const response = await POSTUser({ 
				request, 
				params: { id: testGameId }
			} as any);

			expect(response.status).toBe(201);
			
			const data = await response.json();
			expect(data.userId).toBe(user2.id);
			expect(data.gameId).toBe(testGameId);
			expect(data.role).toBe('Contributor');
		});

		it('should return 400 when trying to add non-existent user', async () => {
			const userData = {
				email: 'nonexistent@example.com',
				role: 'Contributor'
			};

			const request = new Request(`http://localhost/api/games/${testGameId}/users`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(userData)
			});

			const response = await POSTUser({ 
				request, 
				params: { id: testGameId }
			} as any);

			expect(response.status).toBe(404);
		});

		it('should remove user from game', async () => {
			// Create and add another user first
			const db = getTestDb();
			const [user2] = await db.insert(users).values(testUsers[1]).returning();
			await db.insert(userGames).values({
				userId: user2.id,
				gameId: testGameId,
				role: 'Contributor'
			});

			const request = new Request(`http://localhost/api/games/${testGameId}/users`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: user2.email })
			});

			const response = await DELETEUser({ 
				request, 
				params: { id: testGameId }
			} as any);

			expect(response.status).toBe(204);

			// Verify user is removed from game
			const getRequest = new Request(`http://localhost/api/games/${testGameId}/users`);
			const getResponse = await GETUsers({ 
				request: getRequest, 
				params: { id: testGameId },
				url: new URL(getRequest.url)
			} as any);

			const users = await getResponse.json();
			expect(users.find((u: any) => u.userId === user2.id)).toBeUndefined();
		});
	});
});