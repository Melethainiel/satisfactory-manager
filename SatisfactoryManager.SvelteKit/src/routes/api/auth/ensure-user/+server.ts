import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { userService } from '$lib/server/services/userService';

// Ensures a user record exists (idempotent) based on email.
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as { displayName?: string; email?: string };

		// Trim input values
		const email = body.email?.trim();
		const displayName = body.displayName?.trim();

		// Validate required fields
		if (!email || email === '') {
			return json({ error: 'Display name and email are required' }, { status: 400 });
		}

		if (!displayName || displayName === '') {
			return json({ error: 'Display name and email are required' }, { status: 400 });
		}

		// Check if user already exists
		let existing = await userService.getByEmail(email);
		if (existing) {
			// Update display name if different
			if (existing.displayName !== displayName) {
				const updated = await userService.update(existing.id, { displayName });
				return json({ ...updated, created: false });
			}
			return json({ ...existing, created: false });
		}

		// Create new user
		const created = await userService.create({
			displayName,
			email
		});

		return json({ ...created, created: true }, { status: 201 });
	} catch (error) {
		console.error('Error ensuring user:', error);
		return json({ error: 'Failed to ensure user' }, { status: 500 });
	}
};
