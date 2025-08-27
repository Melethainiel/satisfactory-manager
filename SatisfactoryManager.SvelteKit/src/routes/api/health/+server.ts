import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';

export const GET: RequestHandler = async () => {
	try {
		// Simple database connectivity check
		await db.execute(sql`SELECT 1`);
		
		return json({
			status: 'healthy',
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			database: 'connected'
		});
	} catch (error) {
		return json(
			{
				status: 'unhealthy',
				timestamp: new Date().toISOString(),
				uptime: process.uptime(),
				database: 'disconnected',
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 503 }
		);
	}
};