/**
 * Formats energy values with appropriate units (MW/GW) and decimal places
 */
export interface EnergyValue {
	value: number;
	unit: 'MW' | 'GW';
	formatted: string;
}

/**
 * Format energy consumption/production values
 * - Values > 10,000 MW are displayed in GW with 2 decimal places
 * - Values <= 10,000 MW are displayed in MW with 1 decimal place
 */
export function formatEnergy(energyMW: number): EnergyValue {
	const GW_THRESHOLD = 10000; // 10 GW in MW

	if (energyMW > GW_THRESHOLD) {
		const valueGW = energyMW / 1000;
		return {
			value: valueGW,
			unit: 'GW',
			formatted: valueGW.toFixed(2)
		};
	} else {
		return {
			value: energyMW,
			unit: 'MW',
			formatted: energyMW.toFixed(1)
		};
	}
}

/**
 * Calculate total energy consumption (sum of consumption and production)
 */
export function calculateTotalEnergy(consumption: number, production: number): number {
	return consumption + production;
}
