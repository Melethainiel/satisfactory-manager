import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildingService } from '$lib/server/services/buildingService';

// GET /api/buildings - List all buildings
export const GET: RequestHandler = async ({ url }) => {
	try {
		const type = url.searchParams.get('type');

		// Validate type if provided
		if (type && !['Generator', 'Constructor', 'Miner'].includes(type)) {
			return json(
				{ error: 'Invalid building type. Must be Generator, Constructor, or Miner' },
				{ status: 400 }
			);
		}

		let buildings;
		if (type) {
			buildings = await buildingService.getBuildingsByType(type as any);
		} else {
			buildings = await buildingService.getAllBuildings();
		}

		return json(buildings);
	} catch (error) {
		console.error('Error fetching buildings:', error);
		return json({ error: 'Failed to fetch buildings' }, { status: 500 });
	}
};

// POST /api/buildings - Create a new building
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { moduleId, className, name, type } = await request.json();

		if (!moduleId || typeof moduleId !== 'string' || !moduleId.trim()) {
			return json({ error: 'Module ID is required' }, { status: 400 });
		}

		if (!className || typeof className !== 'string' || !className.trim()) {
			return json({ error: 'Building className is required' }, { status: 400 });
		}

		if (!name || typeof name !== 'string' || !name.trim()) {
			return json({ error: 'Building name is required' }, { status: 400 });
		}

		if (!type || !['Generator', 'Constructor', 'Miner'].includes(type)) {
			return json(
				{ error: 'Valid building type is required (Generator, Constructor, or Miner)' },
				{ status: 400 }
			);
		}

		// Check if building with this className already exists
		const existingBuilding = await buildingService.getBuildingByClassName(className.trim());
		if (existingBuilding) {
			return json({ error: 'A building with this className already exists' }, { status: 409 });
		}

		const building = await buildingService.createBuilding({
			moduleId: moduleId.trim(),
			className: className.trim(),
			name: name.trim(),
			type
		});

		return json(building, { status: 201 });
	} catch (error) {
		console.error('Error creating building:', error);
		return json({ error: 'Failed to create building' }, { status: 500 });
	}
};
