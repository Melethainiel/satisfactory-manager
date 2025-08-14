import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildingService } from '$lib/server/services/buildingService';

// GET /api/buildings/[id]/versions - Get all versions for a building
export const GET: RequestHandler = async ({ params }) => {
	try {
		if (!params.id || typeof params.id !== 'string') {
			return json({ error: 'Invalid building ID' }, { status: 400 });
		}

		// Check if building exists
		const building = await buildingService.getBuildingById(params.id);
		if (!building) {
			return json({ error: 'Building not found' }, { status: 404 });
		}

		const buildingVersions = await buildingService.getBuildingVersions(params.id);
		return json(buildingVersions);
	} catch (error) {
		console.error('Error fetching building versions:', error);
		return json({ error: 'Failed to fetch building versions' }, { status: 500 });
	}
};

// POST /api/buildings/[id]/versions - Create a new building version
export const POST: RequestHandler = async ({ params, request }) => {
	try {
		if (!params.id || typeof params.id !== 'string') {
			return json({ error: 'Invalid building ID' }, { status: 400 });
		}

		const versionData = await request.json();

		if (!versionData.moduleVersionId || typeof versionData.moduleVersionId !== 'string') {
			return json({ error: 'moduleVersionId is required' }, { status: 400 });
		}

		// Validate numeric fields if provided
		const numericFields = [
			'energyConsumption',
			'energyProduction',
			'supplementalLoadAmount',
			'output'
		];
		for (const field of numericFields) {
			if (versionData[field] !== undefined && versionData[field] !== null) {
				const value = Number(versionData[field]);
				if (isNaN(value) || value < 0) {
					return json({ error: `${field} must be a non-negative number` }, { status: 400 });
				}
				versionData[field] = value.toString();
			}
		}

		// Check if building exists
		const building = await buildingService.getBuildingById(params.id);
		if (!building) {
			return json({ error: 'Building not found' }, { status: 404 });
		}

		// Check if version already exists for this module version
		const existingVersion = await buildingService.getBuildingVersionByModuleAndBuilding(
			params.id,
			versionData.moduleVersionId
		);
		if (existingVersion) {
			return json(
				{ error: 'Building version already exists for this module version' },
				{ status: 409 }
			);
		}

		const buildingVersion = await buildingService.addBuildingVersion(params.id, versionData);
		return json(buildingVersion, { status: 201 });
	} catch (error) {
		console.error('Error creating building version:', error);
		return json({ error: 'Failed to create building version' }, { status: 500 });
	}
};
