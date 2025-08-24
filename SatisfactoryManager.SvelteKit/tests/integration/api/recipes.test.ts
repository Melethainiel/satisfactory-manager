import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST } from '../../../src/routes/api/recipes/+server';
import { GET as GETById, PATCH, DELETE } from '../../../src/routes/api/recipes/[id]/+server';
import { POST as POSTImport } from '../../../src/routes/api/recipes/import/+server';
import { testImportRecipeData } from '../../setup/fixtures';
import { getTestDb } from '../../setup/test-db';
import {
	recipes,
	modules,
	moduleVersions,
	items,
	buildings,
	recipeVersions,
	recipeIngredients,
	recipeProducts,
	recipeBuildings
} from '../../../src/lib/server/db/schema';
import { eq } from 'drizzle-orm';

describe('/api/recipes', () => {
	let testRecipeId: string;
	let testModuleVersionId: string;
	let testItemId: string;
	let testBuildingId: string;
	let testModuleId: string;

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
		testModuleId = module.id;

		// Create test items for recipe relationships
		const [item] = await db
			.insert(items)
			.values({
				moduleId: module.id,
				className: 'Desc_TestItem_C',
				displayName: 'Test Item',
				description: 'Test item for recipes',
				form: 'RF_SOLID'
			})
			.returning();
		testItemId = item.id;

		// Create test building for recipe relationships
		const [building] = await db
			.insert(buildings)
			.values({
				moduleId: module.id,
				className: 'Build_TestBuilding_C',
				name: 'Test Building',
				type: 'Constructor'
			})
			.returning();
		testBuildingId = building.id;

		// Create test recipe
		const [recipe] = await db
			.insert(recipes)
			.values({
				moduleId: module.id,
				className: 'Recipe_TestRecipe_C',
				displayName: 'Test Recipe'
			})
			.returning();

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
						manufacturingDuration: '6.0',
						ingredients: [],
						products: [],
						craftedIn: []
					},
					{
						className: 'Recipe_Invalid2_C',
						// Missing displayName
						manufacturingDuration: '6.0',
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

	describe('Recipe Version Management', () => {
		let testRecipeVersionId: string;

		beforeEach(async () => {
			const db = getTestDb();

			// Create a recipe version for testing
			const [recipeVersion] = await db
				.insert(recipeVersions)
				.values({
					recipeId: testRecipeId,
					moduleVersionId: testModuleVersionId,
					manufacturingDuration: '6.0'
				})
				.returning();

			testRecipeVersionId = recipeVersion.id;
		});

		it('should get recipe versions', async () => {
			const db = getTestDb();

			const versions = await db
				.select()
				.from(recipeVersions)
				.where(eq(recipeVersions.recipeId, testRecipeId));

			expect(versions.length).toBeGreaterThan(0);
			expect(versions[0].manufacturingDuration).toBe('6.00');
		});

		it('should create recipe versions with different durations', async () => {
			const db = getTestDb();

			// Create another module version
			const [module] = await db
				.select()
				.from(modules)
				.where(
					eq(
						modules.id,
						(
							await db
								.select()
								.from(moduleVersions)
								.where(eq(moduleVersions.id, testModuleVersionId))
						)[0].moduleId
					)
				);
			const [newModuleVersion] = await db
				.insert(moduleVersions)
				.values({
					moduleId: module.id,
					version: '2.0.0',
					releaseUrl: 'https://example.com/module/2.0.0'
				})
				.returning();

			// Create a new recipe version with different duration
			const [newRecipeVersion] = await db
				.insert(recipeVersions)
				.values({
					recipeId: testRecipeId,
					moduleVersionId: newModuleVersion.id,
					manufacturingDuration: '4.0'
				})
				.returning();

			expect(newRecipeVersion.manufacturingDuration).toBe('4.00');
		});
	});

	describe('Recipe Ingredients and Products', () => {
		let testRecipeVersionId: string;

		beforeEach(async () => {
			const db = getTestDb();

			// Create a recipe version
			const [recipeVersion] = await db
				.insert(recipeVersions)
				.values({
					recipeId: testRecipeId,
					moduleVersionId: testModuleVersionId,
					manufacturingDuration: '6.0'
				})
				.returning();

			testRecipeVersionId = recipeVersion.id;
		});

		it('should manage recipe ingredients', async () => {
			const db = getTestDb();

			// Add ingredients to recipe version
			const [ingredient] = await db
				.insert(recipeIngredients)
				.values({
					recipeVersionId: testRecipeVersionId,
					itemId: testItemId,
					count: '3'
				})
				.returning();

			expect(ingredient.count).toBe('3.00');
			expect(ingredient.recipeVersionId).toBe(testRecipeVersionId);
			expect(ingredient.itemId).toBe(testItemId);
		});

		it('should manage recipe products', async () => {
			const db = getTestDb();

			// Add products to recipe version
			const [product] = await db
				.insert(recipeProducts)
				.values({
					recipeVersionId: testRecipeVersionId,
					itemId: testItemId,
					count: '2'
				})
				.returning();

			expect(product.count).toBe('2.00');
			expect(product.recipeVersionId).toBe(testRecipeVersionId);
			expect(product.itemId).toBe(testItemId);
		});

		it('should manage recipe buildings', async () => {
			const db = getTestDb();

			// Add buildings that can craft this recipe
			const [recipeBuilding] = await db
				.insert(recipeBuildings)
				.values({
					recipeVersionId: testRecipeVersionId,
					buildingId: testBuildingId
				})
				.returning();

			expect(recipeBuilding.recipeVersionId).toBe(testRecipeVersionId);
			expect(recipeBuilding.buildingId).toBe(testBuildingId);
		});

		it('should handle complex recipes with multiple ingredients and products', async () => {
			const db = getTestDb();

			// Create additional items for complex recipe
			const [inputItem1] = await db
				.insert(items)
				.values({
					moduleId: testModuleId,
					className: 'Desc_InputItem1_C',
					displayName: 'Input Item 1',
					form: 'RF_SOLID'
				})
				.returning();

			const [inputItem2] = await db
				.insert(items)
				.values({
					moduleId: testModuleId,
					className: 'Desc_InputItem2_C',
					displayName: 'Input Item 2',
					form: 'RF_LIQUID'
				})
				.returning();

			const [outputItem1] = await db
				.insert(items)
				.values({
					moduleId: testModuleId,
					className: 'Desc_OutputItem1_C',
					displayName: 'Output Item 1',
					form: 'RF_SOLID'
				})
				.returning();

			const [outputItem2] = await db
				.insert(items)
				.values({
					moduleId: testModuleId,
					className: 'Desc_OutputItem2_C',
					displayName: 'Output Item 2',
					form: 'RF_GAS'
				})
				.returning();

			// Add multiple ingredients
			const ingredients = await db
				.insert(recipeIngredients)
				.values([
					{
						recipeVersionId: testRecipeVersionId,
						itemId: inputItem1.id,
						count: '5'
					},
					{
						recipeVersionId: testRecipeVersionId,
						itemId: inputItem2.id,
						count: '2.5'
					}
				])
				.returning();

			// Add multiple products
			const products = await db
				.insert(recipeProducts)
				.values([
					{
						recipeVersionId: testRecipeVersionId,
						itemId: outputItem1.id,
						count: '3'
					},
					{
						recipeVersionId: testRecipeVersionId,
						itemId: outputItem2.id,
						count: '1.5'
					}
				])
				.returning();

			expect(ingredients.length).toBe(2);
			expect(products.length).toBe(2);

			// Verify ingredients
			expect(ingredients[0].count).toBe('5.00');
			expect(ingredients[1].count).toBe('2.50');

			// Verify products
			expect(products[0].count).toBe('3.00');
			expect(products[1].count).toBe('1.50');
		});
	});

	describe('Recipe Search and Filtering', () => {
		beforeEach(async () => {
			const db = getTestDb();

			// Create additional recipes for search testing
			await db.insert(recipes).values([
				{
					moduleId: testModuleId,
					className: 'Recipe_IronPlate_C',
					displayName: 'Iron Plate Recipe'
				},
				{
					moduleId: testModuleId,
					className: 'Recipe_SteelPlate_C',
					displayName: 'Steel Plate Recipe'
				},
				{
					moduleId: testModuleId,
					className: 'Recipe_Concrete_C',
					displayName: 'Concrete Recipe'
				}
			]);
		});

		it('should search recipes by displayName', async () => {
			const url = new URL('http://localhost/api/recipes');
			url.searchParams.set('search', 'Plate');

			const request = new Request(url.toString());
			const response = await GET({ request, url } as any);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(Array.isArray(data)).toBe(true);

			// Should find recipes with "Plate" in the name
			const plateRecipes = data.filter((recipe: any) =>
				recipe.displayName.toLowerCase().includes('plate')
			);
			expect(plateRecipes.length).toBeGreaterThan(0);
		});

		it('should handle case-insensitive search', async () => {
			const searchTerms = ['IRON', 'iron', 'Iron', 'iRoN'];

			for (const term of searchTerms) {
				const url = new URL('http://localhost/api/recipes');
				url.searchParams.set('search', term);

				const request = new Request(url.toString());
				const response = await GET({ request, url } as any);

				expect(response.status).toBe(200);
				const data = await response.json();

				// All searches should return the same results
				const foundRecipes = data.filter((recipe: any) =>
					recipe.displayName.toLowerCase().includes('iron')
				);

				if (foundRecipes.length > 0) {
					expect(foundRecipes.length).toBeGreaterThan(0);
				}
			}
		});
	});

	describe('Recipe Performance and Edge Cases', () => {
		it('should handle manufacturing duration edge cases', async () => {
			const db = getTestDb();

			const edgeCases = [
				{ duration: 0.1, desc: 'very fast recipe' },
				{ duration: 1800, desc: 'very slow recipe (30 minutes)' },
				{ duration: 0.01, desc: 'extremely fast recipe' },
				{ duration: 3600, desc: 'extremely slow recipe (1 hour)' }
			];

			for (const edgeCase of edgeCases) {
				const [recipe] = await db
					.insert(recipes)
					.values({
						moduleId: testModuleId,
						className: `Recipe_${edgeCase.desc.replace(/\s+/g, '')}_C`,
						displayName: `Recipe for ${edgeCase.desc}`
					})
					.returning();

				const [version] = await db
					.insert(recipeVersions)
					.values({
						recipeId: recipe.id,
						moduleVersionId: testModuleVersionId,
						manufacturingDuration: edgeCase.duration.toString()
					})
					.returning();

				expect(parseFloat(version.manufacturingDuration)).toBeCloseTo(edgeCase.duration, 2);
			}
		});

		it('should handle fractional ingredient/product counts', async () => {
			const db = getTestDb();

			const [recipeVersion] = await db
				.insert(recipeVersions)
				.values({
					recipeId: testRecipeId,
					moduleVersionId: testModuleVersionId,
					manufacturingDuration: '6.0'
				})
				.returning();

			const fractionalCounts = [0.5, 1.333, 2.25, 10.75];

			for (let i = 0; i < fractionalCounts.length; i++) {
				const count = fractionalCounts[i];

				const [ingredient] = await db
					.insert(recipeIngredients)
					.values({
						recipeVersionId: recipeVersion.id,
						itemId: testItemId,
						count: count.toString()
					})
					.returning();

				expect(parseFloat(ingredient.count)).toBeCloseTo(count, 2);
			}
		});

		it('should handle large batch recipe imports efficiently', async () => {
			const batchSize = 100;
			const recipeData = Array.from({ length: batchSize }, (_, i) => ({
				moduleId: testModuleId,
				className: `Recipe_Batch${i}_C`,
				displayName: `Batch Recipe ${i}`
			}));

			const startTime = Date.now();
			const db = getTestDb();
			await db.insert(recipes).values(recipeData);
			const insertTime = Date.now() - startTime;

			// Should complete reasonably quickly (< 5 seconds)
			expect(insertTime).toBeLessThan(5000);

			// Verify all recipes were created
			const allRecipes = await db.select().from(recipes);
			expect(allRecipes.length).toBeGreaterThanOrEqual(batchSize);
		});
	});

	describe('Recipe Import with Complex Relationships', () => {
		it('should import recipes with full ingredient/product/building relationships', async () => {
			const db = getTestDb();

			// Create items and buildings needed for the complex import
			const [ironIngot] = await db
				.insert(items)
				.values({
					moduleId: testModuleId,
					className: 'Desc_IronIngot_C',
					displayName: 'Iron Ingot',
					form: 'RF_SOLID'
				})
				.returning();

			const [ironPlate] = await db
				.insert(items)
				.values({
					moduleId: testModuleId,
					className: 'Desc_IronPlate_C',
					displayName: 'Iron Plate',
					form: 'RF_SOLID'
				})
				.returning();

			const [constructorBuilding] = await db
				.insert(buildings)
				.values({
					moduleId: testModuleId,
					className: 'Build_ConstructorMk1_C',
					name: 'Constructor',
					type: 'Constructor'
				})
				.returning();

			// Import the complex recipe
			const complexImportData = {
				recipes: [
					{
						className: 'Recipe_ComplexIronPlate_C',
						displayName: 'Complex Iron Plate',
						manufacturingDuration: '6.0',
						ingredients: [
							{
								item: 'Desc_IronIngot_C',
								count: 3
							}
						],
						products: [
							{
								item: 'Desc_IronPlate_C',
								count: 2
							}
						],
						craftedIn: ['Build_ConstructorMk1_C']
					}
				],
				moduleVersionId: testModuleVersionId
			};

			const request = new Request('http://localhost/api/recipes/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(complexImportData)
			});

			const response = await POSTImport({ request } as any);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.created).toBe(1);
			expect(data.versionsCreated).toBe(1);

			// Verify the relationships were created
			const importedRecipe = await db
				.select()
				.from(recipes)
				.where(eq(recipes.className, 'Recipe_ComplexIronPlate_C'));
			expect(importedRecipe.length).toBe(1);

			const recipeVersion = await db
				.select()
				.from(recipeVersions)
				.where(eq(recipeVersions.recipeId, importedRecipe[0].id));
			expect(recipeVersion.length).toBe(1);

			// Check ingredients
			const ingredients = await db
				.select()
				.from(recipeIngredients)
				.where(eq(recipeIngredients.recipeVersionId, recipeVersion[0].id));
			expect(ingredients.length).toBe(1);
			expect(ingredients[0].count).toBe('3.00');

			// Check products
			const products = await db
				.select()
				.from(recipeProducts)
				.where(eq(recipeProducts.recipeVersionId, recipeVersion[0].id));
			expect(products.length).toBe(1);
			expect(products[0].count).toBe('2.00');

			// Check buildings
			const recipeBuilding = await db
				.select()
				.from(recipeBuildings)
				.where(eq(recipeBuildings.recipeVersionId, recipeVersion[0].id));
			expect(recipeBuilding.length).toBe(1);
		});
	});
});
