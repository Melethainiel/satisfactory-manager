import type { RequestHandler } from '@sveltejs/kit';
import { gameService } from '$lib/server/services/gameService';

// PATCH /api/games/[id]  body: { name?: string }
export const PATCH: RequestHandler = async ({ params, request }) => {
  const id = params.id;
  if (!id) return new Response(JSON.stringify({ error: 'id param required' }), { status: 400 });
  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json body' }), { status: 400 });
  }
  if (!body.name || !body.name.trim()) {
    return new Response(JSON.stringify({ error: 'name required' }), { status: 400 });
  }
  const updated = await gameService.update(id, { name: body.name.trim() });
  if (!updated) return new Response(JSON.stringify({ error: 'game not found' }), { status: 404 });
  return new Response(JSON.stringify(updated), { status: 200, headers: { 'content-type': 'application/json' } });
};

// DELETE /api/games/[id]
export const DELETE: RequestHandler = async ({ params }) => {
  const id = params.id;
  if (!id) return new Response(JSON.stringify({ error: 'id param required' }), { status: 400 });
  const deleted = await gameService.delete(id);
  if (!deleted) return new Response(JSON.stringify({ error: 'game not found' }), { status: 404 });
  return new Response(null, { status: 204 });
};
