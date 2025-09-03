import { beforeEach, describe, expect, it } from 'vitest';
import { GET, POST } from '../../../src/routes/api/buildings/+server';
import { DELETE, GET as GETById, PATCH } from '../../../src/routes/api/buildings/[id]/+server';
import { POST as POSTImport } from '../../../src/routes/api/buildings/import/+server';
import { testImportBuildingData } from '../../setup/fixtures';
import { moduleService } from '../../../src/lib/server/services/moduleService';
import { buildingService } from '../../../src/lib/server/services/buildingService';

describe('/api/buildings', () => {
	let testBuildingId: string;
	let testModuleId: string;
	let testModuleVersionId: string;

	beforeEach(async () => {
		// Create test module using service (ensures same database connection)
		const module = await moduleService.create({
			name: 'Test Module',
			url: 'https://example.com/module',
			currentVersion: '1.0.0'
		});

		const moduleVersion = await moduleService.addVersion(module.id, {
			version: '1.0.0',
			releaseUrl: 'https://example.com/module/1.0.0'
		});

		testModuleId = module.id;
		testModuleVersionId = moduleVersion.id;
		// No building created in beforeEach to avoid conflicts
	});

	describe('GET /api/buildings', () => {
		it('should return all buildings', async () => {
			// Create a building for this test
			await buildingService.createBuilding({
				moduleId: testModuleId,
				className: 'Build_GetTestBuilding_C',
				name: 'Get Test Building',
				type: 'Constructor'
			});

			const url = new URL('http://localhost/api/buildings');
			const request = new Request(url.toString());
			const response = await GET({ request, url } as any);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(Array.isArray(data)).toBe(true);
			expect(data.length).toBeGreaterThan(0);
			expect(data[0]).toHaveProperty('id');
			expect(data[0]).toHaveProperty('className');
			expect(data[0]).toHaveProperty('name');
		});

		it('should filter buildings by type', async () => {
			// Create a building for this test
			await buildingService.createBuilding({
				moduleId: testModuleId,
				className: 'Build_FilterTestBuilding_C',
				name: 'Filter Test Building',
				type: 'Constructor'
			});

			const url = new URL('http://localhost/api/buildings');
			url.searchParams.set('type', 'Constructor');

			const request = new Request(url.toString());
			const response = await GET({ request, url } as any);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(Array.isArray(data)).toBe(true);
			data.forEach((building: any) => {
				expect(building.type).toBe('Constructor');
			});
		});
	});

	describe('POST /api/buildings', () => {
		it('should create a new building with valid data', async () => {
			const buildingData = {
				moduleId: testModuleId,
				className: `Build_NewBuilding_${Date.now()}_C`,
				name: 'New Building',
				type: 'Miner'
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
			expect(data.name).toBe(buildingData.name);
			expect(data.type).toBe(buildingData.type);
		});

		it('should return 400 when className is missing', async () => {
			const buildingData = {
				moduleId: testModuleId,
				name: 'New Building',
				type: 'Generator'
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

		it('should return 400 when name is missing', async () => {
			const buildingData = {
				moduleId: testModuleId,
				className: 'Build_NewBuilding_C',
				type: 'Constructor'
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
			expect(data.error).toContain('Building name is required');
		});

		it('should return 409 when className already exists', async () => {
			const buildingData = {
				moduleId: testModuleId,
				className: 'Build_TestBuilding_C', // Already exists from beforeEach
				name: 'Duplicate Building',
				type: 'Generator'
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
			// Create a building for this test
			const building = await buildingService.createBuilding({
				moduleId: testModuleId,
				className: 'Build_GetByIdTestBuilding_C',
				name: 'GetById Test Building',
				type: 'Constructor'
			});

			const request = new Request(`http://localhost/api/buildings/${building.id}`);
			const response = await GETById({
				request,
				params: { id: building.id },
				url: new URL(request.url)
			} as any);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.id).toBe(building.id);
			expect(data.className).toBe('Build_GetByIdTestBuilding_C');
			expect(data.name).toBe('GetById Test Building');
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

	describe('PATCH /api/buildings/[id]', () => {
		it('should update building with valid data', async () => {
			// Create a building for this test
			const building = await buildingService.createBuilding({
				moduleId: testModuleId,
				className: 'Build_PatchTestBuilding_C',
				name: 'Patch Test Building',
				type: 'Constructor'
			});

			const updateData = {
				name: 'Updated Building Name',
				type: 'Generator'
			};

			const request = new Request(`http://localhost/api/buildings/${building.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updateData)
			});

			const response = await PATCH({
				request,
				params: { id: building.id }
			} as any);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.name).toBe(updateData.name);
			expect(data.type).toBe(updateData.type);
		});

		it('should return 404 for non-existent building', async () => {
			const fakeId = '00000000-0000-0000-0000-000000000000';
			const updateData = {
				name: 'Updated Building Name'
			};

			const request = new Request(`http://localhost/api/buildings/${fakeId}`, {
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

	describe('DELETE /api/buildings/[id]', () => {
		it('should delete building successfully', async () => {
			// Create a building for this test
			const building = await buildingService.createBuilding({
				moduleId: testModuleId,
				className: 'Build_DeleteTestBuilding_C',
				name: 'Delete Test Building',
				type: 'Constructor'
			});

			const request = new Request(`http://localhost/api/buildings/${building.id}`, {
				method: 'DELETE'
			});

			const response = await DELETE({
				request,
				params: { id: building.id }
			} as any);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.success).toBe(true);
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
			// Create unique building data to avoid conflicts
			const uniqueBuildingData = testImportBuildingData.map((building) => ({
				...building,
				className: `${building.className.replace('_C', '')}_${Date.now()}_C`
			}));

			const importData = {
				moduleVersionId: testModuleVersionId,
				buildings: uniqueBuildingData
			};

			const request = new Request('http://localhost/api/buildings/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(importData)
			});

			const response = await POSTImport({ request } as any);

			expect(response.status).toBe(201);

			const data = await response.json();
			expect(data).toHaveProperty('created');
			expect(data).toHaveProperty('updated');
			expect(data).toHaveProperty('versionsCreated');
			expect(data).toHaveProperty('errors');
			expect(typeof data.created).toBe('number');
			expect(typeof data.updated).toBe('number');
			expect(typeof data.versionsCreated).toBe('number');
			expect(Array.isArray(data.errors)).toBe(true);
			expect(data.created).toBeGreaterThan(0);
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
		});

		it('should return 400 when moduleVersionId is missing', async () => {
			const importData = {
				buildings: testImportBuildingData
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
		});

		it('should return 400 when moduleVersionId is invalid', async () => {
			const fakeModuleVersionId = '00000000-0000-0000-0000-000000000000';
			const importData = {
				moduleVersionId: fakeModuleVersionId,
				buildings: testImportBuildingData
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
		});

		it('should return 400 when trying to import too many buildings', async () => {
			const largeBuildingArray = Array(1001).fill(testImportBuildingData[0]);
			const importData = {
				moduleVersionId: testModuleVersionId,
				buildings: largeBuildingArray
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
		});
	});
});
