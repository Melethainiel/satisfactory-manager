import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { userService } from '$lib/server/services/userService';

// GET /api/users?search=term - List all users with optional search
export const GET: RequestHandler = async ({ url }) => {
	try {
		const search = url.searchParams.get('search');
		const users = await userService.getAll(search || undefined);
		return json(users);
	} catch (error) {
		console.error('Error fetching users:', error);
		return json({ error: 'Failed to fetch users' }, { status: 500 });
	}
};

// Email validation regex (strict)
const EMAIL_REGEX =
	/^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// POST /api/users - Create a new user
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as { displayName?: string; email?: string };

		// Trim inputs
		const displayName = body.displayName?.trim();
		const email = body.email?.trim();

		if (!displayName || !email) {
			return json({ error: 'Display name and email are required' }, { status: 400 });
		}

		// Validate email format
		if (!EMAIL_REGEX.test(email)) {
			return json({ error: 'Invalid email format' }, { status: 400 });
		}

		const created = await userService.create({ displayName, email });
		return json(created, {
			status: 201,
			headers: { Location: `/api/users/${created.id}` }
		});
	} catch (error) {
		console.error('Error creating user:', error);
		return json({ error: 'Failed to create user' }, { status: 500 });
	}
};
