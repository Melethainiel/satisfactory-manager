import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST } from '../../../src/routes/api/buildings/+server';
import { GET as GETById, PUT, DELETE } from '../../../src/routes/api/buildings/[id]/+server';
import { POST as POSTImport } from '../../../src/routes/api/buildings/import/+server';
import { testImportBuildingData } from '../../setup/fixtures';
import { getTestDb } from '../../setup/test-db';
import { buildings, modules, moduleVersions } from '../../../src/lib/server/db/schema';

describe('/api/buildings', () => {
	let testBuildingId: string;
	let testModuleVersionId: string;

	beforeEach(async () => {
		const db = getTestDb();
		
		// Create test module and version for import tests
		const [module] = await db.insert(modules).values({
			name: 'Test Module',
			url: 'https://example.com/module',
			currentVersion: '1.0.0'
		}).returning();

		const [moduleVersion] = await db.insert(moduleVersions).values({
			moduleId: module.id,
			version: '1.0.0',
			url: 'https://example.com/module/1.0.0'
		}).returning();

		testModuleVersionId = moduleVersion.id;

		// Create test building
		const [building] = await db.insert(buildings).values({
			className: 'Build_TestBuilding_C',
			displayName: 'Test Building',
			description: 'A test building'
		}).returning();

		testBuildingId = building.id;
	});

	describe('GET /api/buildings', () => {
		it('should return all buildings', async () => {
			const url = new URL('http://localhost/api/buildings');
			const request = new Request(url.toString());
			const response = await GET({ request, url } as any);

			expect(response.status).toBe(200);
			
			const data = await response.json();
			expect(Array.isArray(data)).toBe(true);
			expect(data.length).toBeGreaterThan(0);
			expect(data[0]).toHaveProperty('id');
			expect(data[0]).toHaveProperty('className');
			expect(data[0]).toHaveProperty('displayName');
		});

		it('should filter buildings by displayName search', async () => {
			const url = new URL('http://localhost/api/buildings');
			url.searchParams.set('search', 'Test');
			
			const request = new Request(url.toString());
			const response = await GET({ request, url } as any);

			expect(response.status).toBe(200);
			
			const data = await response.json();
			expect(Array.isArray(data)).toBe(true);
			data.forEach((building: any) => {
				expect(building.displayName.toLowerCase()).toContain('test');
			});
		});
	});

	describe('POST /api/buildings', () => {
		it('should create a new building with valid data', async () => {
			const buildingData = {
				className: 'Build_NewBuilding_C',
				displayName: 'New Building',
				description: 'A new test building'
			};

			const request = new Request('http://localhost/api/buildings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildingData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(201);
			
			const data = await response.json();
			expect(data).toHaveProperty('id');
			expect(data.className).toBe(buildingData.className);
			expect(data.displayName).toBe(buildingData.displayName);
			expect(data.description).toBe(buildingData.description);
		});

		it('should return 400 when className is missing', async () => {
			const buildingData = {
				displayName: 'New Building',
				description: 'A new test building'
			};

			const request = new Request('http://localhost/api/buildings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildingData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(400);
			
			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Building className is required');
		});

		it('should return 400 when displayName is missing', async () => {
			const buildingData = {
				className: 'Build_NewBuilding_C',
				description: 'A new test building'
			};

			const request = new Request('http://localhost/api/buildings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildingData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(400);
			
			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Building displayName is required');
		});

		it('should return 409 when className already exists', async () => {
			const buildingData = {
				className: 'Build_TestBuilding_C', // Already exists from beforeEach
				displayName: 'Duplicate Building',
				description: 'A duplicate building'
			};

			const request = new Request('http://localhost/api/buildings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildingData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(409);
			
			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('A building with this className already exists');
		});
	});

	describe('GET /api/buildings/[id]', () => {
		it('should return building by id', async () => {
			const request = new Request(`http://localhost/api/buildings/${testBuildingId}`);
			const response = await GETById({ 
				request, 
				params: { id: testBuildingId },
				url: new URL(request.url)
			} as any);

			expect(response.status).toBe(200);
			
			const data = await response.json();
			expect(data.id).toBe(testBuildingId);
			expect(data.className).toBe('Build_TestBuilding_C');
			expect(data.displayName).toBe('Test Building');
		});

		it('should return 404 for non-existent building', async () => {
			const fakeId = '00000000-0000-0000-0000-000000000000';
			const request = new Request(`http://localhost/api/buildings/${fakeId}`);
			const response = await GETById({ 
				request, 
				params: { id: fakeId },
				url: new URL(request.url)
			} as any);

			expect(response.status).toBe(404);
		});
	});

	describe('PUT /api/buildings/[id]', () => {
		it('should update building with valid data', async () => {
			const updateData = {
				displayName: 'Updated Building Name',
				description: 'Updated description'
			};

			const request = new Request(`http://localhost/api/buildings/${testBuildingId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updateData)
			});

			const response = await PUT({ 
				request, 
				params: { id: testBuildingId }
			} as any);

			expect(response.status).toBe(200);
			
			const data = await response.json();
			expect(data.id).toBe(testBuildingId);
			expect(data.displayName).toBe(updateData.displayName);
			expect(data.description).toBe(updateData.description);
		});

		it('should return 404 for non-existent building', async () => {
			const fakeId = '00000000-0000-0000-0000-000000000000';
			const updateData = {
				displayName: 'Updated Building Name'
			};

			const request = new Request(`http://localhost/api/buildings/${fakeId}`, {
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

	describe('DELETE /api/buildings/[id]', () => {
		it('should delete building successfully', async () => {
			const request = new Request(`http://localhost/api/buildings/${testBuildingId}`, {
				method: 'DELETE'
			});

			const response = await DELETE({ 
				request, 
				params: { id: testBuildingId }
			} as any);

			expect(response.status).toBe(204);

			// Verify building is deleted
			const getRequest = new Request(`http://localhost/api/buildings/${testBuildingId}`);
			const getResponse = await GETById({ 
				request: getRequest, 
				params: { id: testBuildingId },
				url: new URL(getRequest.url)
			} as any);

			expect(getResponse.status).toBe(404);
		});

		it('should return 404 for non-existent building', async () => {
			const fakeId = '00000000-0000-0000-0000-000000000000';
			const request = new Request(`http://localhost/api/buildings/${fakeId}`, {
				method: 'DELETE'
			});

			const response = await DELETE({ 
				request, 
				params: { id: fakeId }
			} as any);

			expect(response.status).toBe(404);
		});
	});

	describe('POST /api/buildings/import', () => {
		it('should import buildings successfully', async () => {
			const importData = {
				...testImportBuildingData,
				moduleVersionId: testModuleVersionId
			};

			const request = new Request('http://localhost/api/buildings/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(importData)
			});

			const response = await POSTImport({ request } as any);

			expect(response.status).toBe(200);
			
			const data = await response.json();
			expect(data).toHaveProperty('created');
			expect(data).toHaveProperty('updated');
			expect(data).toHaveProperty('versionsCreated');
			expect(data).toHaveProperty('errors');
			expect(Array.isArray(data.errors)).toBe(true);
		});

		it('should return 400 when buildings array is missing', async () => {
			const importData = {
				moduleVersionId: testModuleVersionId
			};

			const request = new Request('http://localhost/api/buildings/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(importData)
			});

			const response = await POSTImport({ request } as any);

			expect(response.status).toBe(400);
			
			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('buildings array is required');
		});

		it('should return 400 when moduleVersionId is missing', async () => {
			const importData = {
				buildings: testImportBuildingData.buildings
			};

			const request = new Request('http://localhost/api/buildings/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(importData)
			});

			const response = await POSTImport({ request } as any);

			expect(response.status).toBe(400);
			
			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('moduleVersionId is required');
		});

		it('should return 400 when moduleVersionId is invalid', async () => {
			const importData = {
				...testImportBuildingData,
				moduleVersionId: '00000000-0000-0000-0000-000000000000'
			};

			const request = new Request('http://localhost/api/buildings/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(importData)
			});

			const response = await POSTImport({ request } as any);

			expect(response.status).toBe(400);
			
			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Invalid moduleVersionId');
		});

		it('should return 400 when trying to import too many buildings', async () => {
			const importData = {
				buildings: new Array(501).fill(testImportBuildingData.buildings[0]),
				moduleVersionId: testModuleVersionId
			};

			const request = new Request('http://localhost/api/buildings/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(importData)
			});

			const response = await POSTImport({ request } as any);

			expect(response.status).toBe(400);
			
			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Maximum 500 buildings can be imported at once');
		});
	});
});