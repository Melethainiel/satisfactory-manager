import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildingService } from '$lib/server/services/buildingService';
import { moduleService } from '$lib/server/services/moduleService';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { moduleVersions } from '$lib/server/db/schema';

interface ImportBuildingData {
	className: string;
	name: string;
	energyConsumption?: number;
	energyProduction?: number;
	supplementalLoadAmount?: number;
	output?: number;
	productionShardSlotSize?: number;
	type: 'Generator' | 'Constructor' | 'Miner';
}

// POST /api/buildings/import - Bulk import building data
export const POST: RequestHandler = async ({ request }) => {
	try {
		// Check content length to prevent DoS attacks
		const contentLength = request.headers.get('content-length');
		if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
			// 10MB limit
			return json({ error: 'Request payload too large (max 10MB)' }, { status: 413 });
		}

		const { buildings: buildingsData, moduleVersionId } = await request.json();

		if (!Array.isArray(buildingsData) || buildingsData.length === 0) {
			return json({ error: 'buildings array is required and must not be empty' }, { status: 400 });
		}

		// Limit number of buildings that can be imported at once
		if (buildingsData.length > 1000) {
			return json({ error: 'Maximum 1000 buildings can be imported at once' }, { status: 400 });
		}

		if (!moduleVersionId || typeof moduleVersionId !== 'string') {
			return json({ error: 'moduleVersionId is required' }, { status: 400 });
		}

		// Validate that the module version exists
		const [moduleVersion] = await db
			.select()
			.from(moduleVersions)
			.where(eq(moduleVersions.id, moduleVersionId));

		if (!moduleVersion) {
			return json({ error: 'Invalid moduleVersionId' }, { status: 400 });
		}

		const results = {
			created: 0,
			updated: 0,
			versionsCreated: 0,
			errors: [] as string[]
		};

		for (const buildingData of buildingsData as ImportBuildingData[]) {
			try {
				// Validate required fields
				if (
					!buildingData.className ||
					typeof buildingData.className !== 'string' ||
					!buildingData.className.trim()
				) {
					results.errors.push(
						`Invalid building data: missing or invalid className for ${buildingData.className || 'unknown'}`
					);
					continue;
				}

				if (
					!buildingData.name ||
					typeof buildingData.name !== 'string' ||
					!buildingData.name.trim()
				) {
					results.errors.push(
						`Invalid building data: missing or invalid name for ${buildingData.className}`
					);
					continue;
				}

				if (
					!buildingData.type ||
					!['Generator', 'Constructor', 'Miner'].includes(buildingData.type)
				) {
					results.errors.push(
						`Invalid building data: missing or invalid type for ${buildingData.className}`
					);
					continue;
				}

				// Validate numeric fields
				const numericFields = [
					'energyConsumption',
					'energyProduction',
					'supplementalLoadAmount',
					'output',
					'productionShardSlotSize'
				];
				let validNumericData = true;
				for (const field of numericFields) {
					if (buildingData[field as keyof ImportBuildingData] !== undefined) {
						const value = Number(buildingData[field as keyof ImportBuildingData]);
						if (isNaN(value) || value < 0) {
							results.errors.push(
								`Invalid building data: ${field} must be a non-negative number for ${buildingData.className}`
							);
							validNumericData = false;
							break;
						}
						// Additional validation for productionShardSlotSize (must be integer)
						if (field === 'productionShardSlotSize' && !Number.isInteger(value)) {
							results.errors.push(
								`Invalid building data: productionShardSlotSize must be an integer for ${buildingData.className}`
							);
							validNumericData = false;
							break;
						}
					}
				}

				if (!validNumericData) {
					continue;
				}

				// Check if building exists
				let building = await buildingService.getBuildingByClassName(buildingData.className.trim());

				if (!building) {
					// Create new building
					building = await buildingService.createBuilding({
						moduleId: moduleVersion.moduleId,
						className: buildingData.className.trim(),
						name: buildingData.name.trim(),
						type: buildingData.type
					});
					results.created++;
				} else if (
					building.name !== buildingData.name.trim() ||
					building.type !== buildingData.type
				) {
					// Update building if name or type changed
					building = await buildingService.updateBuilding(building.id, {
						name: buildingData.name.trim(),
						type: buildingData.type
					});
					results.updated++;
				}

				if (building) {
					// Check if building version already exists for this module version
					const existingVersion = await buildingService.getBuildingVersionByModuleAndBuilding(
						building.id,
						moduleVersionId
					);

					if (!existingVersion) {
						// Create building version with stats
						await buildingService.addBuildingVersion(building.id, {
							moduleVersionId,
							energyConsumption: buildingData.energyConsumption?.toString() || null,
							energyProduction: buildingData.energyProduction?.toString() || null,
							supplementalLoadAmount: buildingData.supplementalLoadAmount?.toString() || null,
							output: buildingData.output?.toString() || null,
							productionShardSlotSize: buildingData.productionShardSlotSize ?? 0
						});
						results.versionsCreated++;
					}
				}
			} catch (error) {
				results.errors.push(`Error processing building ${buildingData.className}: ${error}`);
			}
		}

		return json(results, { status: 201 });
	} catch (error) {
		console.error('Error importing buildings:', error);
		return json({ error: 'Failed to import buildings' }, { status: 500 });
	}
};
