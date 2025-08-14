import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildingService } from '$lib/server/services/buildingService';

// GET /api/buildings/[id] - Get building by ID
export const GET: RequestHandler = async ({ params }) => {
	try {
		if (!params.id || typeof params.id !== 'string') {
			return json({ error: 'Invalid building ID' }, { status: 400 });
		}

		const building = await buildingService.getBuildingById(params.id);
		
		if (!building) {
			return json({ error: 'Building not found' }, { status: 404 });
		}

		return json(building);
	} catch (error) {
		console.error('Error fetching building:', error);
		return json({ error: 'Failed to fetch building' }, { status: 500 });
	}
};

// PATCH /api/buildings/[id] - Update building
export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		if (!params.id || typeof params.id !== 'string') {
			return json({ error: 'Invalid building ID' }, { status: 400 });
		}

		const updates = await request.json();
		
		// Validate update fields
		if (updates.className !== undefined) {
			if (typeof updates.className !== 'string' || !updates.className.trim()) {
				return json({ error: 'Invalid className' }, { status: 400 });
			}
			updates.className = updates.className.trim();
		}

		if (updates.name !== undefined) {
			if (typeof updates.name !== 'string' || !updates.name.trim()) {
				return json({ error: 'Invalid name' }, { status: 400 });
			}
			updates.name = updates.name.trim();
		}

		if (updates.type !== undefined) {
			if (!['Generator', 'Constructor', 'Miner'].includes(updates.type)) {
				return json({ error: 'Invalid building type. Must be Generator, Constructor, or Miner' }, { status: 400 });
			}
		}

		const building = await buildingService.updateBuilding(params.id, updates);
		
		if (!building) {
			return json({ error: 'Building not found' }, { status: 404 });
		}

		return json(building);
	} catch (error) {
		console.error('Error updating building:', error);
		return json({ error: 'Failed to update building' }, { status: 500 });
	}
};

// DELETE /api/buildings/[id] - Delete building
export const DELETE: RequestHandler = async ({ params }) => {
	try {
		if (!params.id || typeof params.id !== 'string') {
			return json({ error: 'Invalid building ID' }, { status: 400 });
		}

		const deleted = await buildingService.deleteBuilding(params.id);
		
		if (!deleted) {
			return json({ error: 'Building not found' }, { status: 404 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting building:', error);
		return json({ error: 'Failed to delete building' }, { status: 500 });
	}
};