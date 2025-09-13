/**
 * Optimized Production Instances API Integration Tests
 * 
 * This is an example of how to use the test helpers to reduce duplication
 * and optimize database setup for integration tests.
 */

import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { POST } from '../../../src/routes/api/sites/[siteId]/production-instances/+server';
import { PATCH } from '../../../src/routes/api/sites/[siteId]/production-instances/[instanceId]/+server';
import { 
	createTestDataFixture,
	cleanupTestData,
	createProductionInstanceRequest,
	createApiRequest,
	createRequestContext,
	mockUsers,
	somersloopTestScenarios,
	type TestDataFixture
} from '../../utils/testDataHelpers';

describe('/api/sites/[siteId]/production-instances (Optimized)', () => {
	let fixture: TestDataFixture;

	// Setup shared test data once for all tests in this suite
	beforeAll(async () => {
		fixture = await createTestDataFixture('optimized');
	});

	afterAll(async () => {
		await cleanupTestData(fixture);
	});

	describe('Authentication and Authorization', () => {
		it('should reject requests without authentication', async () => {
			const request = createApiRequest(
				`http://localhost:3000/api/sites/${fixture.siteId}/production-instances`,
				'POST',
				createProductionInstanceRequest(fixture, { somersloopCount: 1 })
			);

			const context = createRequestContext({ siteId: fixture.siteId }); // No user
			const response = await POST({ ...context, request } as any);

			expect(response.status).toBe(401);
		});

		it('should reject requests with insufficient permissions', async () => {
			const request = createApiRequest(
				`http://localhost:3000/api/sites/unauthorized-site/production-instances`,
				'POST',
				createProductionInstanceRequest(fixture, { somersloopCount: 1 })
			);

			const context = createRequestContext(
				{ siteId: 'unauthorized-site' }, 
				mockUsers.unauthorized
			);
			const response = await POST({ ...context, request } as any);

			expect([403, 404]).toContain(response.status);
		});
	});

	describe('Somersloop Validation', () => {
		// Test all scenarios using the shared test data
		somersloopTestScenarios.forEach(scenario => {
			it(`should handle ${scenario.name}`, async () => {
				// Use appropriate building based on slot requirements
				const buildingVersionId = scenario.buildingSlots === 1 
					? fixture.constructorBuildingVersionId
					: scenario.buildingSlots === 4 
					? fixture.manufacturerBuildingVersionId
					: fixture.smelterBuildingVersionId;

				const request = createApiRequest(
					`http://localhost:3000/api/sites/${fixture.siteId}/production-instances`,
					'POST',
					createProductionInstanceRequest(fixture, {
						buildingVersionId,
						somersloopCount: scenario.somersloopCount
					})
				);

				const context = createRequestContext(
					{ siteId: fixture.siteId },
					mockUsers.admin
				);
				const response = await POST({ ...context, request } as any);

				if (scenario.shouldPass) {
					expect(response.status).toBe(201);
					const result = await response.json();
					expect(result.somersloopCount).toBe(scenario.somersloopCount);
				} else {
					expect(response.status).toBe(400);
					const result = await response.json();
					if (scenario.expectedError) {
						expect(result.error).toBe(scenario.expectedError);
					}
				}
			});
		});
	});

	describe('Building-Specific Behavior', () => {
		it('should handle Constructor (1 slot) correctly', async () => {
			const request = createApiRequest(
				`http://localhost:3000/api/sites/${fixture.siteId}/production-instances`,
				'POST',
				createProductionInstanceRequest(fixture, {
					buildingVersionId: fixture.constructorBuildingVersionId,
					somersloopCount: 1
				})
			);

			const context = createRequestContext({ siteId: fixture.siteId }, mockUsers.admin);
			const response = await POST({ ...context, request } as any);

			expect(response.status).toBe(201);
			const result = await response.json();
			expect(result.somersloopCount).toBe(1);
		});

		it('should handle Manufacturer (4 slots) correctly', async () => {
			const request = createApiRequest(
				`http://localhost:3000/api/sites/${fixture.siteId}/production-instances`,
				'POST',
				createProductionInstanceRequest(fixture, {
					buildingVersionId: fixture.manufacturerBuildingVersionId,
					somersloopCount: 4
				})
			);

			const context = createRequestContext({ siteId: fixture.siteId }, mockUsers.admin);
			const response = await POST({ ...context, request } as any);

			expect(response.status).toBe(201);
			const result = await response.json();
			expect(result.somersloopCount).toBe(4);
		});

		it('should reject Somersloop on buildings without support', async () => {
			const request = createApiRequest(
				`http://localhost:3000/api/sites/${fixture.siteId}/production-instances`,
				'POST',
				createProductionInstanceRequest(fixture, {
					buildingVersionId: fixture.smelterBuildingVersionId,
					somersloopCount: 1
				})
			);

			const context = createRequestContext({ siteId: fixture.siteId }, mockUsers.admin);
			const response = await POST({ ...context, request } as any);

			expect(response.status).toBe(400);
			const result = await response.json();
			expect(result.error).toBe('Building does not support Somersloop');
		});
	});

	describe('Performance and Concurrency', () => {
		it('should handle concurrent production instance creation', async () => {
			// Create multiple production instances concurrently
			const requests = Array.from({ length: 5 }, (_, index) => {
				const request = createApiRequest(
					`http://localhost:3000/api/sites/${fixture.siteId}/production-instances`,
					'POST',
					createProductionInstanceRequest(fixture, { 
						somersloopCount: index % 2 // Alternate between 0 and 1
					})
				);

				const context = createRequestContext({ siteId: fixture.siteId }, mockUsers.admin);
				return POST({ ...context, request } as any);
			});

			const responses = await Promise.all(requests);
			
			// All requests should succeed
			responses.forEach(response => {
				expect(response.status).toBe(201);
			});
		});
	});
});

/**
 * Example of how this optimized approach improves testing:
 * 
 * 1. **Reduced Setup Time**: Uses beforeAll() for shared setup instead of beforeEach()
 * 2. **Reusable Helpers**: Common request/response patterns are abstracted
 * 3. **Data-Driven Tests**: Scenarios are parameterized for comprehensive coverage
 * 4. **Clear Separation**: Authentication, validation, and business logic tests are separated
 * 5. **Performance Testing**: Includes concurrency tests that weren't in the original
 * 6. **Maintainability**: Changes to API structure only require updating helpers
 */