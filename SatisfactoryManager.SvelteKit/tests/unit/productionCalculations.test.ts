/**
 * Production Calculations Unit Tests
 * Tests for Somersloop (Production Shard) calculation formulas
 */

import { describe, expect, it } from 'vitest';
import { 
	getPurityMultiplier, 
	calculatePowerMultiplier, 
	calculateProductionBoost,
	calculatePowerConsumption,
	calculatePowerProduction
} from '../../src/lib/utils/productionCalculations';
import { testScenarios, purityTestData, testAssertions } from '../utils/testCalculations';

describe('Production Calculations', () => {
	describe('getPurityMultiplier', () => {
		it('should return correct multipliers for each purity level', () => {
			Object.values(purityTestData).forEach(({ purity, expected }) => {
				expect(getPurityMultiplier(purity as any)).toBe(expected);
			});
		});
	});

	describe('calculatePowerMultiplier', () => {
		it('should return 1.0 when totalSlots is 0 (no Somersloop support)', () => {
			expect(calculatePowerMultiplier(0, 0)).toBe(1.0);
			expect(calculatePowerMultiplier(5, 0)).toBe(1.0);
		});

		it('should return 1.0 when no slots are filled', () => {
			expect(calculatePowerMultiplier(0, 1)).toBe(1.0);
			expect(calculatePowerMultiplier(0, 4)).toBe(1.0);
		});

		it('should calculate correct power multiplier using (1 + filled/total)� formula', () => {
			// 1 slot filled out of 1: (1 + 1/1)� = 2� = 4
			expect(calculatePowerMultiplier(1, 1)).toBe(4.0);
			
			// 1 slot filled out of 2: (1 + 1/2)� = 1.5� = 2.25
			expect(calculatePowerMultiplier(1, 2)).toBe(2.25);
			
			// 2 slots filled out of 4: (1 + 2/4)� = 1.5� = 2.25
			expect(calculatePowerMultiplier(2, 4)).toBe(2.25);
			
			// All slots filled: (1 + 4/4)� = 2� = 4
			expect(calculatePowerMultiplier(4, 4)).toBe(4.0);
			
			// Partial filling: (1 + 3/4)� = 1.75� = 3.0625
			expect(calculatePowerMultiplier(3, 4)).toBe(3.0625);
		});

		it('should handle edge case of filled slots exceeding total slots', () => {
			// This shouldn't happen in normal usage, but the formula should still work
			expect(calculatePowerMultiplier(5, 4)).toBe(Math.pow(1 + 5/4, 2));
		});

		it('should handle fractional results correctly', () => {
			// 1 out of 3: (1 + 1/3)� = (4/3)� H 1.7778
			const result = calculatePowerMultiplier(1, 3);
			expect(result).toBeCloseTo(1.7778, 4);
		});
	});

	describe('calculateProductionBoost', () => {
		it('should return 1.0 when totalSlots is 0 (no Somersloop support)', () => {
			expect(calculateProductionBoost(0, 0)).toBe(1.0);
			expect(calculateProductionBoost(5, 0)).toBe(1.0);
		});

		it('should return 1.0 when no slots are filled', () => {
			expect(calculateProductionBoost(0, 1)).toBe(1.0);
			expect(calculateProductionBoost(0, 4)).toBe(1.0);
		});

		it('should calculate correct production boost using (1 + filled/total) formula', () => {
			// 1 slot filled out of 1: (1 + 1/1) = 2.0 (100% boost)
			expect(calculateProductionBoost(1, 1)).toBe(2.0);
			
			// 1 slot filled out of 2: (1 + 1/2) = 1.5 (50% boost)
			expect(calculateProductionBoost(1, 2)).toBe(1.5);
			
			// 2 slots filled out of 4: (1 + 2/4) = 1.5 (50% boost)
			expect(calculateProductionBoost(2, 4)).toBe(1.5);
			
			// All slots filled: (1 + 4/4) = 2.0 (100% boost)
			expect(calculateProductionBoost(4, 4)).toBe(2.0);
			
			// Partial filling: (1 + 3/4) = 1.75 (75% boost)
			expect(calculateProductionBoost(3, 4)).toBe(1.75);
		});

		it('should handle edge case of filled slots exceeding total slots', () => {
			// This shouldn't happen in normal usage, but the formula should still work
			expect(calculateProductionBoost(5, 4)).toBe(1 + 5/4);
		});

		it('should handle fractional results correctly', () => {
			// 1 out of 3: (1 + 1/3) = 4/3 H 1.3333
			const result = calculateProductionBoost(1, 3);
			expect(result).toBeCloseTo(1.3333, 4);
		});
	});

	describe('Satisfactory Game Mechanics Validation', () => {
		describe('Real game scenarios', () => {
			it('should match Satisfactory Constructor behavior (1 Somersloop slot)', () => {
				// Constructor with 1 Somersloop slot filled should double production
				expect(calculateProductionBoost(1, 1)).toBe(2.0);
				// Power consumption should be 4x base (2�)
				expect(calculatePowerMultiplier(1, 1)).toBe(4.0);
			});

			it('should match Satisfactory Manufacturer behavior (4 Somersloop slots)', () => {
				// Manufacturer with 2/4 slots filled
				expect(calculateProductionBoost(2, 4)).toBe(1.5); // 50% production boost
				expect(calculatePowerMultiplier(2, 4)).toBe(2.25); // (1.5)� power multiplier
				
				// Manufacturer with all 4 slots filled
				expect(calculateProductionBoost(4, 4)).toBe(2.0); // 100% production boost
				expect(calculatePowerMultiplier(4, 4)).toBe(4.0); // 4x power consumption
			});

			it('should handle buildings without Somersloop support', () => {
				// Buildings like Smelters don't support Somersloop
				expect(calculateProductionBoost(0, 0)).toBe(1.0);
				expect(calculatePowerMultiplier(0, 0)).toBe(1.0);
			});
		});

		describe('Formula mathematical properties', () => {
			it('should maintain that production boost is always <= power multiplier', () => {
				const testCases = [
					[1, 1], [1, 2], [2, 4], [3, 4], [1, 3]
				];

				testCases.forEach(([filled, total]) => {
					const productionBoost = calculateProductionBoost(filled, total);
					const powerMultiplier = calculatePowerMultiplier(filled, total);
					expect(productionBoost).toBeLessThanOrEqual(powerMultiplier);
				});
			});

			it('should be monotonically increasing with filled slots', () => {
				const totalSlots = 4;
				let previousProduction = 1.0;
				let previousPower = 1.0;

				for (let filled = 0; filled <= totalSlots; filled++) {
					const production = calculateProductionBoost(filled, totalSlots);
					const power = calculatePowerMultiplier(filled, totalSlots);

					expect(production).toBeGreaterThanOrEqual(previousProduction);
					expect(power).toBeGreaterThanOrEqual(previousPower);

					previousProduction = production;
					previousPower = power;
				}
			});
		});
	});
});