/**
 * Test Data Helpers for Integration Tests
 * 
 * This module provides optimized helpers for creating test data
 * and reducing redundant database operations in integration tests.
 */

import { moduleService } from '../../src/lib/server/services/moduleService';
import { buildingService } from '../../src/lib/server/services/buildingService';
import { itemService } from '../../src/lib/server/services/itemService';
import { recipeService } from '../../src/lib/server/services/recipeService';
import { gameService } from '../../src/lib/server/services/gameService';
import { siteService } from '../../src/lib/server/services/siteService';
import type { User } from '../../src/lib/server/db/schema';

/**
 * Shared test data that can be reused across test suites
 */
export interface TestDataFixture {
	moduleId: string;
	moduleVersionId: string;
	gameId: string;
	siteId: string;
	userId: string;
	
	// Buildings
	constructorBuildingVersionId: string; // 1 Somersloop slot
	manufacturerBuildingVersionId: string; // 4 Somersloop slots  
	smelterBuildingVersionId: string; // 0 Somersloop slots
	
	// Items and recipes
	itemVersionId: string;
	recipeVersionId: string;
}

/**
 * Mock users for different permission scenarios
 */
export const mockUsers = {
	admin: {
		id: 'admin-user-id',
		microsoftId: 'admin-ms-id',
		displayName: 'Admin User',
		email: 'admin@example.com',
		createdAt: new Date(),
		updatedAt: new Date()
	} as User,
	
	contributor: {
		id: 'contributor-user-id', 
		microsoftId: 'contributor-ms-id',
		displayName: 'Contributor User',
		email: 'contributor@example.com',
		createdAt: new Date(),
		updatedAt: new Date()
	} as User,
	
	reader: {
		id: 'reader-user-id',
		microsoftId: 'reader-ms-id', 
		displayName: 'Reader User',
		email: 'reader@example.com',
		createdAt: new Date(),
		updatedAt: new Date()
	} as User,
	
	unauthorized: {
		id: 'unauthorized-user-id',
		microsoftId: 'unauthorized-ms-id',
		displayName: 'Unauthorized User', 
		email: 'unauthorized@example.com',
		createdAt: new Date(),
		updatedAt: new Date()
	} as User
};

/**
 * Creates a complete test data fixture with all necessary entities
 * This should be called once per test suite in beforeAll()
 */
export async function createTestDataFixture(testSuffix: string = ''): Promise<TestDataFixture> {
	// Create module
	const module = await moduleService.create({
		name: `Test Module ${testSuffix}`,
		url: `https://example.com/module${testSuffix}`,
		currentVersion: '1.0.0'
	});

	const moduleVersion = await moduleService.addVersion(module.id, {
		version: '1.0.0',
		releaseUrl: `https://example.com/module${testSuffix}/1.0.0`
	});

	// Create game and site
	const game = await gameService.createGame(
		`Test Game ${testSuffix}`,
		`Test game for Somersloop testing ${testSuffix}`,
		mockUsers.admin
	);

	const site = await siteService.createSite(
		game.id, 
		`Test Site ${testSuffix}`, 
		`Test site description ${testSuffix}`
	);

	// Create buildings with different Somersloop configurations
	const constructorBuilding = await buildingService.createBuilding({
		className: `Build_ConstructorMk1${testSuffix}_C`,
		name: `Constructor ${testSuffix}`
	});

	const constructorBuildingVersion = await buildingService.createBuildingVersion({
		buildingId: constructorBuilding.id,
		moduleVersionId: moduleVersion.id,
		energyConsumption: 4.0,
		productionShardSlotSize: 1 // 1 Somersloop slot
	});

	const manufacturerBuilding = await buildingService.createBuilding({
		className: `Build_ManufacturerMk1${testSuffix}_C`,
		name: `Manufacturer ${testSuffix}`
	});

	const manufacturerBuildingVersion = await buildingService.createBuildingVersion({
		buildingId: manufacturerBuilding.id,
		moduleVersionId: moduleVersion.id,
		energyConsumption: 55.0,
		productionShardSlotSize: 4 // 4 Somersloop slots
	});

	const smelterBuilding = await buildingService.createBuilding({
		className: `Build_SmelterMk1${testSuffix}_C`,
		name: `Smelter ${testSuffix}`
	});

	const smelterBuildingVersion = await buildingService.createBuildingVersion({
		buildingId: smelterBuilding.id,
		moduleVersionId: moduleVersion.id,
		energyConsumption: 4.0,
		productionShardSlotSize: 0 // No Somersloop support
	});

	// Create item
	const item = await itemService.createItem({
		className: `Desc_IronIngot${testSuffix}_C`,
		name: `Iron Ingot ${testSuffix}`,
		form: 'RF_SOLID'
	});

	const itemVersion = await itemService.createItemVersion({
		itemId: item.id,
		moduleVersionId: moduleVersion.id,
		energyValue: 0.0,
		stackSize: 100
	});

	// Create recipe
	const recipe = await recipeService.createRecipe({
		className: `Recipe_IronIngot${testSuffix}_C`,
		name: `Iron Ingot ${testSuffix}`
	});

	const recipeVersion = await recipeService.createRecipeVersion({
		recipeId: recipe.id,
		moduleVersionId: moduleVersion.id,
		manufacturingDuration: 2.0,
		isAlternate: false
	});

	return {
		moduleId: module.id,
		moduleVersionId: moduleVersion.id,
		gameId: game.id,
		siteId: site.id,
		userId: mockUsers.admin.id,
		constructorBuildingVersionId: constructorBuildingVersion.id,
		manufacturerBuildingVersionId: manufacturerBuildingVersion.id,
		smelterBuildingVersionId: smelterBuildingVersion.id,
		itemVersionId: itemVersion.id,
		recipeVersionId: recipeVersion.id
	};
}

