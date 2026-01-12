import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { userService } from '$lib/server/services/userService';

// UUID validation regex (allows test UUID with all zeros)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Email validation regex (strict)
const EMAIL_REGEX =
	/^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Validate UUID format
const isValidUUID = (id: string): boolean => {
	return UUID_REGEX.test(id);
};

// GET /api/users/[id] - Get user by ID
export const GET: RequestHandler = async ({ params }) => {
	try {
		const id = params.id;
		if (!id || typeof id !== 'string') {
			return json({ error: 'User ID is required' }, { status: 400 });
		}

		// Validate UUID format
		if (!isValidUUID(id)) {
			return json({ error: 'Invalid user ID format' }, { status: 400 });
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

		// Validate UUID format
		if (!isValidUUID(id)) {
			return json({ error: 'Invalid user ID format' }, { status: 400 });
		}

		const body = (await request.json()) as { displayName?: string; email?: string };

		// Trim inputs
		const displayName = body.displayName?.trim();
		const email = body.email?.trim();

		// Require both fields for PUT (based on test expectations)
		if (!displayName || !email) {
			return json({ error: 'Both displayName and email are required' }, { status: 400 });
		}

		// Validate email format
		if (!EMAIL_REGEX.test(email)) {
			return json({ error: 'Invalid email format' }, { status: 400 });
		}

		const updated = await userService.update(id, {
			displayName,
			email
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

		// Validate UUID format
		if (!isValidUUID(id)) {
			return json({ error: 'Invalid user ID format' }, { status: 400 });
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
