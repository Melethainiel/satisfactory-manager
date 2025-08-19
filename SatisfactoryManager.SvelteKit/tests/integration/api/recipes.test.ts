import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST } from '../../../src/routes/api/recipes/+server';
import { GET as GETById, PATCH, DELETE } from '../../../src/routes/api/recipes/[id]/+server';
import { POST as POSTImport } from '../../../src/routes/api/recipes/import/+server';
import { testImportRecipeData } from '../../setup/fixtures';
import { getTestDb } from '../../setup/test-db';
import { recipes, modules, moduleVersions } from '../../../src/lib/server/db/schema';

describe('/api/recipes', () => {
	let testRecipeId: string;
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

		// Create test recipe
		const [recipe] = await db.insert(recipes).values({
			className: 'Recipe_TestRecipe_C',
			displayName: 'Test Recipe'
		}).returning();

		testRecipeId = recipe.id;
	});

	describe('GET /api/recipes', () => {
		it('should return all recipes', async () => {
			const url = new URL('http://localhost/api/recipes');
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

		it('should filter recipes by displayName search', async () => {
			const url = new URL('http://localhost/api/recipes');
			url.searchParams.set('search', 'Test');
			
			const request = new Request(url.toString());
			const response = await GET({ request, url } as any);

			expect(response.status).toBe(200);
			
			const data = await response.json();
			expect(Array.isArray(data)).toBe(true);
			data.forEach((recipe: any) => {
				expect(recipe.displayName.toLowerCase()).toContain('test');
			});
		});
	});

	describe('POST /api/recipes', () => {
		it('should create a new recipe with valid data', async () => {
			const recipeData = {
				className: 'Recipe_NewRecipe_C',
				displayName: 'New Recipe'
			};

			const request = new Request('http://localhost/api/recipes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(recipeData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(201);
			
			const data = await response.json();
			expect(data).toHaveProperty('id');
			expect(data.className).toBe(recipeData.className);
			expect(data.displayName).toBe(recipeData.displayName);
		});

		it('should return 400 when className is missing', async () => {
			const recipeData = {
				displayName: 'New Recipe'
			};

			const request = new Request('http://localhost/api/recipes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(recipeData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(400);
			
			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Recipe className is required');
		});

		it('should return 400 when displayName is missing', async () => {
			const recipeData = {
				className: 'Recipe_NewRecipe_C'
			};

			const request = new Request('http://localhost/api/recipes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(recipeData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(400);
			
			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Recipe displayName is required');
		});

		it('should return 409 when className already exists', async () => {
			const recipeData = {
				className: 'Recipe_TestRecipe_C', // Already exists from beforeEach
				displayName: 'Duplicate Recipe'
			};

			const request = new Request('http://localhost/api/recipes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(recipeData)
			});

			const response = await POST({ request } as any);

			expect(response.status).toBe(409);
			
			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('A recipe with this className already exists');
		});
	});

	describe('GET /api/recipes/[id]', () => {
		it('should return recipe by id', async () => {
			const request = new Request(`http://localhost/api/recipes/${testRecipeId}`);
			const response = await GETById({ 
				request, 
				params: { id: testRecipeId },
				url: new URL(request.url)
			} as any);

			expect(response.status).toBe(200);
			
			const data = await response.json();
			expect(data.id).toBe(testRecipeId);
			expect(data.className).toBe('Recipe_TestRecipe_C');
			expect(data.displayName).toBe('Test Recipe');
		});

		it('should return 404 for non-existent recipe', async () => {
			const fakeId = '00000000-0000-0000-0000-000000000000';
			const request = new Request(`http://localhost/api/recipes/${fakeId}`);
			const response = await GETById({ 
				request, 
				params: { id: fakeId },
				url: new URL(request.url)
			} as any);

			expect(response.status).toBe(404);
		});
	});

	describe('PATCH /api/recipes/[id]', () => {
		it('should update recipe with valid data', async () => {
			const updateData = {
				displayName: 'Updated Recipe Name'
			};

			const request = new Request(`http://localhost/api/recipes/${testRecipeId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updateData)
			});

			const response = await PATCH({ 
				request, 
				params: { id: testRecipeId }
			} as any);

			expect(response.status).toBe(200);
			
			const data = await response.json();
			expect(data.id).toBe(testRecipeId);
			expect(data.displayName).toBe(updateData.displayName);
		});

		it('should return 404 for non-existent recipe', async () => {
			const fakeId = '00000000-0000-0000-0000-000000000000';
			const updateData = {
				displayName: 'Updated Recipe Name'
			};

			const request = new Request(`http://localhost/api/recipes/${fakeId}`, {
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

	describe('DELETE /api/recipes/[id]', () => {
		it('should delete recipe successfully', async () => {
			const request = new Request(`http://localhost/api/recipes/${testRecipeId}`, {
				method: 'DELETE'
			});

			const response = await DELETE({ 
				request, 
				params: { id: testRecipeId }
			} as any);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.success).toBe(true);

			// Verify recipe is deleted
			const getRequest = new Request(`http://localhost/api/recipes/${testRecipeId}`);
			const getResponse = await GETById({ 
				request: getRequest, 
				params: { id: testRecipeId },
				url: new URL(getRequest.url)
			} as any);

			expect(getResponse.status).toBe(404);
		});

		it('should return 404 for non-existent recipe', async () => {
			const fakeId = '00000000-0000-0000-0000-000000000000';
			const request = new Request(`http://localhost/api/recipes/${fakeId}`, {
				method: 'DELETE'
			});

			const response = await DELETE({ 
				request, 
				params: { id: fakeId }
			} as any);

			expect(response.status).toBe(404);
		});
	});

	describe('POST /api/recipes/import', () => {
		it('should import recipes successfully', async () => {
			const importData = {
				...testImportRecipeData,
				moduleVersionId: testModuleVersionId
			};

			const request = new Request('http://localhost/api/recipes/import', {
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

		it('should return 400 when recipes array is missing', async () => {
			const importData = {
				moduleVersionId: testModuleVersionId
			};

			const request = new Request('http://localhost/api/recipes/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(importData)
			});

			const response = await POSTImport({ request } as any);

			expect(response.status).toBe(400);
			
			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('recipes array is required');
		});

		it('should return 400 when moduleVersionId is missing', async () => {
			const importData = {
				recipes: testImportRecipeData.recipes
			};

			const request = new Request('http://localhost/api/recipes/import', {
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
				...testImportRecipeData,
				moduleVersionId: '00000000-0000-0000-0000-000000000000'
			};

			const request = new Request('http://localhost/api/recipes/import', {
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

		it('should return 400 when trying to import too many recipes', async () => {
			const importData = {
				recipes: new Array(501).fill(testImportRecipeData.recipes[0]),
				moduleVersionId: testModuleVersionId
			};

			const request = new Request('http://localhost/api/recipes/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(importData)
			});

			const response = await POSTImport({ request } as any);

			expect(response.status).toBe(400);
			
			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data.error).toContain('Maximum 500 recipes can be imported at once');
		});

		it('should validate recipe data and return errors for invalid recipes', async () => {
			const invalidRecipeData = {
				recipes: [
					{
						// Missing className
						displayName: 'Invalid Recipe 1',
						manufacturingDuration: 6.0,
						ingredients: [],
						products: [],
						craftedIn: []
					},
					{
						className: 'Recipe_Invalid2_C',
						// Missing displayName
						manufacturingDuration: 6.0,
						ingredients: [],
						products: [],
						craftedIn: []
					}
				],
				moduleVersionId: testModuleVersionId
			};

			const request = new Request('http://localhost/api/recipes/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(invalidRecipeData)
			});

			const response = await POSTImport({ request } as any);

			expect(response.status).toBe(200);
			
			const data = await response.json();
			expect(data.errors.length).toBeGreaterThan(0);
			expect(data.created).toBe(0);
		});
	});
});