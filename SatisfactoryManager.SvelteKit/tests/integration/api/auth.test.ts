import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '../../../src/routes/api/auth/ensure-user/+server';
import { testUsers } from '../../setup/fixtures';
import { userService } from '../../../src/lib/server/services/userService';

describe('/api/auth', () => {
	beforeEach(async () => {
		// Users are cleared in the general test cleanup, no specific setup needed
	});

	describe('POST /api/auth/ensure-user', () => {
		it('should create a new user or return existing user (idempotent)', async () => {
			const userData = {
				displayName: 'Idempotent Test User',
				email: 'idempotent@example.com'
			};

			const request = new Request('http://localhost/api/auth/ensure-user', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(userData)
			});

			const response = await POST({ request } as any);

			// Should return 200 or 201 depending on whether user already exists
			expect([200, 201]).toContain(response.status);

			const data = await response.json();
			expect(data).toHaveProperty('id');
			expect(data.displayName).toBe(userData.displayName);
			expect(data.email).toBe(userData.email);
			expect(data).toHaveProperty('created');

			// Verify user exists in database
			const createdUser = await userService.getByEmail(userData.email);
			expect(createdUser).toBeDefined();
			expect(createdUser!.displayName).toBe(userData.displayName);
		});

		it('should update displayName when user already exists', async () => {
			const uniqueEmail = `update-displayname-test-${Date.now()}@example.com`;

			// First, create a user using service
			const existingUser = await userService.create({
				displayName: 'Original Name',
				email: uniqueEmail
			});

			const userData = {
				displayName: 'Updated Display Name',
				email: uniqueEmail // Same email as existing user
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
			expect(data.email).toBe(uniqueEmail);
			expect(data).toHaveProperty('created', false);

			// The display name should be updated
			expect(data.displayName).toBe(userData.displayName);

			// Verify the displayName was actually updated in the database
			const updatedUser = await userService.getByEmail(uniqueEmail);
			expect(updatedUser).toBeDefined();
			expect(updatedUser!.displayName).toBe(userData.displayName);
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
				displayName: '  Unique Trimmed User  ',
				email: '  unique-trimmed@example.com  '
			};

			const request = new Request('http://localhost/api/auth/ensure-user', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(userData)
			});

			const response = await POST({ request } as any);

			// Should return 200 or 201 depending on whether user already exists
			expect([200, 201]).toContain(response.status);

			const data = await response.json();
			expect(data.displayName).toBe('Unique Trimmed User');
			expect(data.email).toBe('unique-trimmed@example.com');

			// Verify trimmed values were stored in database
			const createdUser = await userService.getByEmail('unique-trimmed@example.com');
			expect(createdUser).toBeDefined();
			expect(createdUser!.displayName).toBe('Unique Trimmed User');
		});
	});
});
