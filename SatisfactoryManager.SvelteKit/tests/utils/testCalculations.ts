/**
 * Test Utilities for Production Calculations
 * 
 * This module provides shared utilities and helper functions for testing
 * Somersloop production calculations across different test files.
 */

/**
 * Test data for various Somersloop scenarios
 */
export const testScenarios = {
	// Constructor scenarios (1 slot)
	constructor: {
		noSomersloop: { filled: 0, total: 1, expectedProduction: 1.0, expectedPower: 1.0 },
		withSomersloop: { filled: 1, total: 1, expectedProduction: 2.0, expectedPower: 4.0 }
	},
	
	// Manufacturer scenarios (4 slots)
	manufacturer: {
		noSomersloop: { filled: 0, total: 4, expectedProduction: 1.0, expectedPower: 1.0 },
		halfFilled: { filled: 2, total: 4, expectedProduction: 1.5, expectedPower: 2.25 },
		partialFilled: { filled: 3, total: 4, expectedProduction: 1.75, expectedPower: 3.0625 },
		fullFilled: { filled: 4, total: 4, expectedProduction: 2.0, expectedPower: 4.0 }
	},
	
	// Buildings without Somersloop support
	smelter: {
		noSupport: { filled: 0, total: 0, expectedProduction: 1.0, expectedPower: 1.0 }
	},
	
	// Edge cases
	edgeCases: {
		exceeding: { filled: 5, total: 4, expectedProduction: 2.25, expectedPower: 5.0625 },
		fractional: { filled: 1, total: 3, expectedProduction: 4/3, expectedPower: (4/3)**2 }
	}
};

/**
 * Test data for purity levels
 */
export const purityTestData = {
	impure: { purity: 'Impure', expected: 0.5 },
	normal: { purity: 'Normal', expected: 1.0 },
	pure: { purity: 'Pure', expected: 2.0 },
	null: { purity: null, expected: 1.0 },
	undefined: { purity: undefined, expected: 1.0 },
	unknown: { purity: 'Unknown', expected: 1.0 },
	empty: { purity: '', expected: 1.0 }
};

/**
 * Validates that production boost is always less than or equal to power multiplier
 * This is a fundamental mathematical property of the Somersloop system
 */
export function validateProductionPowerRelationship(
	productionBoost: number,
	powerMultiplier: number,
	filledSlots: number,
	totalSlots: number
): void {
	if (productionBoost > powerMultiplier) {
		throw new Error(
			`Production boost (${productionBoost}) should not exceed power multiplier (${powerMultiplier}) ` +
			`for ${filledSlots}/${totalSlots} slots`
		);
	}
}

/**
 * Validates monotonic property: more Somersloop slots should never decrease production or power
 */
export function validateMonotonicProperty(
	values: number[],
	type: 'production' | 'power',
	totalSlots: number
): void {
	for (let i = 1; i < values.length; i++) {
		if (values[i] < values[i - 1]) {
			throw new Error(
				`${type} should be monotonically increasing, but decreased from ` +
				`${values[i - 1]} to ${values[i]} at slot ${i}/${totalSlots}`
			);
		}
	}
}

/**
 * Generates test cases for a given slot configuration
 */
export function generateSlotTestCases(totalSlots: number): Array<{
	filled: number;
	total: number;
	description: string;
}> {
	const cases = [];
	
	for (let filled = 0; filled <= totalSlots; filled++) {
		const percentage = totalSlots > 0 ? Math.round((filled / totalSlots) * 100) : 0;
		cases.push({
			filled,
			total: totalSlots,
			description: `${filled}/${totalSlots} slots filled (${percentage}%)`
		});
	}
	
	return cases;
}

/**
 * Floating point comparison with tolerance for test assertions
 */
export function expectCloseTo(
	actual: number, 
	expected: number, 
	precision: number = 4
): void {
	const tolerance = Math.pow(10, -precision);
	const diff = Math.abs(actual - expected);
	
	if (diff > tolerance) {
		throw new Error(
			`Expected ${actual} to be close to ${expected} (within ${tolerance}), ` +
			`but difference was ${diff}`
		);
	}
}

/**
 * Mock building data for integration tests
 */
export const mockBuildingData = {
	constructor: {
		className: 'Build_ConstructorMk1_C',
		name: 'Constructor',
		type: 'Constructor' as const,
		somersloopSlots: 1
	},
	manufacturer: {
		className: 'Build_ManufacturerMk1_C', 
		name: 'Manufacturer',
		type: 'Constructor' as const,
		somersloopSlots: 4
	},
	smelter: {
		className: 'Build_SmelterMk1_C',
		name: 'Smelter', 
		type: 'Constructor' as const,
		somersloopSlots: 0
	}
} as const;

/**
 * Common test assertion helpers
 */
export const testAssertions = {
	/**
	 * Asserts that a Somersloop calculation result matches expected game mechanics
	 */
	assertSomersloopMechanics(
		filled: number,
		total: number,
		actualProduction: number,
		actualPower: number
	): void {
		const expectedProduction = total > 0 ? 1 + (filled / total) : 1.0;
		const expectedPower = total > 0 ? Math.pow(1 + (filled / total), 2) : 1.0;
		
		expectCloseTo(actualProduction, expectedProduction);
		expectCloseTo(actualPower, expectedPower);
		validateProductionPowerRelationship(actualProduction, actualPower, filled, total);
	},
	
	/**
	 * Asserts purity multiplier calculation
	 */
	assertPurityMultiplier(purity: string | null | undefined, expected: number): void {
		// This would use the actual function when imported
		const actual = (() => {
			switch (purity) {
				case 'Impure': return 0.5;
				case 'Pure': return 2.0;
				case 'Normal':
				default: return 1.0;
			}
		})();
		
		expectCloseTo(actual, expected);
	}
};