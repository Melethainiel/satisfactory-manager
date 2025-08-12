import type { RequestHandler } from '@sveltejs/kit';
import { userService } from '$lib/server/services/userService';

export const GET: RequestHandler = async ({ params }) => {
	const id = params.id;
	if (!id || typeof id !== 'string') return new Response('Invalid id', { status: 400 });
	const user = await userService.getById(id);
	return user
		? new Response(JSON.stringify(user), { status: 200 })
		: new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const id = params.id;
	if (!id || typeof id !== 'string') return new Response('Invalid id', { status: 400 });
	const body = (await request.json()) as { displayName?: string; email?: string };
	const updated = await userService.update(id, {
		displayName: body.displayName,
		email: body.email
	});
	return updated
		? new Response(JSON.stringify(updated), { status: 200 })
		: new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = params.id;
	if (!id || typeof id !== 'string') return new Response('Invalid id', { status: 400 });
	const deleted = await userService.delete(id);
	return deleted
		? new Response(null, { status: 204 })
		: new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
};
