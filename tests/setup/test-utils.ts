import { expect } from 'vitest';
// removed unused getTestDb import
import {
	testBuildings,
	testGames,
	testItems,
	testModuleVersions,
	testModules,
	testRecipes,
	testUsers
} from './fixtures';
import type { GameUserRole } from '../../src/lib/server/db/schema';
import { userService } from '../../src/lib/server/services/userService';
import { gameService } from '../../src/lib/server/services/gameService';
import { moduleService } from '../../src/lib/server/services/moduleService';
import { itemService } from '../../src/lib/server/services/itemService';
import { buildingService } from '../../src/lib/server/services/buildingService';
import { recipeService } from '../../src/lib/server/services/recipeService';

/**
 * Creates a complete test environment with users, games, modules, and permissions
 */
export async function createTestEnvironment() {
	// Create users using service with unique emails
	const timestamp = Date.now();
	const createdUsers = await Promise.all(
		testUsers.map((user, index) =>
			userService.create({
				...user,
				email: `${user.email.replace('@example.com', '')}-${timestamp}-${index}@example.com`
			})
		)
	);

	// Create games using service with unique names
	const createdGames = await Promise.all(
		testGames.map((game, index) =>
			gameService.create({
				...game,
				name: `${game.name} ${timestamp}-${index}`
			})
		)
	);

	// Create modules using service with unique names and URLs
	const createdModules = await Promise.all(
		testModules.map((module, index) =>
			moduleService.create({
				...module,
				name: `${module.name} ${timestamp}-${index}`,
				url: `${module.url}-${timestamp}-${index}`,
				githubRepo: module.githubRepo ? `${module.githubRepo}-${timestamp}-${index}` : null
			})
		)
	);

	// Create module versions using service
	const createdModuleVersions = [];
	for (const module of createdModules) {
		const versions = testModuleVersions(module.id);
		for (const versionData of versions) {
			const version = await moduleService.addVersion(module.id, versionData);
			createdModuleVersions.push(version);
		}
	}

	// Create basic items, buildings, and recipes using first module
	const firstModuleId = createdModules[0].id;
	const createdItems = await Promise.all(
		testItems(firstModuleId).map((item) => itemService.createItem(item))
	);
	const createdBuildings = await Promise.all(
		testBuildings(firstModuleId).map((building) => buildingService.createBuilding(building))
	);
	const createdRecipes = await Promise.all(
		testRecipes(firstModuleId).map((recipe) => recipeService.createRecipe(recipe))
	);

	// Set up user-game relationships with different roles using service
	await gameService.addUser(createdGames[0].id, createdUsers[0].id, 'Owner');
	await gameService.addUser(createdGames[0].id, createdUsers[1].id, 'Administrator');
	await gameService.addUser(createdGames[0].id, createdUsers[2].id, 'Contributor');
	await gameService.addUser(createdGames[1].id, createdUsers[3].id, 'Reader');
	await gameService.addUser(createdGames[2].id, createdUsers[0].id, 'Owner'); // Private game

	return {
		users: createdUsers,
		games: createdGames,
		modules: createdModules,
		moduleVersions: createdModuleVersions,
		items: createdItems,
		buildings: createdBuildings,
		recipes: createdRecipes
	};
}

/**
 * Creates a user with a specific role in a game for testing role-based access
 */
export async function createUserWithRole(gameId: string, role: GameUserRole) {
	const userData = {
		displayName: `${role} Test User`,
		email: `${role.toLowerCase()}-${Date.now()}@test.com` // Unique email to avoid conflicts
	};

	const user = await userService.create(userData);
	await gameService.addUser(gameId, user.id, role);

	return user;
}

/**
 * Simulates an authenticated request with user context
 */
export function createMockAuthenticatedRequest(
	method: string,
	url: string,
	body?: any,
	userId?: string
) {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json'
	};

	if (userId) {
		// In a real app, this would be a JWT token or session
		headers['x-user-id'] = userId;
	}

	return new Request(url, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined
	});
}

