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
 * Calculates actual power consumption including Somersloop and clock speed effects
 * 
 * Uses the formula: basePower * powerMultiplier * (clockSpeed / 100) ^ 1.321928
 * 
 * @param basePower - Base power consumption of the building in MW
 * @param powerMultiplier - Power multiplier from Somersloop shards
 * @param clockSpeed - Clock speed as percentage (100 = normal speed)
 * @returns Actual power consumption in MW
 */
export function calculatePowerConsumption(
	basePower: number,
	powerMultiplier: number,
	clockSpeed: number
): number {
	if (basePower <= 0) return 0;
	
	const clockSpeedRatio = Math.max(0.01, clockSpeed) / 100; // Minimum 1% to avoid division issues
	const clockSpeedEffect = Math.pow(clockSpeedRatio, 1.321928);
	
	return basePower * powerMultiplier * clockSpeedEffect;
}

/**
 * Calculates actual power production with clock speed scaling
 * 
 * Power production scales linearly with clock speed
 * 
 * @param basePower - Base power production of the building in MW
 * @param clockSpeed - Clock speed as percentage (100 = normal speed)
 * @returns Actual power production in MW
 */
export function calculatePowerProduction(
	basePower: number,
	clockSpeed: number
): number {
	if (basePower <= 0) return 0;
	
	const clockSpeedRatio = Math.max(0.01, clockSpeed) / 100; // Minimum 1% to avoid division issues
	
	return basePower * clockSpeedRatio;
}

