import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { userService } from '$lib/server/services/userService';

// Ensures a user record exists (idempotent) based on email.
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as { displayName?: string; email?: string };
		if (!body.email) {
			return json({ error: 'Email is required' }, { status: 400 });
		}
		let existing = await userService.getByEmail(body.email);
		if (existing) {
			return json(existing);
		}
		const created = await userService.create({
			displayName: body.displayName ?? body.email.split('@')[0],
			email: body.email
		});
		return json(created, { status: 201 });
	} catch (error) {
		console.error('Error ensuring user:', error);
		return json({ error: 'Failed to ensure user' }, { status: 500 });
	}
};
