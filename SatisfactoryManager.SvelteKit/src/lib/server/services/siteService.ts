import { db } from '../db';
import { sites, type Site, type NewSite } from '../db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { gameDashboardService } from './gameDashboardService';
import { broadcastToGame } from './sseService.js';

export interface ISiteService {
	getAllForGame(gameId: string): Promise<Site[]>;
	getById(id: string): Promise<Site | undefined>;
	create(data: Omit<NewSite, 'id'>): Promise<Site>;
	update(id: string, data: Partial<Omit<NewSite, 'id' | 'gameId'>>): Promise<Site | undefined>;
	delete(id: string): Promise<boolean>;
}

class SiteService implements ISiteService {
	async getAllForGame(gameId: string): Promise<Site[]> {
		return await db.select().from(sites).where(eq(sites.gameId, gameId)).orderBy(asc(sites.name));
	}

	async getById(id: string): Promise<Site | undefined> {
		const [row] = await db.select().from(sites).where(eq(sites.id, id));
		return row;
	}

	async create(data: Omit<NewSite, 'id'>): Promise<Site> {
		const [row] = await db.insert(sites).values(data).returning();

		// Invalidate game dashboard cache when new site is created
		await gameDashboardService.onSiteChanged(data.gameId);

		// Broadcast real-time creation via SSE
		if (row) {
			console.log('📡 Broadcasting site_created to game:', data.gameId);
			broadcastToGame(data.gameId, {
				type: 'site_created',
				data: {
					gameId: data.gameId,
					siteId: row.id,
					siteName: row.name,
					userId: 'system',
					userName: 'System'
				}
			});
		}

		return row;
	}

	async update(
		id: string,
		data: Partial<Omit<NewSite, 'id' | 'gameId'>>
	): Promise<Site | undefined> {
		// Get the current site to find game ID for cache invalidation
		const currentSite = await db
			.select({ gameId: sites.gameId })
			.from(sites)
			.where(eq(sites.id, id))
			.limit(1);

		const [row] = await db
			.update(sites)
			.set({
				...data,
				updatedAt: new Date()
			})
			.where(eq(sites.id, id))
			.returning();

		// Invalidate game dashboard cache when site is updated
		if (currentSite.length > 0) {
			await gameDashboardService.onSiteChanged(currentSite[0].gameId);

			// Broadcast real-time update via SSE
			if (row) {
				console.log('📡 Broadcasting site_updated to game:', currentSite[0].gameId);
				broadcastToGame(currentSite[0].gameId, {
					type: 'site_updated',
					data: {
						gameId: currentSite[0].gameId,
						siteId: row.id,
						siteName: row.name,
						userId: 'system',
						userName: 'System'
					}
				});
			}
		}

		return row;
	}

	async delete(id: string): Promise<boolean> {
		// Get the site to find game ID for cache invalidation before deletion
		const currentSite = await db
			.select({ gameId: sites.gameId })
			.from(sites)
			.where(eq(sites.id, id))
			.limit(1);

		const res = await db.delete(sites).where(eq(sites.id, id)).returning({ id: sites.id });

		// Invalidate game dashboard cache when site is deleted
		if (res.length > 0 && currentSite.length > 0) {
			await gameDashboardService.onSiteChanged(currentSite[0].gameId);

			// Broadcast real-time deletion via SSE
			console.log('📡 Broadcasting site_deleted to game:', currentSite[0].gameId);
			broadcastToGame(currentSite[0].gameId, {
				type: 'site_deleted',
				data: {
					gameId: currentSite[0].gameId,
					siteId: res[0].id,
					userId: 'system',
					userName: 'System'
				}
			});
		}

		return res.length > 0;
	}
}

export const siteService: ISiteService = new SiteService();
