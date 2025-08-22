import { expect } from 'vitest';
import { getTestDb } from './test-db';
import {
	users,
	games,
	userGames,
	modules,
	moduleVersions,
	items,
	buildings,
	recipes
} from '../../src/lib/server/db/schema';
import {
	testUsers,
	testGames,
	testModules,
	testModuleVersions,
	testItems,
	testBuildings,
	testRecipes
} from './fixtures';
import type { GameUserRole } from '../../src/lib/server/db/schema';

/**
 * Creates a complete test environment with users, games, modules, and permissions
 */
export async function createTestEnvironment() {
	const db = getTestDb();

	// Create users
	const createdUsers = await db.insert(users).values(testUsers).returning();

	// Create games
	const createdGames = await db.insert(games).values(testGames).returning();

	// Create modules
	const createdModules = await db.insert(modules).values(testModules).returning();

	// Create module versions
	const moduleVersionData = createdModules.flatMap((module) => testModuleVersions(module.id));
	const createdModuleVersions = await db
		.insert(moduleVersions)
		.values(moduleVersionData)
		.returning();

	// Create basic items, buildings, and recipes
	const createdItems = await db.insert(items).values(testItems).returning();
	const createdBuildings = await db.insert(buildings).values(testBuildings).returning();
	const createdRecipes = await db.insert(recipes).values(testRecipes).returning();

	// Set up user-game relationships with different roles
	await db.insert(userGames).values([
		{ userId: createdUsers[0].id, gameId: createdGames[0].id, role: 'Owner' },
		{ userId: createdUsers[1].id, gameId: createdGames[0].id, role: 'Administrator' },
		{ userId: createdUsers[2].id, gameId: createdGames[0].id, role: 'Contributor' },
		{ userId: createdUsers[3].id, gameId: createdGames[1].id, role: 'Reader' },
		{ userId: createdUsers[0].id, gameId: createdGames[2].id, role: 'Owner' } // Private game
	]);

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
	const db = getTestDb();

	const userData = {
		displayName: `${role} Test User`,
		email: `${role.toLowerCase()}@test.com`
	};

	const [user] = await db.insert(users).values(userData).returning();
	await db.insert(userGames).values({ userId: user.id, gameId, role });

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
	const db = getTestDb();

	// Create module and multiple versions
	const [module] = await db
		.insert(modules)
		.values({
			name: 'Versioned Test Module',
			url: 'https://github.com/test/versioned-module',
			currentVersion: '1.0.0',
			githubRepo: 'test/versioned-module'
		})
		.returning();

	const versions = await db
		.insert(moduleVersions)
		.values(testModuleVersions(module.id))
		.returning();

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
 * Helper for cleanup after complex tests
 */
export async function cleanupTestData() {
	const db = getTestDb();

	// Clean up in reverse order due to foreign key constraints
	await db.delete(userGames);
	await db.delete(users);
	await db.delete(games);
	await db.delete(moduleVersions);
	await db.delete(modules);
	await db.delete(items);
	await db.delete(buildings);
	await db.delete(recipes);
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
