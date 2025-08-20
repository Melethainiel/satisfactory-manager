import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { gameService } from '$lib/server/services/gameService';
import { userService } from '$lib/server/services/userService';

// GET /api/games/[id]/users
export const GET: RequestHandler = async ({ params }) => {
	try {
		const id = params.id;
		if (!id) {
			return json({ error: 'Game ID is required' }, { status: 400 });
		}
		const users = await gameService.getUsersDetailed(id);
		return json(users);
	} catch (error) {
		console.error('Error fetching game users:', error);
		return json({ error: 'Failed to fetch game users' }, { status: 500 });
	}
};

// POST /api/games/[id]/users  { emails: string[], role?: string }
export const POST: RequestHandler = async ({ params, request, locals }) => {
	try {
		const id = params.id;
		if (!id) {
			return json({ error: 'Game ID is required' }, { status: 400 });
		}
		// Auth: rely on user populated by hooks.server.ts (event.locals.user)
		const callerEmail = locals.user?.email?.toLowerCase();
		if (!callerEmail) {
			return json({ error: 'unauthorized' }, { status: 401 });
		}
		const caller = await userService.getByEmail(callerEmail);
		if (!caller) {
			return json({ error: 'unauthorized' }, { status: 401 });
		}
		// Fetch caller role
		const userDetail = await gameService.getUserDetailed(id, caller.id);
		if (!userDetail || (userDetail.role !== 'Administrator' && userDetail.role !== 'Owner')) {
			return json({ error: 'forbidden' }, { status: 403 });
		}

		const body = (await request.json()) as { emails?: string[]; role?: string };
		if (!body.emails || !Array.isArray(body.emails) || body.emails.length === 0) {
			return json({ error: 'Emails array is required' }, { status: 400 });
		}
		const added: any[] = [];
		for (const raw of body.emails) {
			const email = (raw || '').trim().toLowerCase();
			if (!email) continue;
			try {
				let user = await userService.getByEmail(email);
				if (!user) {
					added.push({ email, error: 'User not found' });
					continue;
				}
				await gameService.addUser(id, user.id, (body.role as any) || 'Reader');
				added.push({ email, role: (body.role as any) || 'Reader' });
			} catch (e: any) {
				// Skip individual failures, aggregate later
				added.push({ email, error: e?.message || 'failed' });
			}
		}
		const users = await gameService.getUsersDetailed(id);
		return json({ added, users });
	} catch (error) {
		console.error('Error adding users to game:', error);
		return json({ error: 'Failed to add users to game' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, request, locals }) => {
	try {
		const id = params.id;
		if (!id) {
			return json({ error: 'Game ID is required' }, { status: 400 });
		}
		// Auth: rely on user populated by hooks.server.ts (event.locals.user)
		const callerEmail = locals.user?.email?.toLowerCase();
		if (!callerEmail) {
			return json({ error: 'unauthorized' }, { status: 401 });
		}
		const caller = await userService.getByEmail(callerEmail);
		if (!caller) {
			return json({ error: 'unauthorized' }, { status: 401 });
		}
		// Fetch caller role
		const userDetail = await gameService.getUserDetailed(id, caller.id);
		if (!userDetail || (userDetail.role !== 'Administrator' && userDetail.role !== 'Owner')) {
			return json({ error: 'forbidden' }, { status: 403 });
		}
		const body = (await request.json()) as { email: string };
		if (!body.email) {
			return json({ error: 'Email is required' }, { status: 400 });
		}
		let user = await userService.getByEmail(body.email.trim().toLowerCase());
		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		await gameService.removeUser(id, user.id);
		const users = await gameService.getUsersDetailed(id);
		return json({ users });
	} catch (error) {
		console.error('Error removing user from game:', error);
		return json({ error: 'Failed to remove user from game' }, { status: 500 });
	}
};

// PATCH /api/games/[id]/users  { email: string, role: string }
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	try {
		const id = params.id;
		if (!id) {
			return json({ error: 'Game ID is required' }, { status: 400 });
		}
		const callerEmail = locals.user?.email?.toLowerCase();
		if (!callerEmail) {
			return json({ error: 'unauthorized' }, { status: 401 });
		}
		const caller = await userService.getByEmail(callerEmail);
		if (!caller) {
			return json({ error: 'unauthorized' }, { status: 401 });
		}
		const callerDetail = await gameService.getUserDetailed(id, caller.id);
		if (!callerDetail || (callerDetail.role !== 'Administrator' && callerDetail.role !== 'Owner')) {
			return json({ error: 'forbidden' }, { status: 403 });
		}
		const body = (await request.json()) as { email?: string; role?: string };
		if (!body.email || !body.role) {
			return json({ error: 'Email and role are required' }, { status: 400 });
		}
		const targetEmail = body.email.trim().toLowerCase();
		const newRole = body.role.trim();
		if (!['Reader', 'Contributor', 'Administrator', 'Owner'].includes(newRole)) {
			return json({ error: 'invalid role' }, { status: 400 });
		}
		const target = await userService.getByEmail(targetEmail);
		if (!target) {
			return json({ error: 'User not found' }, { status: 404 });
		}
		// Prevent demoting self from Owner if they are sole owner (future enhancement: enforce at db)
		// Upsert by deleting then re-adding with new role (simplest given current service API)
		await gameService.removeUser(id, target.id);
		await gameService.addUser(id, target.id, newRole as any);
		const users = await gameService.getUsersDetailed(id);
		return json({ users });
	} catch (error) {
		console.error('Error updating user role in game:', error);
		return json({ error: 'Failed to update user role' }, { status: 500 });
	}
};
