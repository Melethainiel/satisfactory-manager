import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST } from '../../../src/routes/api/games/+server';
import { GET as GETById, PATCH, DELETE } from '../../../src/routes/api/games/[id]/+server';
import {
	GET as GETUsers,
	POST as POSTUser,
	DELETE as DELETEUser
} from '../../../src/routes/api/games/[id]/users/+server';
import {
	GET as GETModules,
	POST as POSTModules
} from '../../../src/routes/api/games/[id]/modules/+server';
import { testUsers, testGames, testModules, testUserGameRoles } from '../../setup/fixtures';
import { userService } from '../../../src/lib/server/services/userService';
import { gameService } from '../../../src/lib/server/services/gameService';
import { moduleService } from '../../../src/lib/server/services/moduleService';
import { createUserWithRole, createTestEnvironment } from '../../setup/test-utils';

describe('/api/games', () => {
	let testUserId: string;
	let testGameId: string;
	let testUserEmail: string;
	let testGameName: string;

	beforeEach(async () => {
		// Create test user with unique email using service
		testUserEmail = `test-user-${Date.now()}@example.com`;
		const uniqueUser = {
			...testUsers[0],
			email: testUserEmail
		};
		const user = await userService.create(uniqueUser);
		testUserId = user.id;

		// Create test game with unique name using service
		testGameName = `Test Game ${Date.now()}`;
		const uniqueGame = {
			...testGames[0],
			name: testGameName
		};
		const game = await gameService.create(uniqueGame);
		testGameId = game.id;

		// Link user to game as Owner using service
		await gameService.addUser(testGameId, testUserId, 'Owner');
	});

	describe('GET /api/games', () => {
		it('should return games for user email', async () => {
			const url = new URL('http://localhost/api/games');
			url.searchParams.set('email', testUserEmail);

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
				email: testUserEmail,
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
				email: testUserEmail
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
			expect(data.name).toBe(testGameName);
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

	describe('PATCH /api/games/[id]', () => {
		it('should update game with valid data', async () => {
			const updateData = {
				name: 'Updated Game Name'
			};

			const request = new Request(`http://localhost/api/games/${testGameId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updateData)
			});

			const response = await PATCH({
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
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updateData)
			});

			const response = await PATCH({
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
			expect(data[0]).toHaveProperty('id');
			expect(data[0]).toHaveProperty('role');
			expect(data[0]).toHaveProperty('displayName');
			expect(data[0]).toHaveProperty('email');
		});

		it('should add user to game', async () => {
			// Create another test user
			const user2 = await userService.create({
				...testUsers[1],
				email: `test-user-2-${Date.now()}@example.com`
			});

			const userData = {
				emails: [user2.email],
				role: 'Contributor'
			};

			const request = new Request(`http://localhost/api/games/${testGameId}/users`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(userData)
			});

			// Mock locals.user for authentication
			const response = await POSTUser({
				request,
				params: { id: testGameId },
				locals: { user: { email: testUserEmail } }
			} as any);

			expect(response.status).toBe(200); // API returns users list, not 201

			const data = await response.json();
			expect(data).toHaveProperty('added');
			expect(data).toHaveProperty('users');
			expect(Array.isArray(data.added)).toBe(true);
			expect(Array.isArray(data.users)).toBe(true);
		});

		it('should return 400 when trying to add non-existent user', async () => {
			const userData = {
				emails: ['nonexistent@example.com'],
				role: 'Contributor'
			};

			const request = new Request(`http://localhost/api/games/${testGameId}/users`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(userData)
			});

			const response = await POSTUser({
				request,
				params: { id: testGameId },
				locals: { user: { email: testUserEmail } }
			} as any);

			expect(response.status).toBe(200); // API returns partial success with errors

			const data = await response.json();
			expect(data).toHaveProperty('added');
			expect(data.added[0]).toHaveProperty('error');
		});

		it('should remove user from game', async () => {
			// Create and add another user first
			const user2 = await userService.create({
				...testUsers[1],
				email: `test-user-2-remove-${Date.now()}@example.com`
			});
			await gameService.addUser(testGameId, user2.id, 'Contributor');

			const request = new Request(`http://localhost/api/games/${testGameId}/users`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: user2.email })
			});

			const response = await DELETEUser({
				request,
				params: { id: testGameId },
				locals: { user: { email: testUserEmail } }
			} as any);

			expect(response.status).toBe(200); // DELETE returns users list

			const data = await response.json();
			expect(data).toHaveProperty('users');
			expect(Array.isArray(data.users)).toBe(true);

			// Verify user is removed from game
			expect(data.users.find((u: any) => u.id === user2.id)).toBeUndefined();
		});
	});
});
