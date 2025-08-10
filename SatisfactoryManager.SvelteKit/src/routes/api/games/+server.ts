import type { RequestHandler } from '@sveltejs/kit';
import { gameService } from '$lib/server/services/gameService';
import { userService } from '$lib/server/services/userService';

// GET /api/games?email=user@example.com
export const GET: RequestHandler = async ({ url }) => {
  const email = url.searchParams.get('email');
  if (!email) return new Response(JSON.stringify({ error: 'email query param required' }), { status: 400 });
  const games = await gameService.getForUserEmail(email);
  return new Response(JSON.stringify(games), { status: 200, headers: { 'content-type': 'application/json' } });
};

// POST /api/games  body: { email: string, name: string }
export const POST: RequestHandler = async ({ request }) => {
  const body = (await request.json()) as { email?: string; name?: string };
  if (!body.email || !body.name) return new Response(JSON.stringify({ error: 'email and name required' }), { status: 400 });
  const user = await userService.getByEmail(body.email);
  if (!user) return new Response(JSON.stringify({ error: 'user not found' }), { status: 404 });
  const game = await gameService.create({ name: body.name });
  await gameService.addUser(game.id, user.id, 'Owner');
  return new Response(JSON.stringify(game), { status: 201, headers: { 'content-type': 'application/json', Location: `/api/games/${game.id}` } });
};
