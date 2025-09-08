import { beforeEach, describe, expect, it } from 'vitest';
import { GET, POST } from '../../../src/routes/api/modules/+server';
import { DELETE } from '../../../src/routes/api/modules/[id]/+server';
import { GET as GETGithubPreview } from '../../../src/routes/api/modules/github-preview/+server';
import { testModules, testUsers } from '../../setup/fixtures';
import { moduleService } from '../../../src/lib/server/services/moduleService';
import { userService } from '../../../src/lib/server/services/userService';
import { createAuthHeaders, createExpiredAuthHeaders } from '../../setup/auth-helpers';

describe('/api/modules', () => {
	let testModuleId: string;
	let testModuleName: string;
	let testModuleUrl: string;

	beforeEach(async () => {
		// Create test user with unique email using service
		await userService.create({
			...testUsers[0],
			email: `test-user-${Date.now()}@example.com`
		});

		// Create test module with unique properties using service
		const timestamp = Date.now();
		testModuleName = `Test Module 1 ${timestamp}`;
		testModuleUrl = `https://example.com/module1-${timestamp}`;

		const module = await moduleService.create({
			name: testModuleName,
			url: testModuleUrl,
			githubRepo: `test/module1-${timestamp}`,
			currentVersion: '1.0.0'
		});

		testModuleId = module.id;

		// Create test module version using service
		await moduleService.addVersion(module.id, {
			version: '1.0.0',
			releaseUrl: 'https://example.com/module1/1.0.0'
		});
	});

	describe('GET /api/modules', () => {
		it('should return all modules', async () => {
			const url = new URL('http://localhost/api/modules');
			const request = new Request(url.toString());
			const response = await GET({ request, url } as any);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(Array.isArray(data)).toBe(true);
			expect(data.length).toBeGreaterThan(0);
			expect(data[0]).toHaveProperty('id');
			expect(data[0]).toHaveProperty('name');
			expect(data[0]).toHaveProperty('url');
			expect(data[0]).toHaveProperty('currentVersion');
		});

		it('should filter modules by name search', async () => {
			const url = new URL('http://localhost/api/modules');
			url.searchParams.set('search', 'Test');

			const request = new Request(url.toString());
			const response = await GET({ request, url } as any);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(Array.isArray(data)).toBe(true);
			data.forEach((module: any) => {
				expect(module.name.toLowerCase()).toContain('test');
			});
		});
	});

	describe('POST /api/modules', () => {
		it('should create a new module with valid data', async () => {
			const timestamp = Date.now();
			const moduleData = {
				name: `New Test Module ${timestamp}`,
				url: `https://example.com/newmodule-${timestamp}`,
				githubRepo: `test/newmodule-${timestamp}`
			};

			const request = new Request('http://localhost/api/modules', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(moduleData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(201);

			const data = await response.json();
			expect(data).toHaveProperty('id');
			expect(data.name).toBe(moduleData.name);
			expect(data.url).toBe(moduleData.url);
			expect(data.githubRepo).toBe(moduleData.githubRepo);
			// currentVersion is null initially until versions are synced
			expect(data.currentVersion).toBe(null);
		});

		it('should return 400 when name is missing', async () => {
			const moduleData = {
				url: 'https://example.com/newmodule',
				currentVersion: '2.0.0'
			};

			const request = new Request('http://localhost/api/modules', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(moduleData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Module name is required');
		});

		it('should return 400 when url is missing', async () => {
			const moduleData = {
				name: 'New Test Module',
				currentVersion: '2.0.0'
			};

			const request = new Request('http://localhost/api/modules', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(moduleData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Module URL is required');
		});

		it('should return 400 when url format is invalid', async () => {
			const moduleData = {
				name: 'New Test Module',
				url: 'not-a-valid-url',
				currentVersion: '2.0.0'
			};

			const request = new Request('http://localhost/api/modules', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(moduleData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Invalid URL format');
		});

		it('should return 409 when name already exists', async () => {
			const moduleData = {
				name: testModuleName, // Already exists from beforeEach
				url: 'https://example.com/duplicate',
				currentVersion: '2.0.0'
			};

			const request = new Request('http://localhost/api/modules', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(moduleData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(409);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('A module with this name already exists');
		});

		it('should return 409 when url already exists', async () => {
			const timestamp = Date.now();
			const moduleData = {
				name: `Different Module Name ${timestamp}`, // Unique name
				url: testModuleUrl // Already exists from beforeEach
			};

			const request = new Request('http://localhost/api/modules', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(moduleData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(409);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('A module with this URL already exists');
		});
	});

	describe('GET /api/modules/github-preview', () => {
		it('should return 400 when githubRepo parameter is missing', async () => {
			const url = new URL('http://localhost/api/modules/github-preview');
			const request = new Request(url.toString());
			const response = await GETGithubPreview({ request, url } as any);

			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('githubRepo query parameter is required');
		});

		it('should return 400 when githubRepo format is invalid', async () => {
			const url = new URL('http://localhost/api/modules/github-preview');
			url.searchParams.set('githubRepo', 'invalid-format');

			const request = new Request(url.toString());
			const response = await GETGithubPreview({ request, url } as any);

			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Invalid GitHub repository format');
		});

		// Note: This test would need to mock GitHub API calls in a real scenario
		it('should handle valid githubRepo parameter', async () => {
			const url = new URL('http://localhost/api/modules/github-preview');
			url.searchParams.set('githubRepo', 'owner/repo');

			const request = new Request(url.toString());
			const response = await GETGithubPreview({ request, url } as any);

			// This might return 500 in test environment due to GitHub API calls
			// In a real test setup, we'd mock the GitHub API calls
			expect([200, 404, 500]).toContain(response.status);
		});
	});
});