/**
 * Helper to create request handlers with user context
 */
export function createRequestWithParams(
	url: string,
	params: Record<string, string>,
	method = 'GET',
	body?: any
) {
	return {
		request: new Request(url, {
			method,
			headers: { 'Content-Type': 'application/json' },
			body: body ? JSON.stringify(body) : undefined
		}),
		params,
		url: new URL(url)
	} as any;
}

/**
 * Validates API response structure for list endpoints
 */
export function validateListResponse(data: any) {
	expect(Array.isArray(data)).toBe(true);
	if (data.length > 0) {
		expect(data[0]).toHaveProperty('id');
	}
}

/**
 * Validates API response structure for single resource endpoints
 */
export function validateResourceResponse(data: any, expectedFields: string[]) {
	for (const field of expectedFields) {
		expect(data).toHaveProperty(field);
	}
	expect(data).toHaveProperty('id');
}

/**
 * Validates import/export response structure
 */
export function validateImportExportResponse(data: any) {
	expect(data).toHaveProperty('created');
	expect(data).toHaveProperty('updated');
	expect(data).toHaveProperty('errors');
	expect(typeof data.created).toBe('number');
	expect(typeof data.updated).toBe('number');
	expect(Array.isArray(data.errors)).toBe(true);
}

/**
 * Creates test data for version management testing
 */
export async function createVersionedTestData() {
	// Create module using service
	const module = await moduleService.create({
		name: 'Versioned Test Module',
		url: 'https://github.com/test/versioned-module',
		currentVersion: '1.0.0',
		githubRepo: 'test/versioned-module'
	});

	// Create versions using service
	const versions = [];
	const versionData = testModuleVersions(module.id);
	for (const version of versionData) {
		const createdVersion = await moduleService.addVersion(module.id, version);
		versions.push(createdVersion);
	}

	return { module, versions };
}

/**
 * Tests rate limiting behavior (for future implementation)
 */
export async function testRateLimit(endpoint: string, limit: number = 100) {
	const requests = Array.from({ length: limit + 1 }, () => fetch(`http://localhost${endpoint}`));

	const responses = await Promise.all(requests);
	const lastResponse = responses[responses.length - 1];

	// This would check for 429 status in a real rate-limited system
	return lastResponse.status;
}

/**
 * Helper for testing pagination
 */
export function createPaginatedRequest(baseUrl: string, page: number = 1, limit: number = 10) {
	const url = new URL(baseUrl);
	url.searchParams.set('page', page.toString());
	url.searchParams.set('limit', limit.toString());

	return new Request(url.toString());
}

/**
 * Helper for testing search functionality
 */
export function createSearchRequest(
	baseUrl: string,
	query: string,
	filters: Record<string, string> = {}
) {
	const url = new URL(baseUrl);
	url.searchParams.set('search', query);

	Object.entries(filters).forEach(([key, value]) => {
		url.searchParams.set(key, value);
	});

	return new Request(url.toString());
}

/**
 * Helper for cleanup after complex tests - now handled by test-db.ts
 */
export async function cleanupTestData() {
	// Cleanup is now handled centrally by the test setup in test-db.ts
	// This function is kept for backward compatibility but does nothing
}

/**
 * Creates test data for relationship testing between entities
 */
export async function createRelatedTestData() {
	const {
		users: testUsersData,
		games: testGamesData,
		modules: testModulesData,
		moduleVersions: testModuleVersionsData
	} = await createTestEnvironment();

	// Return IDs for easy reference in tests
	return {
		userId: testUsersData[0].id,
		gameId: testGamesData[0].id,
		moduleId: testModulesData[0].id,
		moduleVersionId: testModuleVersionsData[0].id,
		adminUserId: testUsersData[1].id,
		contributorUserId: testUsersData[2].id,
		readerUserId: testUsersData[3].id
	};
}
