import type { RequestHandler } from '@sveltejs/kit';
import { gameService } from '$lib/server/services/gameService';

// GET /api/games/[id]/users
export const GET: RequestHandler = async ({ params }) => {
  const id = params.id;
  if (!id) return new Response(JSON.stringify({ error: 'id param required' }), { status: 400 });
  const users = await gameService.getUsersDetailed(id);
  return new Response(JSON.stringify(users), { status: 200, headers: { 'content-type': 'application/json' } });
};
