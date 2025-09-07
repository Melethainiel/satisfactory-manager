/**
 * Production Instances API Integration Tests
 * Tests Somersloop validation and API endpoints
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../../src/routes/api/sites/[siteId]/production-instances/+server';
import { PATCH, DELETE } from '../../../src/routes/api/sites/[siteId]/production-instances/[instanceId]/+server';
import { gameService } from '../../../src/lib/server/services/gameService';
import { siteService } from '../../../src/lib/server/services/siteService';
import { moduleService } from '../../../src/lib/server/services/moduleService';
import { buildingService } from '../../../src/lib/server/services/buildingService';
import { itemService } from '../../../src/lib/server/services/itemService';
import { recipeService } from '../../../src/lib/server/services/recipeService';
import type { User } from '../../../src/lib/server/db/schema';

describe('/api/sites/[siteId]/production-instances', () => {
	let testGameId: string;
	let testSiteId: string;
	let testUserId: string;
	let testModuleVersionId: string;
	let testBuildingVersionId: string;
	let testRecipeVersionId: string;
	let testItemVersionId: string;
	
	// Mock user for authentication
	const mockUser: User = {
		id: 'test-user-id',
		microsoftId: 'test-ms-id',
		displayName: 'Test User',
		email: 'test@example.com',
		createdAt: new Date(),
		updatedAt: new Date()
	};

	beforeEach(async () => {
		// Create test module
		const module = await moduleService.create({
			name: 'Test Module',
			url: 'https://example.com/module',
			currentVersion: '1.0.0'
		});

		const moduleVersion = await moduleService.addVersion(module.id, {
			version: '1.0.0',
			releaseUrl: 'https://example.com/module/1.0.0'
		});
		testModuleVersionId = moduleVersion.id;

		// Create test game
		const game = await gameService.createGame(
			'Test Game',
			'A test game for Somersloop testing',
			mockUser
		);
		testGameId = game.id;
		testUserId = mockUser.id;

		// Create test site
		const site = await siteService.createSite(testGameId, 'Test Site', 'Test site description');
		testSiteId = site.id;

		// Create test building with Somersloop support
		const building = await buildingService.createBuilding({
			className: 'Build_ConstructorMk1_C',
			name: 'Constructor'
		});

		const buildingVersion = await buildingService.createBuildingVersion({
			buildingId: building.id,
			moduleVersionId: testModuleVersionId,
			energyConsumption: 4.0,
			productionShardSlotSize: 1 // 1 Somersloop slot
		});
		testBuildingVersionId = buildingVersion.id;

		// Create test item
		const item = await itemService.createItem({
			className: 'Desc_IronIngot_C',
			name: 'Iron Ingot',
			form: 'RF_SOLID'
		});

		const itemVersion = await itemService.createItemVersion({
			itemId: item.id,
			moduleVersionId: testModuleVersionId,
			energyValue: 0.0,
			stackSize: 100
		});
		testItemVersionId = itemVersion.id;

		// Create test recipe
		const recipe = await recipeService.createRecipe({
			className: 'Recipe_IronIngot_C',
			name: 'Iron Ingot'
		});

		const recipeVersion = await recipeService.createRecipeVersion({
			recipeId: recipe.id,
			moduleVersionId: testModuleVersionId,
			manufacturingDuration: 2.0,
			isAlternate: false
		});
		testRecipeVersionId = recipeVersion.id;
	});

	describe('POST /api/sites/[siteId]/production-instances', () => {
		it('should create production instance with valid Somersloop count', async () => {
			const request = new Request('http://localhost:3000/api/sites/test-site/production-instances', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					buildingVersionId: testBuildingVersionId,
					recipeVersionId: testRecipeVersionId,
					buildingCount: 1,
					efficiencyRatio: 1.0,
					somersloopCount: 1, // Valid: within building's slot limit
					isBuilt: false
				})
			});

			const response = await POST({
				request,
				params: { siteId: testSiteId },
				locals: { user: mockUser }
			} as any);

			expect(response.status).toBe(201);
			const result = await response.json();
			expect(result.somersloopCount).toBe(1);
		});

		it('should create production instance with zero Somersloop count', async () => {
			const request = new Request('http://localhost:3000/api/sites/test-site/production-instances', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					buildingVersionId: testBuildingVersionId,
					recipeVersionId: testRecipeVersionId,
					buildingCount: 1,
					efficiencyRatio: 1.0,
					somersloopCount: 0, // Valid: no Somersloop used
					isBuilt: false
				})
			});

			const response = await POST({
				request,
				params: { siteId: testSiteId },
				locals: { user: mockUser }
			} as any);

			expect(response.status).toBe(201);
			const result = await response.json();
			expect(result.somersloopCount).toBe(0);
		});

		it('should reject negative Somersloop count', async () => {
			const request = new Request('http://localhost:3000/api/sites/test-site/production-instances', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					buildingVersionId: testBuildingVersionId,
					recipeVersionId: testRecipeVersionId,
					buildingCount: 1,
					efficiencyRatio: 1.0,
					somersloopCount: -1, // Invalid: negative value
					isBuilt: false
				})
			});

			const response = await POST({
				request,
				params: { siteId: testSiteId },
				locals: { user: mockUser }
			} as any);

			expect(response.status).toBe(400);
			const result = await response.json();
			expect(result.error).toContain('somersloopCount');
		});

		it('should reject Somersloop count exceeding building slot size', async () => {
			const request = new Request('http://localhost:3000/api/sites/test-site/production-instances', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					buildingVersionId: testBuildingVersionId,
					recipeVersionId: testRecipeVersionId,
					buildingCount: 1,
					efficiencyRatio: 1.0,
					somersloopCount: 2, // Invalid: exceeds building's 1 slot limit
					isBuilt: false
				})
			});

			const response = await POST({
				request,
				params: { siteId: testSiteId },
				locals: { user: mockUser }
			} as any);

			expect(response.status).toBe(400);
			const result = await response.json();
			expect(result.error).toContain('exceeds maximum slots');
		});

		it('should handle buildings without Somersloop support', async () => {
			// Create building without Somersloop support
			const noSomersloopBuilding = await buildingService.createBuilding({
				className: 'Build_SmelterMk1_C',
				name: 'Smelter'
			});

			const noSomersloopBuildingVersion = await buildingService.createBuildingVersion({
				buildingId: noSomersloopBuilding.id,
				moduleVersionId: testModuleVersionId,
				energyConsumption: 4.0,
				productionShardSlotSize: 0 // No Somersloop support
			});

			const request = new Request('http://localhost:3000/api/sites/test-site/production-instances', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					buildingVersionId: noSomersloopBuildingVersion.id,
					recipeVersionId: testRecipeVersionId,
					buildingCount: 1,
					efficiencyRatio: 1.0,
					somersloopCount: 1, // Invalid: building doesn't support Somersloop
					isBuilt: false
				})
			});

			const response = await POST({
				request,
				params: { siteId: testSiteId },
				locals: { user: mockUser }
			} as any);

			expect(response.status).toBe(400);
			const result = await response.json();
			expect(result.error).toContain('does not support Somersloop');
		});

		it('should default somersloopCount to 0 if not provided', async () => {
			const request = new Request('http://localhost:3000/api/sites/test-site/production-instances', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					buildingVersionId: testBuildingVersionId,
					recipeVersionId: testRecipeVersionId,
					buildingCount: 1,
					efficiencyRatio: 1.0,
					isBuilt: false
					// somersloopCount not provided - should default to 0
				})
			});

			const response = await POST({
				request,
				params: { siteId: testSiteId },
				locals: { user: mockUser }
			} as any);

			expect(response.status).toBe(201);
			const result = await response.json();
			expect(result.somersloopCount).toBe(0);
		});
	});

	describe('PATCH /api/sites/[siteId]/production-instances/[instanceId]', () => {
		let testInstanceId: string;

		beforeEach(async () => {
			// Create a test production instance
			const request = new Request('http://localhost:3000/api/sites/test-site/production-instances', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					buildingVersionId: testBuildingVersionId,
					recipeVersionId: testRecipeVersionId,
					buildingCount: 1,
					efficiencyRatio: 1.0,
					somersloopCount: 0,
					isBuilt: false
				})
			});

			const response = await POST({
				request,
				params: { siteId: testSiteId },
				locals: { user: mockUser }
			} as any);

			const result = await response.json();
			testInstanceId = result.id;
		});

		it('should update Somersloop count within valid range', async () => {
			const request = new Request('http://localhost:3000/api/sites/test-site/production-instances/test-instance', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					somersloopCount: 1 // Valid: within building's 1 slot limit
				})
			});

			const response = await PATCH({
				request,
				params: { siteId: testSiteId, instanceId: testInstanceId },
				locals: { user: mockUser }
			} as any);

			expect(response.status).toBe(200);
			const result = await response.json();
			expect(result.somersloopCount).toBe(1);
		});

		it('should reject updating Somersloop count beyond building limits', async () => {
			const request = new Request('http://localhost:3000/api/sites/test-site/production-instances/test-instance', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					somersloopCount: 5 // Invalid: exceeds building's 1 slot limit
				})
			});

			const response = await PATCH({
				request,
				params: { siteId: testSiteId, instanceId: testInstanceId },
				locals: { user: mockUser }
			} as any);

			expect(response.status).toBe(400);
			const result = await response.json();
			expect(result.error).toContain('exceeds maximum slots');
		});

		it('should allow reducing Somersloop count to zero', async () => {
			// First, set it to 1
			await PATCH({
				request: new Request('http://localhost:3000/api/sites/test-site/production-instances/test-instance', {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ somersloopCount: 1 })
				}),
				params: { siteId: testSiteId, instanceId: testInstanceId },
				locals: { user: mockUser }
			} as any);

			// Then reduce to 0
			const request = new Request('http://localhost:3000/api/sites/test-site/production-instances/test-instance', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					somersloopCount: 0
				})
			});

			const response = await PATCH({
				request,
				params: { siteId: testSiteId, instanceId: testInstanceId },
				locals: { user: mockUser }
			} as any);

			expect(response.status).toBe(200);
			const result = await response.json();
			expect(result.somersloopCount).toBe(0);
		});
	});

	describe('Edge Cases and Boundary Values', () => {
		it('should handle buildings with maximum Somersloop slots', async () => {
			// Create building with maximum slots (Manufacturer has 4)
			const maxSlotBuilding = await buildingService.createBuilding({
				className: 'Build_ManufacturerMk1_C',
				name: 'Manufacturer'
			});

			const maxSlotBuildingVersion = await buildingService.createBuildingVersion({
				buildingId: maxSlotBuilding.id,
				moduleVersionId: testModuleVersionId,
				energyConsumption: 55.0,
				productionShardSlotSize: 4 // Maximum known slots
			});

			const request = new Request('http://localhost:3000/api/sites/test-site/production-instances', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					buildingVersionId: maxSlotBuildingVersion.id,
					recipeVersionId: testRecipeVersionId,
					buildingCount: 1,
					efficiencyRatio: 1.0,
					somersloopCount: 4, // Maximum slots filled
					isBuilt: false
				})
			});

			const response = await POST({
				request,
				params: { siteId: testSiteId },
				locals: { user: mockUser }
			} as any);

			expect(response.status).toBe(201);
			const result = await response.json();
			expect(result.somersloopCount).toBe(4);
		});

		it('should reject float values for Somersloop count', async () => {
			const request = new Request('http://localhost:3000/api/sites/test-site/production-instances', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					buildingVersionId: testBuildingVersionId,
					recipeVersionId: testRecipeVersionId,
					buildingCount: 1,
					efficiencyRatio: 1.0,
					somersloopCount: 1.5, // Invalid: fractional Somersloop count
					isBuilt: false
				})
			});

			const response = await POST({
				request,
				params: { siteId: testSiteId },
				locals: { user: mockUser }
			} as any);

			expect(response.status).toBe(400);
			const result = await response.json();
			expect(result.error).toContain('must be an integer');
		});

		it('should reject string values for Somersloop count', async () => {
			const request = new Request('http://localhost:3000/api/sites/test-site/production-instances', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					buildingVersionId: testBuildingVersionId,
					recipeVersionId: testRecipeVersionId,
					buildingCount: 1,
					efficiencyRatio: 1.0,
					somersloopCount: "invalid", // Invalid: string value
					isBuilt: false
				})
			});

			const response = await POST({
				request,
				params: { siteId: testSiteId },
				locals: { user: mockUser }
			} as any);

			expect(response.status).toBe(400);
			const result = await response.json();
			expect(result.error).toContain('Expected number');
		});
	});
});