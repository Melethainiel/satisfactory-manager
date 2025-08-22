import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST } from '../../../src/routes/api/items/+server';
import { GET as GETById, PATCH, DELETE } from '../../../src/routes/api/items/[id]/+server';
import { POST as POSTImport } from '../../../src/routes/api/items/import/+server';
import { testImportItemData } from '../../setup/fixtures';
import { getTestDb } from '../../setup/test-db';
import { items, modules, moduleVersions } from '../../../src/lib/server/db/schema';

describe('/api/items', () => {
	let testItemId: string;
	let testModuleVersionId: string;

	beforeEach(async () => {
		const db = getTestDb();

		// Create test module and version for import tests
		const [module] = await db
			.insert(modules)
			.values({
				name: 'Test Module',
				url: 'https://example.com/module',
				currentVersion: '1.0.0'
			})
			.returning();

		const [moduleVersion] = await db
			.insert(moduleVersions)
			.values({
				moduleId: module.id,
				version: '1.0.0',
				releaseUrl: 'https://example.com/module/1.0.0'
			})
			.returning();

		testModuleVersionId = moduleVersion.id;

		// Create test item
		const [item] = await db
			.insert(items)
			.values({
				className: 'Desc_TestItem_C',
				displayName: 'Test Item',
				description: 'A test item',
				form: 'RF_SOLID'
			})
			.returning();

		testItemId = item.id;
	});

	describe('GET /api/items', () => {
		it('should return all items', async () => {
			const url = new URL('http://localhost/api/items');
			const request = new Request(url.toString());
			const response = await GET({ request, url } as any);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(Array.isArray(data)).toBe(true);
			expect(data.length).toBeGreaterThan(0);
			expect(data[0]).toHaveProperty('id');
			expect(data[0]).toHaveProperty('className');
			expect(data[0]).toHaveProperty('displayName');
			expect(data[0]).toHaveProperty('form');
		});

		it('should filter items by form', async () => {
			const url = new URL('http://localhost/api/items');
			url.searchParams.set('form', 'RF_SOLID');

			const request = new Request(url.toString());
			const response = await GET({ request, url } as any);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(Array.isArray(data)).toBe(true);
			data.forEach((item: any) => {
				expect(item.form).toBe('RF_SOLID');
			});
		});

		it('should return 400 for invalid form filter', async () => {
			const url = new URL('http://localhost/api/items');
			url.searchParams.set('form', 'INVALID_FORM');

			const request = new Request(url.toString());
			const response = await GET({ request, url } as any);

			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Invalid item form');
		});
	});

	describe('POST /api/items', () => {
		it('should create a new item with valid data', async () => {
			const itemData = {
				className: 'Desc_NewItem_C',
				displayName: 'New Item',
				description: 'A new test item',
				form: 'RF_SOLID'
			};

			const request = new Request('http://localhost/api/items', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(itemData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(201);

			const data = await response.json();
			expect(data).toHaveProperty('id');
			expect(data.className).toBe(itemData.className);
			expect(data.displayName).toBe(itemData.displayName);
			expect(data.description).toBe(itemData.description);
			expect(data.form).toBe(itemData.form);
		});

		it('should return 400 when className is missing', async () => {
			const itemData = {
				displayName: 'New Item',
				form: 'RF_SOLID'
			};

			const request = new Request('http://localhost/api/items', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(itemData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Item className is required');
		});

		it('should return 400 when displayName is missing', async () => {
			const itemData = {
				className: 'Desc_NewItem_C',
				form: 'RF_SOLID'
			};

			const request = new Request('http://localhost/api/items', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(itemData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Item displayName is required');
		});

		it('should return 400 when form is invalid', async () => {
			const itemData = {
				className: 'Desc_NewItem_C',
				displayName: 'New Item',
				form: 'INVALID_FORM'
			};

			const request = new Request('http://localhost/api/items', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(itemData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Valid item form is required');
		});

		it('should return 409 when className already exists', async () => {
			const itemData = {
				className: 'Desc_TestItem_C', // Already exists from beforeEach
				displayName: 'Duplicate Item',
				form: 'RF_SOLID'
			};

			const request = new Request('http://localhost/api/items', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(itemData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(409);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('An item with this className already exists');
		});
	});

	describe('GET /api/items/[id]', () => {
		it('should return item by id', async () => {
			const request = new Request(`http://localhost/api/items/${testItemId}`);
			const response = await GETById({
				request,
				params: { id: testItemId },
				url: new URL(request.url)
			} as any);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.id).toBe(testItemId);
			expect(data.className).toBe('Desc_TestItem_C');
			expect(data.displayName).toBe('Test Item');
		});

		it('should return 404 for non-existent item', async () => {
			const fakeId = '00000000-0000-0000-0000-000000000000';
			const request = new Request(`http://localhost/api/items/${fakeId}`);
			const response = await GETById({
				request,
				params: { id: fakeId },
				url: new URL(request.url)
			} as any);

			expect(response.status).toBe(404);
		});
	});

	describe('PATCH /api/items/[id]', () => {
		it('should update item with valid data', async () => {
			const updateData = {
				displayName: 'Updated Item Name',
				description: 'Updated description'
			};

			const request = new Request(`http://localhost/api/items/${testItemId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updateData)
			});

			const response = await PATCH({
				request,
				params: { id: testItemId }
			} as any);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.id).toBe(testItemId);
			expect(data.displayName).toBe(updateData.displayName);
			expect(data.description).toBe(updateData.description);
		});

		it('should return 404 for non-existent item', async () => {
			const fakeId = '00000000-0000-0000-0000-000000000000';
			const updateData = {
				displayName: 'Updated Item Name'
			};

			const request = new Request(`http://localhost/api/items/${fakeId}`, {
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

	describe('DELETE /api/items/[id]', () => {
		it('should delete item successfully', async () => {
			const request = new Request(`http://localhost/api/items/${testItemId}`, {
				method: 'DELETE'
			});

			const response = await DELETE({
				request,
				params: { id: testItemId }
			} as any);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.success).toBe(true);

			// Verify item is deleted
			const getRequest = new Request(`http://localhost/api/items/${testItemId}`);
			const getResponse = await GETById({
				request: getRequest,
				params: { id: testItemId },
				url: new URL(getRequest.url)
			} as any);

			expect(getResponse.status).toBe(404);
		});

		it('should return 404 for non-existent item', async () => {
			const fakeId = '00000000-0000-0000-0000-000000000000';
			const request = new Request(`http://localhost/api/items/${fakeId}`, {
				method: 'DELETE'
			});

			const response = await DELETE({
				request,
				params: { id: fakeId }
			} as any);

			expect(response.status).toBe(404);
		});
	});

	describe('POST /api/items/import', () => {
		it('should import items successfully', async () => {
			const importData = {
				...testImportItemData,
				moduleVersionId: testModuleVersionId
			};

			const request = new Request('http://localhost/api/items/import', {
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
			expect(data.created).toBeGreaterThan(0);
			expect(Array.isArray(data.errors)).toBe(true);
		});

		it('should return 400 when items array is missing', async () => {
			const importData = {
				moduleVersionId: testModuleVersionId
			};

			const request = new Request('http://localhost/api/items/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(importData)
			});

			const response = await POSTImport({ request } as any);

			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('items array is required');
		});

		it('should return 400 when moduleVersionId is missing', async () => {
			const importData = {
				items: testImportItemData.items
			};

			const request = new Request('http://localhost/api/items/import', {
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
				...testImportItemData,
				moduleVersionId: '00000000-0000-0000-0000-000000000000'
			};

			const request = new Request('http://localhost/api/items/import', {
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

		it('should return 400 when trying to import too many items', async () => {
			const importData = {
				items: new Array(1001).fill(testImportItemData.items[0]),
				moduleVersionId: testModuleVersionId
			};

			const request = new Request('http://localhost/api/items/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(importData)
			});

			const response = await POSTImport({ request } as any);

			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Maximum 1000 items can be imported at once');
		});
	});
});
