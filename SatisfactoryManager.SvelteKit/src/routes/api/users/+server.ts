import type { RequestHandler } from '@sveltejs/kit';
import { userService } from '$lib/server/services/userService';

export const GET: RequestHandler = async () => {
	const users = await userService.getAll();
	return new Response(JSON.stringify(users), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
};

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as { displayName?: string; email?: string };
	if (!body.displayName || !body.email) {
		return new Response(JSON.stringify({ error: 'displayName and email required' }), {
			status: 400
		});
	}
	const created = await userService.create({ displayName: body.displayName, email: body.email });
	return new Response(JSON.stringify(created), {
		status: 201,
		headers: { Location: `/api/users/${created.id}` }
	});
};
