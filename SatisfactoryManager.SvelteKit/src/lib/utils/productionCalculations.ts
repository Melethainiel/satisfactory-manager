/**
 * Shared production calculation utilities for Satisfactory Manager
 * 
 * This module contains all the calculation formulas used across the application
 * to ensure consistency and eliminate code duplication.
 */

/**
 * Get the purity multiplier for extractors based on node quality
 */
export function getPurityMultiplier(purity: string | null): number {
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
 * Calculate power multiplier based on Somersloop usage
 * Formula: (1 + Filled slots / Total slots)²
 */
export function calculatePowerMultiplier(filledSlots: number, totalSlots: number): number {
	if (totalSlots === 0) return 1.0;
	const slotRatio = filledSlots / totalSlots;
	return Math.pow(1 + slotRatio, 2);
}

/**
 * Calculate actual power consumption based on Satisfactory wiki formula
 * Formula: Base power usage × Power multiplier × (Clock speed/100)^1.321928
 */
export function calculatePowerConsumption(
	basePowerUsage: number,
	powerMultiplier: number,
	clockSpeed: number
): number {
	const clockSpeedRatio = clockSpeed / 100;
	return basePowerUsage * powerMultiplier * Math.pow(clockSpeedRatio, 1.321928);
}

/**
 * Calculate power production with linear scaling for clock speed
 */
export function calculatePowerProduction(basePowerProduction: number, clockSpeed: number): number {
	const clockSpeedRatio = clockSpeed / 100;
	return basePowerProduction * clockSpeedRatio; // Linear scaling for power production
}

/**
 * Calculate production boost based on Somersloop usage
 * Formula: (1 + Filled slots / Total slots)
 * Note: This only affects production output, not ingredient consumption
 */
export function calculateProductionBoost(filledSlots: number, totalSlots: number): number {
	if (totalSlots === 0) return 1.0;
	const slotRatio = filledSlots / totalSlots;
	return 1 + slotRatio;
}