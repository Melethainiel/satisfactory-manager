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
import { userService } from '../../../src/lib/server/services/userService';
import { createAuthHeaders } from '../../setup/auth-helpers';
import type { User } from '../../../src/lib/server/db/schema';

describe('/api/sites/[siteId]/production-instances', () => {
	let testGameId: string;
	let testSiteId: string;
	let testUserId: string;
	let testModuleId: string;
	let testModuleVersionId: string;
	let testBuildingVersionId: string;
	let testRecipeVersionId: string;
	let testItemVersionId: string;
	
	// Mock user for authentication
	const mockUser: User = {
		id: '123e4567-e89b-12d3-a456-426614174000', // Valid UUID for tests
		microsoftId: 'test-ms-id',
		displayName: 'Test User',
		email: 'test@example.com',
		createdAt: new Date(),
		updatedAt: new Date()
	};

	beforeEach(async () => {
		// Create test user in database first (or get existing)
		let dbUser = await userService.getByEmail(mockUser.email);
		if (!dbUser) {
			dbUser = await userService.create({
				microsoftId: mockUser.microsoftId,
				displayName: mockUser.displayName,
				email: mockUser.email
			});
		}
		// Update mockUser with the actual database ID
		mockUser.id = dbUser.id;
		
		// Create test module
		const module = await moduleService.create({
			name: 'Test Module',
			url: 'https://example.com/module',
			currentVersion: '1.0.0'
		});
		testModuleId = module.id;

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
		const site = await siteService.create({
			name: 'Test Site',
			gameId: testGameId
		});
		testSiteId = site.id;

		// Create test building with Somersloop support
		const building = await buildingService.createBuilding({
			moduleId: module.id, // Use the module ID, not version ID
			className: 'Build_ConstructorMk1_C',
			name: 'Constructor',
			type: 'Constructor'
		});

		const buildingVersion = await buildingService.addBuildingVersion(building.id, {
			moduleVersionId: testModuleVersionId,
			energyConsumption: 4.0,
			productionShardSlotSize: 1 // 1 Somersloop slot
		});
		testBuildingVersionId = buildingVersion.id;

		// Create test item
		const item = await itemService.createItem({
			moduleId: module.id, // Use the module ID, not version ID
			className: 'Desc_IronIngot_C',
			displayName: 'Iron Ingot', // Fixed: name -> displayName
			form: 'RF_SOLID'
		});

		const itemVersion = await itemService.addItemVersion(item.id, {
			moduleVersionId: testModuleVersionId,
			energyValue: 0.0,
			stackSize: 100
		});
		testItemVersionId = itemVersion.id;

		// Create test recipe
		const recipe = await recipeService.createRecipe({
			moduleId: module.id, // Use the module ID
			className: 'Recipe_IronIngot_C',
			displayName: 'Iron Ingot' // Fixed: name -> displayName
		});

		const recipeVersion = await recipeService.createRecipeVersion(
			recipe.id,
			{
				moduleVersionId: testModuleVersionId,
				manufacturingDuration: 2.0,
				isAlternate: false
			},
			[], // ingredients - empty for test
			[], // products - empty for test  
			[]  // buildings - empty for test
		);
		testRecipeVersionId = recipeVersion.id;
	});

	describe('POST /api/sites/[siteId]/production-instances', () => {
		it('should reject requests without authentication', async () => {
			const request = new Request('http://localhost:3000/api/sites/test-site/production-instances', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					buildingVersionId: testBuildingVersionId,
					recipeVersionId: testRecipeVersionId,
					buildingCount: 1,
					efficiencyRatio: 1.0,
					somersloopCount: 1
				})
			});

			const response = await POST({
				request,
				params: { siteId: testSiteId }
			} as any);

			expect(response.status).toBe(401);
		});

		it('should reject requests with insufficient permissions', async () => {
			// Create a user without site permissions
			const limitedUser = await userService.create({
				microsoftId: 'limited-ms-id',
				displayName: 'Limited User',
				email: `limited-${Date.now()}@example.com` // Unique email
			});

			const request = new Request('http://localhost:3000/api/sites/test-site/production-instances', {
				method: 'POST',
				headers: createAuthHeaders(mockUser.email, mockUser.displayName),
				body: JSON.stringify({
					buildingVersionId: testBuildingVersionId,
					recipeVersionId: testRecipeVersionId,
					buildingCount: 1,
					efficiencyRatio: 1.0,
					somersloopCount: 1
				})
			});

			const response = await POST({
				request,
				params: { siteId: 'unauthorized-site-id' }, // Different site ID
				locals: { user: limitedUser }
			} as any);

			// Should be 401 Unauthorized, 403 Forbidden or 404 Not Found
			expect([401, 403, 404]).toContain(response.status);
		});

		it('should create production instance with valid Somersloop count', async () => {
			const request = new Request('http://localhost:3000/api/sites/test-site/production-instances', {
				method: 'POST',
				headers: createAuthHeaders(mockUser.email, mockUser.displayName),
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
				params: { siteId: testSiteId }
			} as any);

			expect(response.status).toBe(201);
			const result = await response.json();
			expect(result.data.somersloopCount).toBe(1);
		});

		it('should create production instance with zero Somersloop count', async () => {
			const request = new Request('http://localhost:3000/api/sites/test-site/production-instances', {
				method: 'POST',
				headers: createAuthHeaders(mockUser.email, mockUser.displayName),
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
			} as any);

			expect(response.status).toBe(201);
			const result = await response.json();
			expect(result.data.somersloopCount).toBe(0);
		});




		it('should default somersloopCount to 0 if not provided', async () => {
			const request = new Request('http://localhost:3000/api/sites/test-site/production-instances', {
				method: 'POST',
				headers: createAuthHeaders(mockUser.email, mockUser.displayName),
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
			} as any);

			expect(response.status).toBe(201);
			const result = await response.json();
			expect(result.data.somersloopCount).toBe(0);
		});
	});

	describe('PATCH /api/sites/[siteId]/production-instances/[instanceId]', () => {
		let testInstanceId: string;

		beforeEach(async () => {
			// Create a test production instance
			const request = new Request('http://localhost:3000/api/sites/test-site/production-instances', {
				method: 'POST',
				headers: createAuthHeaders(mockUser.email, mockUser.displayName),
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
			} as any);

			const result = await response.json();
			testInstanceId = result.data.id;
		});

		it('should update Somersloop count within valid range', async () => {
			const request = new Request('http://localhost:3000/api/sites/test-site/production-instances/test-instance', {
				method: 'PATCH',
				headers: createAuthHeaders(mockUser.email, mockUser.displayName),
				body: JSON.stringify({
					somersloopCount: 1 // Valid: within building's 1 slot limit
				})
			});

			const response = await PATCH({
				request,
				params: { siteId: testSiteId, instanceId: testInstanceId },
			} as any);

			expect(response.status).toBe(200);
			const result = await response.json();
			expect(result.data.somersloopCount).toBe(1);
		});


		it('should allow reducing Somersloop count to zero', async () => {
			// First, set it to 1
			await PATCH({
				request: new Request('http://localhost:3000/api/sites/test-site/production-instances/test-instance', {
					method: 'PATCH',
					headers: createAuthHeaders(mockUser.email, mockUser.displayName),
					body: JSON.stringify({ somersloopCount: 1 })
				}),
				params: { siteId: testSiteId, instanceId: testInstanceId },
			} as any);

			// Then reduce to 0
			const request = new Request('http://localhost:3000/api/sites/test-site/production-instances/test-instance', {
				method: 'PATCH',
				headers: createAuthHeaders(mockUser.email, mockUser.displayName),
				body: JSON.stringify({
					somersloopCount: 0
				})
			});

			const response = await PATCH({
				request,
				params: { siteId: testSiteId, instanceId: testInstanceId },
			} as any);

			expect(response.status).toBe(200);
			const result = await response.json();
			expect(result.data.somersloopCount).toBe(0);
		});
	});

	describe('Edge Cases and Boundary Values', () => {
		it('should handle buildings with maximum Somersloop slots', async () => {
			// Create building with maximum slots (Manufacturer has 4)
			const maxSlotBuilding = await buildingService.createBuilding({
				moduleId: testModuleId,
				className: 'Build_ManufacturerMk1_C',
				name: 'Manufacturer',
				type: 'Constructor'
			});

			const maxSlotBuildingVersion = await buildingService.addBuildingVersion(maxSlotBuilding.id, {
				moduleVersionId: testModuleVersionId,
				energyConsumption: 55.0,
				productionShardSlotSize: 4 // Maximum known slots
			});

			const request = new Request('http://localhost:3000/api/sites/test-site/production-instances', {
				method: 'POST',
				headers: createAuthHeaders(mockUser.email, mockUser.displayName),
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
			} as any);

			expect(response.status).toBe(201);
			const result = await response.json();
			expect(result.data.somersloopCount).toBe(4);
		});

	});
});