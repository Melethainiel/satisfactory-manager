import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { userService } from '$lib/server/services/userService';

// GET /api/users/[id] - Get user by ID
export const GET: RequestHandler = async ({ params }) => {
	try {
		const id = params.id;
		if (!id || typeof id !== 'string') {
			return json({ error: 'User ID is required' }, { status: 400 });
		}
		const user = await userService.getById(id);
		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}
		return json(user);
	} catch (error) {
		console.error('Error fetching user:', error);
		return json({ error: 'Failed to fetch user' }, { status: 500 });
	}
};

// PUT /api/users/[id] - Update user by ID
export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const id = params.id;
		if (!id || typeof id !== 'string') {
			return json({ error: 'User ID is required' }, { status: 400 });
		}
		const body = (await request.json()) as { displayName?: string; email?: string };
		if (!body.displayName && !body.email) {
			return json({ error: 'At least displayName or email is required' }, { status: 400 });
		}
		const updated = await userService.update(id, {
			displayName: body.displayName,
			email: body.email
		});
		if (!updated) {
			return json({ error: 'User not found' }, { status: 404 });
		}
		return json(updated);
	} catch (error) {
		console.error('Error updating user:', error);
		return json({ error: 'Failed to update user' }, { status: 500 });
	}
};

// DELETE /api/users/[id] - Delete user by ID
export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const id = params.id;
		if (!id || typeof id !== 'string') {
			return json({ error: 'User ID is required' }, { status: 400 });
		}
		const deleted = await userService.delete(id);
		if (!deleted) {
			return json({ error: 'User not found' }, { status: 404 });
		}
		return new Response(null, { status: 204 });
	} catch (error) {
		console.error('Error deleting user:', error);
		return json({ error: 'Failed to delete user' }, { status: 500 });
	}
};
