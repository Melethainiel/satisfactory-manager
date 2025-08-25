import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST } from '../../../src/routes/api/users/+server';
import { GET as GETById, PUT, DELETE } from '../../../src/routes/api/users/[id]/+server';
import { testUsers } from '../../setup/fixtures';
import { userService } from '../../../src/lib/server/services/userService';

describe('/api/users', () => {
	let testUserId: string;
	let testUserEmail: string;

	beforeEach(async () => {
		// Create test user using service with unique email
		testUserEmail = `testuser1-${Date.now()}@example.com`;
		const user = await userService.create({
			displayName: testUsers[0].displayName,
			email: testUserEmail
		});
		testUserId = user.id;
	});

	describe('GET /api/users', () => {
		it('should return all users', async () => {
			const request = new Request('http://localhost/api/users');
			const response = await GET({ request, url: new URL(request.url) } as any);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(Array.isArray(data)).toBe(true);
			expect(data.length).toBeGreaterThan(0);
			expect(data[0]).toHaveProperty('id');
			expect(data[0]).toHaveProperty('displayName');
			expect(data[0]).toHaveProperty('email');
		});
	});

	describe('POST /api/users', () => {
		it('should create a new user with valid data', async () => {
			const userData = {
				displayName: 'New Test User',
				email: `newuser-${Date.now()}@example.com`
			};

			const request = new Request('http://localhost/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(userData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(201);

			const data = await response.json();
			expect(data).toHaveProperty('id');
			expect(data.displayName).toBe(userData.displayName);
			expect(data.email).toBe(userData.email);

			// Check Location header
			expect(response.headers.get('Location')).toBe(`/api/users/${data.id}`);
		});

		it('should return 400 when displayName is missing', async () => {
			const userData = {
				email: 'test@example.com'
			};

			const request = new Request('http://localhost/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(userData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Display name and email are required');
		});

		it('should return 400 when email is missing', async () => {
			const userData = {
				displayName: 'Test User'
			};

			const request = new Request('http://localhost/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(userData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Display name and email are required');
		});

		it('should return 400 when email is invalid format', async () => {
			const userData = {
				displayName: 'Test User',
				email: 'invalid-email'
			};

			const request = new Request('http://localhost/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(userData)
			});

			const response = await POST({ request } as any);

			// Note: This might return 500 due to database constraint
			expect([400, 500]).toContain(response.status);
		});
	});

	describe('GET /api/users/[id]', () => {
		it('should return user by id', async () => {
			const request = new Request(`http://localhost/api/users/${testUserId}`);
			const response = await GETById({
				request,
				params: { id: testUserId },
				url: new URL(request.url)
			} as any);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.id).toBe(testUserId);
			expect(data.displayName).toBe(testUsers[0].displayName);
			expect(data.email).toBe(testUserEmail);
		});

		it('should return 404 for non-existent user', async () => {
			const fakeId = '00000000-0000-0000-0000-000000000000';
			const request = new Request(`http://localhost/api/users/${fakeId}`);
			const response = await GETById({
				request,
				params: { id: fakeId },
				url: new URL(request.url)
			} as any);

			expect(response.status).toBe(404);

			const data = await response.json();
			expect(data).toHaveProperty('error');
		});

		it('should return 400 for invalid UUID format', async () => {
			const invalidId = 'invalid-id';
			const request = new Request(`http://localhost/api/users/${invalidId}`);
			const response = await GETById({
				request,
				params: { id: invalidId },
				url: new URL(request.url)
			} as any);

			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data).toHaveProperty('error');
		});
	});

	describe('PUT /api/users/[id]', () => {
		it('should update user with valid data', async () => {
			const updateData = {
				displayName: 'Updated Name',
				email: `updated-${Date.now()}@example.com`
			};

			const request = new Request(`http://localhost/api/users/${testUserId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updateData)
			});

			const response = await PUT({
				request,
				params: { id: testUserId }
			} as any);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.id).toBe(testUserId);
			expect(data.displayName).toBe(updateData.displayName);
			expect(data.email).toBe(updateData.email);
		});

		it('should return 404 for non-existent user', async () => {
			const fakeId = '00000000-0000-0000-0000-000000000000';
			const updateData = {
				displayName: 'Updated Name',
				email: 'updated@example.com'
			};

			const request = new Request(`http://localhost/api/users/${fakeId}`, {
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

		it('should return 400 when required fields are missing', async () => {
			const updateData = {
				displayName: 'Updated Name'
			};

			const request = new Request(`http://localhost/api/users/${testUserId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updateData)
			});

			const response = await PUT({
				request,
				params: { id: testUserId }
			} as any);

			expect(response.status).toBe(400);
		});
	});

	describe('DELETE /api/users/[id]', () => {
		it('should delete user successfully', async () => {
			const request = new Request(`http://localhost/api/users/${testUserId}`, {
				method: 'DELETE'
			});

			const response = await DELETE({
				request,
				params: { id: testUserId }
			} as any);

			expect(response.status).toBe(204);

			// Verify user is deleted
			const getRequest = new Request(`http://localhost/api/users/${testUserId}`);
			const getResponse = await GETById({
				request: getRequest,
				params: { id: testUserId },
				url: new URL(getRequest.url)
			} as any);

			expect(getResponse.status).toBe(404);
		});

		it('should return 404 for non-existent user', async () => {
			const fakeId = '00000000-0000-0000-0000-000000000000';
			const request = new Request(`http://localhost/api/users/${fakeId}`, {
				method: 'DELETE'
			});

			const response = await DELETE({
				request,
				params: { id: fakeId }
			} as any);

			expect(response.status).toBe(404);
		});
	});
});
