import type { RequestHandler } from '@sveltejs/kit';
import { gameService } from '$lib/server/services/gameService';
import { userService } from '$lib/server/services/userService';

// GET /api/games/[id]/users
export const GET: RequestHandler = async ({ params }) => {
  const id = params.id;
  if (!id) return new Response(JSON.stringify({ error: 'id param required' }), { status: 400 });
  const users = await gameService.getUsersDetailed(id);
  return new Response(JSON.stringify(users), { status: 200, headers: { 'content-type': 'application/json' } });
};

// POST /api/games/[id]/users  { emails: string[], role?: string }
export const POST: RequestHandler = async ({ params, request }) => {
  const id = params.id;
  if (!id) return new Response(JSON.stringify({ error: 'id param required' }), { status: 400 });
  const body = (await request.json()) as { emails?: string[]; role?: string };
  if (!body.emails || !Array.isArray(body.emails) || body.emails.length === 0) {
    return new Response(JSON.stringify({ error: 'emails array required' }), { status: 400 });
  }
  const added: any[] = [];
  for (const raw of body.emails) {
    const email = (raw || '').trim().toLowerCase();
    if (!email) continue;
    try {
      let user = await userService.getByEmail(email);
      if (!user) {
        // Create placeholder displayName from email prefix
        const displayName = email.split('@')[0];
        user = await userService.create({ displayName, email });
      }
      await gameService.addUser(id, user.id, (body.role as any) || 'Reader');
      added.push({ email, role: (body.role as any) || 'Reader' });
    } catch (e: any) {
      // Skip individual failures, aggregate later
      added.push({ email, error: e?.message || 'failed' });
    }
  }
  const users = await gameService.getUsersDetailed(id);
  return new Response(JSON.stringify({ added, users }), { status: 200, headers: { 'content-type': 'application/json' } });
};
