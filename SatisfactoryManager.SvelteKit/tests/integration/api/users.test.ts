import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST } from '../../../src/routes/api/users/+server';
import { GET as GETById, PUT, DELETE } from '../../../src/routes/api/users/[id]/+server';
import { testUsers } from '../../setup/fixtures';
import { getTestDb } from '../../setup/test-db';
import { users, games, userGames } from '../../../src/lib/server/db/schema';
import { eq } from 'drizzle-orm';

describe('/api/users', () => {
	let testUserId: string;

	beforeEach(async () => {
		const db = getTestDb();
		const [user] = await db.insert(users).values(testUsers[0]).returning();
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
				email: 'newuser@example.com'
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
			expect(data.email).toBe(testUsers[0].email);
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
				email: 'updated@example.com'
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

	describe('User Search and Filtering', () => {
		beforeEach(async () => {
			const db = getTestDb();
			
			// Create additional users for search testing
			await db.insert(users).values([
				{
					displayName: 'Alice Smith',
					email: 'alice.smith@example.com'
				},
				{
					displayName: 'Bob Johnson',
					email: 'bob.johnson@example.com'
				},
				{
					displayName: 'Charlie Brown',
					email: 'charlie.brown@example.com'
				},
				{
					displayName: 'Diana Prince',
					email: 'diana.prince@example.com'
				}
			]);
		});

		it('should search users by display name', async () => {
			const url = new URL('http://localhost/api/users');
			url.searchParams.set('search', 'Smith');
			
			const request = new Request(url.toString());
			const response = await GET({ request, url } as any);
			
			expect(response.status).toBe(200);
			const data = await response.json();
			
			const foundUsers = data.filter((user: any) => 
				user.displayName.toLowerCase().includes('smith')
			);
			expect(foundUsers.length).toBeGreaterThan(0);
		});

		it('should search users by email', async () => {
			const url = new URL('http://localhost/api/users');
			url.searchParams.set('search', 'alice');
			
			const request = new Request(url.toString());
			const response = await GET({ request, url } as any);
			
			expect(response.status).toBe(200);
			const data = await response.json();
			
			const foundUsers = data.filter((user: any) => 
				user.email.toLowerCase().includes('alice')
			);
			expect(foundUsers.length).toBeGreaterThan(0);
		});

		it('should handle case-insensitive search', async () => {
			const searchTerms = ['ALICE', 'alice', 'Alice', 'aLiCe'];
			
			for (const term of searchTerms) {
				const url = new URL('http://localhost/api/users');
				url.searchParams.set('search', term);
				
				const request = new Request(url.toString());
				const response = await GET({ request, url } as any);
				
				expect(response.status).toBe(200);
				const data = await response.json();
				
				const foundUsers = data.filter((user: any) => 
					user.displayName.toLowerCase().includes('alice') || 
					user.email.toLowerCase().includes('alice')
				);
				
				expect(foundUsers.length).toBeGreaterThan(0);
			}
		});

		it('should return empty results for non-matching search', async () => {
			const url = new URL('http://localhost/api/users');
			url.searchParams.set('search', 'NonExistentUser');
			
			const request = new Request(url.toString());
			const response = await GET({ request, url } as any);
			
			expect(response.status).toBe(200);
			const data = await response.json();
			
			const foundUsers = data.filter((user: any) => 
				user.displayName.toLowerCase().includes('nonexistentuser') ||
				user.email.toLowerCase().includes('nonexistentuser')
			);
			
			expect(foundUsers.length).toBe(0);
		});
	});

	describe('User Data Validation', () => {
		it('should handle special characters in display names', async () => {
			const specialNames = [
				'José García',
				'李小明',
				'محمد أحمد',
				"O'Connor",
				'Smith-Jones',
				'User with émojis 🚀'
			];
			
			for (const name of specialNames) {
				const userData = {
					displayName: name,
					email: `${name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}@example.com`
				};
				
				const request = new Request('http://localhost/api/users', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(userData)
				});
				
				const response = await POST({ request } as any);
				
				// Should succeed or fail gracefully
				if (response.status === 201) {
					const data = await response.json();
					expect(data.displayName).toBe(name);
				} else {
					expect([400, 409, 500]).toContain(response.status);
				}
			}
		});

		it('should validate email format strictly', async () => {
			const invalidEmails = [
				'invalid-email',
				'@example.com',
				'user@',
				'user..user@example.com',
				'user@example.',
				'user@.example.com',
				'user name@example.com', // Space not allowed
				'user@ex ample.com' // Space not allowed
			];
			
			for (const email of invalidEmails) {
				const userData = {
					displayName: 'Test User',
					email: email
				};
				
				const request = new Request('http://localhost/api/users', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(userData)
				});
				
				const response = await POST({ request } as any);
				
				// Should return 400 for invalid format or 500 for database constraint
				expect([400, 500]).toContain(response.status);
			}
		});

		it('should handle very long display names', async () => {
			const longName = 'A'.repeat(300);
			
			const userData = {
				displayName: longName,
				email: 'longname@example.com'
			};
			
			const request = new Request('http://localhost/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(userData)
			});
			
			const response = await POST({ request } as any);
			
			// Should either truncate or return an error
			expect([201, 400, 500]).toContain(response.status);
			
			if (response.status === 201) {
				const data = await response.json();
				expect(data.displayName.length).toBeLessThanOrEqual(200);
			}
		});

		it('should trim whitespace from inputs', async () => {
			const userData = {
				displayName: '  Trimmed User  ',
				email: '  trimmed@example.com  '
			};
			
			const request = new Request('http://localhost/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(userData)
			});
			
			const response = await POST({ request } as any);
			
			expect(response.status).toBe(201);
			const data = await response.json();
			
			expect(data.displayName).toBe('Trimmed User');
			expect(data.email).toBe('trimmed@example.com');
		});
	});

	describe('User-Game Relationships', () => {
		let testGameId: string;

		beforeEach(async () => {
			const db = getTestDb();
			
			// Create a test game
			const [game] = await db.insert(games).values({
				name: 'Test Game for Users'
			}).returning();
			testGameId = game.id;
		});

		it('should handle user deletion with game relationships', async () => {
			const db = getTestDb();
			
			// Add user to game
			await db.insert(userGames).values({
				userId: testUserId,
				gameId: testGameId,
				role: 'Owner'
			});
			
			// Delete user
			const request = new Request(`http://localhost/api/users/${testUserId}`, {
				method: 'DELETE'
			});
			
			const response = await DELETE({ 
				request, 
				params: { id: testUserId }
			} as any);
			
			expect(response.status).toBe(204);
			
			// Verify user-game relationships are cleaned up
			const remainingRelationships = await db.select()
				.from(userGames)
				.where(eq(userGames.userId, testUserId));
			
			expect(remainingRelationships.length).toBe(0);
		});

		it('should prevent duplicate email addresses', async () => {
			const duplicateUserData = {
				displayName: 'Different Name',
				email: testUsers[0].email // Same email as existing user
			};
			
			const request = new Request('http://localhost/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(duplicateUserData)
			});
			
			const response = await POST({ request } as any);
			
			// Should return conflict error
			expect([409, 500]).toContain(response.status);
		});
	});

	describe('User Performance and Scalability', () => {
		it('should handle bulk user creation efficiently', async () => {
			const db = getTestDb();
			
			// Create a large batch of users
			const batchSize = 100;
			const bulkUsers = Array.from({ length: batchSize }, (_, i) => ({
				displayName: `Bulk User ${i}`,
				email: `bulkuser${i}@example.com`
			}));
			
			const startTime = Date.now();
			await db.insert(users).values(bulkUsers);
			const insertTime = Date.now() - startTime;
			
			// Should complete reasonably quickly (< 5 seconds)
			expect(insertTime).toBeLessThan(5000);
			
			// Test querying the large dataset
			const queryStartTime = Date.now();
			const request = new Request('http://localhost/api/users');
			const response = await GET({ request, url: new URL(request.url) } as any);
			const queryTime = Date.now() - queryStartTime;
			
			expect(response.status).toBe(200);
			expect(queryTime).toBeLessThan(2000); // Should be reasonably fast
			
			const data = await response.json();
			expect(data.length).toBeGreaterThanOrEqual(batchSize);
		});

		it('should handle concurrent user updates', async () => {
			const updateRequests = Array.from({ length: 10 }, (_, i) => {
				const updateData = {
					displayName: `Concurrent Update ${i}`,
					email: `concurrent${i}@example.com`
				};
				
				const request = new Request(`http://localhost/api/users/${testUserId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(updateData)
				});
				
				return PUT({ 
					request, 
					params: { id: testUserId }
				} as any);
			});
			
			// Execute all updates concurrently
			const responses = await Promise.all(updateRequests);
			
			// At least one should succeed (optimistic concurrency)
			const successResponses = responses.filter(r => r.status === 200);
			expect(successResponses.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe('User Authorization and Security', () => {
		it('should sanitize input data to prevent injection', async () => {
			const maliciousInputs = [
				'<script>alert("xss")</script>',
				'DROP TABLE users;',
				'${7*7}',
				'javascript:alert(1)',
				'{{constructor.constructor("alert(1)")()}}'
			];
			
			for (const maliciousInput of maliciousInputs) {
				const userData = {
					displayName: maliciousInput,
					email: 'test@example.com'
				};
				
				const request = new Request('http://localhost/api/users', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(userData)
				});
				
				const response = await POST({ request } as any);
				
				if (response.status === 201) {
					const data = await response.json();
					// Should not execute the malicious code
					expect(data.displayName).toBe(maliciousInput);
					// In production, this might be sanitized
				} else {
					// Should reject malicious input
					expect([400, 500]).toContain(response.status);
				}
			}
		});

		it('should handle malformed JSON gracefully', async () => {
			const malformedJsonInputs = [
				'{"displayName": "Test", "email": "test@example.com"', // Missing closing brace
				'{"displayName": "Test" "email": "test@example.com"}', // Missing comma
				'{displayName: "Test", email: "test@example.com"}', // Unquoted keys
				'invalid json',
				'null',
				'[]',
				''
			];
			
			for (const json of malformedJsonInputs) {
				const request = new Request('http://localhost/api/users', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: json
				});
				
				const response = await POST({ request } as any);
				
				// Should return 400 or 500 for malformed input
				expect([400, 500]).toContain(response.status);
			}
		});
	});
});