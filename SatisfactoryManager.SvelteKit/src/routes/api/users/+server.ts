import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { userService } from '$lib/server/services/userService';

// GET /api/users - List all users
export const GET: RequestHandler = async () => {
	try {
		const users = await userService.getAll();
		return json(users);
	} catch (error) {
		console.error('Error fetching users:', error);
		return json({ error: 'Failed to fetch users' }, { status: 500 });
	}
};

// POST /api/users - Create a new user
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as { displayName?: string; email?: string };
		if (!body.displayName || !body.email) {
			return json({ error: 'Display name and email are required' }, { status: 400 });
		}
		const created = await userService.create({ displayName: body.displayName, email: body.email });
		return json(created, {
			status: 201,
			headers: { Location: `/api/users/${created.id}` }
		});
	} catch (error) {
		console.error('Error creating user:', error);
		return json({ error: 'Failed to create user' }, { status: 500 });
	}
};
