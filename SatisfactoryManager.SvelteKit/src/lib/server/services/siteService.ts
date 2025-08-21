import { db } from '../db';
import { sites, type Site, type NewSite } from '../db/schema';
import { eq, and, asc } from 'drizzle-orm';

export interface ISiteService {
	getAllForGame(gameId: string): Promise<Site[]>;
	getById(id: string): Promise<Site | undefined>;
	create(data: Omit<NewSite, 'id'>): Promise<Site>;
	update(id: string, data: Partial<Omit<NewSite, 'id' | 'gameId'>>): Promise<Site | undefined>;
	delete(id: string): Promise<boolean>;
}

class SiteService implements ISiteService {
	async getAllForGame(gameId: string): Promise<Site[]> {
		return await db
			.select()
			.from(sites)
			.where(eq(sites.gameId, gameId))
			.orderBy(asc(sites.name));
	}

	async getById(id: string): Promise<Site | undefined> {
		const [row] = await db.select().from(sites).where(eq(sites.id, id));
		return row;
	}

	async create(data: Omit<NewSite, 'id'>): Promise<Site> {
		const [row] = await db.insert(sites).values(data).returning();
		return row;
	}

	async update(id: string, data: Partial<Omit<NewSite, 'id' | 'gameId'>>): Promise<Site | undefined> {
		const [row] = await db.update(sites).set({
			...data,
			updatedAt: new Date()
		}).where(eq(sites.id, id)).returning();
		return row;
	}

	async delete(id: string): Promise<boolean> {
		const res = await db.delete(sites).where(eq(sites.id, id)).returning({ id: sites.id });
		return res.length > 0;
	}
}

export const siteService: ISiteService = new SiteService();