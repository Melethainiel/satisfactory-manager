/**
 * Production Calculations for Somersloop (Production Shard) System
 *
 * This module provides utility functions for calculating production boosts,
 * power consumption multipliers, and purity effects in the Satisfactory game.
 *
 * Key Formulas:
 * - Power Multiplier: (1 + filled/total)²
 * - Production Boost: (1 + filled/total)
 * - Purity: Impure=0.5, Normal=1.0, Pure=2.0
 */

export type PurityLevel = 'Impure' | 'Normal' | 'Pure';

/**
 * Calculates the production multiplier based on resource node purity
 *
 * @param purity - The purity level of the resource node
 * @returns The production multiplier (0.5 for Impure, 1.0 for Normal, 2.0 for Pure)
 */
export function getPurityMultiplier(purity: string | null | undefined): number {
	switch (purity) {
		case 'Impure':
			return 0.5;
		case 'Pure':
			return 2.0;
		case 'Normal':
		default:
			return 1.0;
	}
}

/**
 * Calculates the power consumption multiplier when using Somersloop shards
 *
 * Uses the formula: (1 + filled/total)²
 * This reflects the exponential power cost increase in Satisfactory
 *
 * @param filledSlots - Number of Somersloop shards installed
 * @param totalSlots - Total number of available Somersloop slots in the building
 * @returns Power consumption multiplier (1.0 = base consumption)
 */
export function calculatePowerMultiplier(filledSlots: number, totalSlots: number): number {
	// Handle buildings without Somersloop support
	if (totalSlots <= 0) return 1.0;

	// Ensure non-negative values
	const safeFilledSlots = Math.max(0, filledSlots);
	const safeTotalSlots = Math.max(1, totalSlots);

	const slotRatio = safeFilledSlots / safeTotalSlots;
	return Math.pow(1 + slotRatio, 2);
}

/**
 * Calculates the production output boost when using Somersloop shards
 *
 * Uses the formula: (1 + filled/total)
 * This provides linear production increase in Satisfactory
 *
 * @param filledSlots - Number of Somersloop shards installed
 * @param totalSlots - Total number of available Somersloop slots in the building
 * @returns Production output multiplier (1.0 = base production)
 */
export function calculateProductionBoost(filledSlots: number, totalSlots: number): number {
	// Handle buildings without Somersloop support
	if (totalSlots <= 0) return 1.0;

	// Ensure non-negative values
	const safeFilledSlots = Math.max(0, filledSlots);
	const safeTotalSlots = Math.max(1, totalSlots);

	const slotRatio = safeFilledSlots / safeTotalSlots;
	return 1 + slotRatio;
}

/**
 * Calculates the total production rate including purity and Somersloop effects
 *
 * @param baseRate - Base production rate of the recipe
 * @param purity - Resource node purity level
 * @param filledSlots - Number of Somersloop shards installed
 * @param totalSlots - Total Somersloop slots available
 * @returns Final production rate per minute
 */
export function calculateTotalProductionRate(
	baseRate: number,
	purity: string | null | undefined,
	filledSlots: number,
	totalSlots: number
): number {
	const purityMultiplier = getPurityMultiplier(purity);
	const productionBoost = calculateProductionBoost(filledSlots, totalSlots);

	return baseRate * purityMultiplier * productionBoost;
}

/**
 * Calculates power consumption with multiplier and clock speed effects
 *
 * @param basePower - Base power consumption of the building in MW
 * @param powerMultiplier - Power multiplier from Somersloop effects
 * @param clockSpeed - Clock speed percentage (100 = normal speed)
 * @returns Final power consumption in MW per building
 */
export function calculatePowerConsumption(
	basePower: number,
	powerMultiplier: number,
	clockSpeed: number
): number {
	const clockSpeedRatio = clockSpeed / 100;
	return basePower * powerMultiplier * clockSpeedRatio;
}

/**
 * Calculates power production with clock speed effects
 *
 * @param basePower - Base power production of the building in MW
 * @param clockSpeed - Clock speed percentage (100 = normal speed)
 * @returns Final power production in MW per building
 */
export function calculatePowerProduction(basePower: number, clockSpeed: number): number {
	const clockSpeedRatio = clockSpeed / 100;
	return basePower * clockSpeedRatio;
}

/**
 * Calculates the total power consumption including Somersloop effects
 *
 * @param basePower - Base power consumption of the building
 * @param filledSlots - Number of Somersloop shards installed
 * @param totalSlots - Total Somersloop slots available
 * @returns Final power consumption in MW
 */
export function calculateTotalPowerConsumption(
	basePower: number,
	filledSlots: number,
	totalSlots: number
): number {
	const powerMultiplier = calculatePowerMultiplier(filledSlots, totalSlots);
	return basePower * powerMultiplier;
}

/**
 * Validates Somersloop slot configuration
 *
 * @param filledSlots - Number of filled slots
 * @param totalSlots - Total available slots
 * @returns Validation result with error message if invalid
 */
export function validateSomersloopSlots(
	filledSlots: number,
	totalSlots: number
): { valid: boolean; error?: string } {
	// Check for integer values
	if (!Number.isInteger(filledSlots)) {
		return { valid: false, error: 'filledSlots must be an integer' };
	}

	if (!Number.isInteger(totalSlots)) {
		return { valid: false, error: 'totalSlots must be an integer' };
	}

	// Check for negative values
	if (filledSlots < 0) {
		return { valid: false, error: 'filledSlots must be non-negative' };
	}

	if (totalSlots < 0) {
		return { valid: false, error: 'totalSlots must be non-negative' };
	}

	// Check if filled exceeds total
	if (totalSlots > 0 && filledSlots > totalSlots) {
		return {
			valid: false,
			error: `filledSlots (${filledSlots}) exceeds totalSlots (${totalSlots})`
		};
	}

	return { valid: true };
}
