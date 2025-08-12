import type { RequestHandler } from '@sveltejs/kit';
import { userService } from '$lib/server/services/userService';

// Ensures a user record exists (idempotent) based on email.
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as { displayName?: string; email?: string };
	if (!body.email)
		return new Response(JSON.stringify({ error: 'email required' }), { status: 400 });
	let existing = await userService.getByEmail(body.email);
	if (existing) return new Response(JSON.stringify(existing), { status: 200 });
	const created = await userService.create({
		displayName: body.displayName ?? body.email.split('@')[0],
		email: body.email
	});
	return new Response(JSON.stringify(created), { status: 201 });
};
