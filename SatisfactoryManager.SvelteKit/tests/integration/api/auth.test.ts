import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '../../../src/routes/api/auth/ensure-user/+server';
import { testUsers } from '../../setup/fixtures';
import { getTestDb } from '../../setup/test-db';
import { users } from '../../../src/lib/server/db/schema';

describe('/api/auth', () => {
	beforeEach(async () => {
		// Clear users table to ensure clean test state
		const db = getTestDb();
		await db.delete(users);
	});

	describe('POST /api/auth/ensure-user', () => {
		it('should create a new user when user does not exist', async () => {
			const userData = {
				displayName: 'New Test User',
				email: 'newuser@example.com'
			};

			const request = new Request('http://localhost/api/auth/ensure-user', {
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
			expect(data).toHaveProperty('created', true);

			// Verify user was actually created in database
			const db = getTestDb();
			const createdUsers = await db
				.select()
				.from(users)
				.where((db) => db.eq(users.email, userData.email));
			expect(createdUsers.length).toBe(1);
			expect(createdUsers[0].displayName).toBe(userData.displayName);
		});

		it('should return existing user when user already exists', async () => {
			// First, create a user
			const db = getTestDb();
			const [existingUser] = await db.insert(users).values(testUsers[0]).returning();

			const userData = {
				displayName: 'Updated Display Name',
				email: testUsers[0].email // Same email as existing user
			};

			const request = new Request('http://localhost/api/auth/ensure-user', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(userData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.id).toBe(existingUser.id);
			expect(data.email).toBe(testUsers[0].email);
			expect(data).toHaveProperty('created', false);

			// The display name should be updated
			expect(data.displayName).toBe(userData.displayName);
		});

		it('should update displayName for existing user', async () => {
			// First, create a user
			const db = getTestDb();
			await db.insert(users).values(testUsers[0]);

			const updatedUserData = {
				displayName: 'Updated Display Name',
				email: testUsers[0].email
			};

			const request = new Request('http://localhost/api/auth/ensure-user', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updatedUserData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.displayName).toBe(updatedUserData.displayName);
			expect(data).toHaveProperty('created', false);

			// Verify the displayName was actually updated in the database
			const updatedUsers = await db
				.select()
				.from(users)
				.where((db) => db.eq(users.email, testUsers[0].email));
			expect(updatedUsers.length).toBe(1);
			expect(updatedUsers[0].displayName).toBe(updatedUserData.displayName);
		});

		it('should return 400 when displayName is missing', async () => {
			const userData = {
				email: 'test@example.com'
			};

			const request = new Request('http://localhost/api/auth/ensure-user', {
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

			const request = new Request('http://localhost/api/auth/ensure-user', {
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

		it('should return 400 when displayName is empty string', async () => {
			const userData = {
				displayName: '',
				email: 'test@example.com'
			};

			const request = new Request('http://localhost/api/auth/ensure-user', {
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

		it('should return 400 when email is empty string', async () => {
			const userData = {
				displayName: 'Test User',
				email: ''
			};

			const request = new Request('http://localhost/api/auth/ensure-user', {
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

		it('should return 400 when displayName is only whitespace', async () => {
			const userData = {
				displayName: '   ',
				email: 'test@example.com'
			};

			const request = new Request('http://localhost/api/auth/ensure-user', {
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

		it('should return 400 when email is only whitespace', async () => {
			const userData = {
				displayName: 'Test User',
				email: '   '
			};

			const request = new Request('http://localhost/api/auth/ensure-user', {
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

		it('should handle malformed JSON gracefully', async () => {
			const request = new Request('http://localhost/api/auth/ensure-user', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: 'invalid json'
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(500);

			const data = await response.json();
			expect(data).toHaveProperty('error');
		});

		it('should trim whitespace from displayName and email', async () => {
			const userData = {
				displayName: '  Test User  ',
				email: '  test@example.com  '
			};

			const request = new Request('http://localhost/api/auth/ensure-user', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(userData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(201);

			const data = await response.json();
			expect(data.displayName).toBe('Test User');
			expect(data.email).toBe('test@example.com');

			// Verify trimmed values were stored in database
			const db = getTestDb();
			const createdUsers = await db
				.select()
				.from(users)
				.where((db) => db.eq(users.email, 'test@example.com'));
			expect(createdUsers.length).toBe(1);
			expect(createdUsers[0].displayName).toBe('Test User');
		});
	});
});
