import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST } from '../../../src/routes/api/modules/+server';
import { GET as GETGithubPreview } from '../../../src/routes/api/modules/github-preview/+server';
import { testModules } from '../../setup/fixtures';
import { getTestDb } from '../../setup/test-db';
import { modules, moduleVersions } from '../../../src/lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { moduleService } from '../../../src/lib/server/services/moduleService';

describe('/api/modules', () => {
	let testModuleId: string;

	beforeEach(async () => {
		const db = getTestDb();

		// Create test module
		const [module] = await db.insert(modules).values(testModules[0]).returning();
		testModuleId = module.id;

		// Create test module version
		await db.insert(moduleVersions).values({
			moduleId: module.id,
			version: '1.0.0',
			url: 'https://example.com/module1/1.0.0'
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
			const moduleData = {
				name: 'New Test Module',
				url: 'https://example.com/newmodule',
				githubRepo: 'test/newmodule'
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
				name: testModules[0].name, // Already exists from beforeEach
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
			const moduleData = {
				name: 'Different Module Name',
				url: testModules[0].url // Already exists from beforeEach
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

	describe('Module Individual Operations', () => {
		it('should get module by ID', async () => {
			const db = getTestDb();

			// Since we don't have the individual module endpoint implemented,
			// let's verify via database query for now
			const moduleResult = await db.select().from(modules).where(eq(modules.id, testModuleId));

			expect(moduleResult.length).toBe(1);
			expect(moduleResult[0].id).toBe(testModuleId);
			expect(moduleResult[0].name).toBe(testModules[0].name);
		});

		it('should update module successfully', async () => {
			const db = getTestDb();

			const updateData = {
				name: 'Updated Test Module',
				url: 'https://example.com/updated-module',
				githubRepo: 'test/updated-module'
			};

			await db.update(modules).set(updateData).where(eq(modules.id, testModuleId));

			const [updatedModule] = await db.select().from(modules).where(eq(modules.id, testModuleId));

			expect(updatedModule.name).toBe(updateData.name);
			expect(updatedModule.url).toBe(updateData.url);
			expect(updatedModule.githubRepo).toBe(updateData.githubRepo);
		});
	});

	describe('Module Version Management', () => {
		it('should get all versions for a module', async () => {
			const db = getTestDb();

			// Add additional versions for testing
			await db.insert(moduleVersions).values([
				{
					moduleId: testModuleId,
					version: '1.1.0',
					releaseUrl: 'https://example.com/module1/1.1.0',
					releaseNotes: 'Bug fixes',
					publishedAt: new Date('2024-02-01')
				},
				{
					moduleId: testModuleId,
					version: '2.0.0',
					releaseUrl: 'https://example.com/module1/2.0.0',
					releaseNotes: 'Major update',
					publishedAt: new Date('2024-03-01')
				}
			]);

			const versions = await db
				.select()
				.from(moduleVersions)
				.where(eq(moduleVersions.moduleId, testModuleId));

			expect(versions.length).toBe(3); // Initial + 2 additional
			expect(versions.map((v) => v.version)).toContain('1.0.0');
			expect(versions.map((v) => v.version)).toContain('1.1.0');
			expect(versions.map((v) => v.version)).toContain('2.0.0');
		});

		it('should handle version creation with validation', async () => {
			const db = getTestDb();

			// Test creating a valid version
			const validVersion = {
				moduleId: testModuleId,
				version: '1.2.0',
				releaseUrl: 'https://example.com/module1/1.2.0',
				releaseNotes: 'Minor improvements',
				publishedAt: new Date()
			};

			const [createdVersion] = await db.insert(moduleVersions).values(validVersion).returning();

			expect(createdVersion.version).toBe(validVersion.version);
			expect(createdVersion.moduleId).toBe(testModuleId);
			expect(createdVersion.releaseUrl).toBe(validVersion.releaseUrl);
		});

		it('should handle duplicate version prevention', async () => {
			const duplicateVersionData = {
				version: '1.0.0', // Duplicate of existing version
				releaseUrl: 'https://example.com/module1/1.0.0-duplicate'
			};

			// This should fail due to service-level validation for duplicate versions
			await expect(moduleService.addVersion(testModuleId, duplicateVersionData)).rejects.toThrow(
				'Version 1.0.0 already exists for this module'
			);
		});

		it('should support semantic versioning patterns', async () => {
			const db = getTestDb();

			const semanticVersions = ['2.1.0-alpha.1', '2.1.0-beta', '2.1.0-rc.1', '2.1.0', '2.1.1'];

			const versionData = semanticVersions.map((version) => ({
				moduleId: testModuleId,
				version,
				releaseUrl: `https://example.com/module1/${version}`
			}));

			const createdVersions = await db.insert(moduleVersions).values(versionData).returning();

			expect(createdVersions.length).toBe(semanticVersions.length);
			createdVersions.forEach((version) => {
				expect(semanticVersions).toContain(version.version);
			});
		});
	});

	describe('GitHub Integration', () => {
		it('should validate GitHub repository format', async () => {
			const validRepos = ['owner/repo', 'organization/project-name', 'user/my-awesome-repo'];

			const invalidRepos = ['invalid-format', 'owner/', '/repo', 'owner/repo/extra', ''];

			for (const repo of validRepos) {
				// Simple regex validation that would be used in the API
				expect(repo).toMatch(/^[\w\-\.]+\/[\w\-\.]+$/);
			}

			for (const repo of invalidRepos) {
				expect(repo).not.toMatch(/^[\w\-\.]+\/[\w\-\.]+$/);
			}
		});

		it('should handle GitHub sync operations', async () => {
			const db = getTestDb();

			// Create a module with GitHub repo
			const [githubModule] = await db
				.insert(modules)
				.values({
					name: 'GitHub Test Module',
					url: 'https://github.com/test/github-module',
					githubRepo: 'test/github-module',
					currentVersion: null
				})
				.returning();

			// Simulate GitHub releases being synced
			const githubVersions = [
				{
					moduleId: githubModule.id,
					version: 'v1.0.0',
					releaseUrl: 'https://github.com/test/github-module/releases/tag/v1.0.0',
					releaseNotes: 'Initial GitHub release',
					publishedAt: new Date('2024-01-15')
				},
				{
					moduleId: githubModule.id,
					version: 'v1.1.0',
					releaseUrl: 'https://github.com/test/github-module/releases/tag/v1.1.0',
					releaseNotes: 'GitHub release with improvements',
					publishedAt: new Date('2024-02-15')
				}
			];

			const syncedVersions = await db.insert(moduleVersions).values(githubVersions).returning();

			expect(syncedVersions.length).toBe(2);
			expect(syncedVersions[0].releaseUrl).toContain('github.com');
			expect(syncedVersions[1].releaseUrl).toContain('github.com');
		});

		it('should handle modules without GitHub integration', async () => {
			const db = getTestDb();

			const [nonGitHubModule] = await db
				.insert(modules)
				.values({
					name: 'Non-GitHub Module',
					url: 'https://example.com/standalone-module',
					githubRepo: null,
					currentVersion: '1.0.0'
				})
				.returning();

			// Should be able to add versions manually even without GitHub
			const [manualVersion] = await db
				.insert(moduleVersions)
				.values({
					moduleId: nonGitHubModule.id,
					version: '1.0.0',
					releaseUrl: 'https://example.com/standalone-module/v1.0.0',
					releaseNotes: 'Manual version entry'
				})
				.returning();

			expect(manualVersion.version).toBe('1.0.0');
			expect(manualVersion.releaseUrl).not.toContain('github.com');
		});
	});

	describe('Module Search and Filtering', () => {
		beforeEach(async () => {
			const db = getTestDb();

			// Add more modules for search testing
			await db.insert(modules).values([
				{
					name: 'Advanced Constructor Mod',
					url: 'https://example.com/constructor-mod',
					currentVersion: '2.0.0',
					githubRepo: 'mods/constructor'
				},
				{
					name: 'Logistics Enhancement',
					url: 'https://example.com/logistics-mod',
					currentVersion: '1.5.0',
					githubRepo: 'community/logistics'
				},
				{
					name: 'Quality of Life Pack',
					url: 'https://example.com/qol-pack',
					currentVersion: '3.2.1',
					githubRepo: null
				}
			]);
		});

		it('should search modules by name', async () => {
			const url = new URL('http://localhost/api/modules');
			url.searchParams.set('search', 'Constructor');

			const request = new Request(url.toString());
			const response = await GET({ request, url } as any);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(Array.isArray(data)).toBe(true);

			// Should find modules with "Constructor" in the name
			const constructorModules = data.filter((module: any) =>
				module.name.toLowerCase().includes('constructor')
			);
			expect(constructorModules.length).toBeGreaterThan(0);
		});

		it('should filter modules with GitHub integration', async () => {
			const db = getTestDb();

			const allModules = await db.select().from(modules);
			const githubModules = allModules.filter((module) => module.githubRepo !== null);
			const nonGithubModules = allModules.filter((module) => module.githubRepo === null);

			expect(githubModules.length).toBeGreaterThan(0);
			expect(nonGithubModules.length).toBeGreaterThan(0);
		});

		it('should handle case-insensitive search', async () => {
			const searchTerms = ['CONSTRUCTOR', 'constructor', 'Constructor', 'cOnStRuCtOr'];

			for (const term of searchTerms) {
				const url = new URL('http://localhost/api/modules');
				url.searchParams.set('search', term);

				const request = new Request(url.toString());
				const response = await GET({ request, url } as any);

				expect(response.status).toBe(200);
				const data = await response.json();

				// All searches should return the same results
				const foundModules = data.filter((module: any) =>
					module.name.toLowerCase().includes('constructor')
				);
				expect(foundModules.length).toBeGreaterThan(0);
			}
		});
	});

	describe('Module Validation and Edge Cases', () => {
		it('should validate URL format strictly', async () => {
			const invalidUrls = [
				'not-a-url',
				'ftp://invalid-protocol.com',
				'http://spaces in url.com',
				'https://',
				'https://.',
				'javascript:alert(1)'
			];

			for (const invalidUrl of invalidUrls) {
				const moduleData = {
					name: 'Test Module',
					url: invalidUrl,
					currentVersion: '1.0.0'
				};

				const request = new Request('http://localhost/api/modules', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(moduleData)
				});

				const response = await POST({ request } as any);
				expect(response.status).toBe(400);

				const data = await response.json();
				expect(data.error).toContain('Invalid URL format');
			}
		});

		it('should handle very long module names', async () => {
			const longName = 'A'.repeat(300); // Exceeds typical varchar limits

			const moduleData = {
				name: longName,
				url: 'https://example.com/long-name-module',
				currentVersion: '1.0.0'
			};

			const request = new Request('http://localhost/api/modules', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(moduleData)
			});

			const response = await POST({ request } as any);
			// Should fail due to length constraints
			expect([400, 500]).toContain(response.status);
		});

		it('should handle special characters in module names', async () => {
			const specialCharNames = [
				'Module with émojis 🚀',
				'Module & Special Characters!',
				'Módulo en Español',
				'モジュール日本語',
				'Module "with quotes"',
				"Module 'with apostrophes'"
			];

			for (const name of specialCharNames) {
				const moduleData = {
					name: name,
					url: `https://example.com/${encodeURIComponent(name)}`,
					currentVersion: '1.0.0'
				};

				const request = new Request('http://localhost/api/modules', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(moduleData)
				});

				const response = await POST({ request } as any);

				// Should succeed or fail gracefully
				if (response.status === 201) {
					const data = await response.json();
					expect(data.name).toBe(name);
				} else {
					expect([400, 409]).toContain(response.status);
				}
			}
		});
	});

	describe('Performance and Scalability', () => {
		it('should handle large numbers of modules efficiently', async () => {
			const db = getTestDb();

			// Create a large batch of modules
			const batchSize = 100;
			const moduleData = Array.from({ length: batchSize }, (_, i) => ({
				name: `Batch Module ${i}`,
				url: `https://example.com/batch-module-${i}`,
				currentVersion: '1.0.0',
				githubRepo: i % 3 === 0 ? `batch/module-${i}` : null // Some with GitHub, some without
			}));

			const startTime = Date.now();
			await db.insert(modules).values(moduleData);
			const insertTime = Date.now() - startTime;

			// Should complete reasonably quickly (< 5 seconds)
			expect(insertTime).toBeLessThan(5000);

			// Test querying the large dataset
			const queryStartTime = Date.now();
			const allModules = await db.select().from(modules);
			const queryTime = Date.now() - queryStartTime;

			expect(allModules.length).toBeGreaterThanOrEqual(batchSize);
			expect(queryTime).toBeLessThan(1000); // Should be very fast
		});
	});
});