/**
 * Creates a production instance request body with common defaults
 */
export function createProductionInstanceRequest(
	fixture: TestDataFixture,
	overrides: Partial<{
		buildingVersionId: string;
		recipeVersionId: string;
		buildingCount: number;
		efficiencyRatio: number;
		somersloopCount: number;
		isBuilt: boolean;
	}> = {}
) {
	return {
		buildingVersionId: fixture.constructorBuildingVersionId,
		recipeVersionId: fixture.recipeVersionId,
		buildingCount: 1,
		efficiencyRatio: 1.0,
		somersloopCount: 0,
		isBuilt: false,
		...overrides
	};
}

/**
 * Creates a Request object for API testing
 */
export function createApiRequest(
	url: string,
	method: string = 'GET',
	body?: any,
	headers: Record<string, string> = {}
): Request {
	const defaultHeaders = {
		'Content-Type': 'application/json',
		...headers
	};

	const init: RequestInit = {
		method,
		headers: defaultHeaders
	};

	if (body && method !== 'GET') {
		init.body = JSON.stringify(body);
	}

	return new Request(url, init);
}

/**
 * Creates request context for API handlers
 */
export function createRequestContext(
	params: Record<string, string>,
	user?: User
) {
	return {
		request: {} as Request, // Will be overridden
		params,
		locals: user ? { user } : {},
		url: new URL('http://localhost:3000')
	};
}

/**
 * Common test scenarios for Somersloop validation
 */
export const somersloopTestScenarios = [
	{
		name: 'valid zero Somersloop',
		somersloopCount: 0,
		buildingSlots: 1,
		shouldPass: true
	},
	{
		name: 'valid single Somersloop in Constructor',
		somersloopCount: 1,
		buildingSlots: 1,
		shouldPass: true
	},
	{
		name: 'valid partial Manufacturer Somersloop',
		somersloopCount: 2,
		buildingSlots: 4,
		shouldPass: true
	},
	{
		name: 'valid full Manufacturer Somersloop',
		somersloopCount: 4,
		buildingSlots: 4,
		shouldPass: true
	},
	{
		name: 'invalid negative Somersloop',
		somersloopCount: -1,
		buildingSlots: 1,
		shouldPass: false,
		expectedError: 'somersloopCount must be a non-negative integer'
	},
	{
		name: 'invalid exceeding slots',
		somersloopCount: 2,
		buildingSlots: 1,
		shouldPass: false,
		expectedError: 'somersloopCount (2) exceeds building maximum slots (1)'
	},
	{
		name: 'invalid float value',
		somersloopCount: 1.5,
		buildingSlots: 4,
		shouldPass: false,
		expectedError: 'somersloopCount must be an integer'
	}
];

/**
 * Cleanup function to be called in afterAll()
 */
export async function cleanupTestData(fixture: TestDataFixture): Promise<void> {
	// In a real implementation, you might want to clean up test data
	// For now, we rely on the test database being reset between test runs
	console.log(`Cleanup for test fixture with game ID: ${fixture.gameId}`);
}