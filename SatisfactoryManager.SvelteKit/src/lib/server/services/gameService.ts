import { db } from '../db';
import {
	games,
	userGames,
	users,
	modules,
	moduleGames,
	moduleVersions,
	type Game,
	type NewGame,
	type UserGame,
	type GameUserRole
} from '../db/schema';
import { eq, and, asc, desc, like } from 'drizzle-orm';
import {
	productionInstanceMigrationService,
	type MigrationResult
} from './productionInstanceMigrationService';

export interface IGameService {
	getAll(): Promise<Game[]>;
	getById(id: string): Promise<Game | undefined>; // UUID
	create(data: Omit<NewGame, 'id'>): Promise<Game>;
	update(id: string, data: Partial<Omit<NewGame, 'id'>>): Promise<Game | undefined>;
	delete(id: string): Promise<boolean>;
	addUser(gameId: string, userId: string, role?: GameUserRole): Promise<UserGame>;
	removeUser(gameId: string, userId: string): Promise<boolean>;
	getUsers(gameId: string): Promise<UserGame[]>; // Could later join on users
	getUserDetailed(
		gameId: string,
		userId: string
	): Promise<{ id: string; displayName: string; email: string; role: GameUserRole } | undefined>;
	getUsersDetailed(
		gameId: string
	): Promise<{ id: string; displayName: string; email: string; role: GameUserRole }[]>; // Joined user details
	getForUserEmail(
		email: string,
		options?: {
			role?: GameUserRole;
			search?: string;
			sortBy?: 'name';
			sortOrder?: 'asc' | 'desc';
		}
	): Promise<(Game & { role: GameUserRole })[]>; // All games a user (by email) can access
	getGameModules(gameId: string): Promise<
		{
			id: string;
			name: string;
			url: string;
			currentVersion: string | null;
			selectedVersion: string | null;
			selectedVersionId: string | null;
			githubRepo: string | null;
			createdAt: Date;
			updatedAt: Date;
		}[]
	>;
	addModuleToGame(
		gameId: string,
		moduleId: string,
		selectedVersionId?: string
	): Promise<
		{
			id: string;
			name: string;
			url: string;
			currentVersion: string | null;
			selectedVersion: string | null;
			selectedVersionId: string | null;
			githubRepo: string | null;
			createdAt: Date;
			updatedAt: Date;
		}[]
	>;
	setModuleVersion(
		gameId: string,
		moduleId: string,
		versionId: string
	): Promise<{
		success: boolean;
		migrationResult?: MigrationResult;
	}>;
	removeModuleFromGame(gameId: string, moduleId: string): Promise<boolean>;
}

class GameService implements IGameService {
	async getAll(): Promise<Game[]> {
		return await db.select().from(games).orderBy(games.name);
	}
	async getById(id: string): Promise<Game | undefined> {
		const [row] = await db.select().from(games).where(eq(games.id, id));
		return row;
	}
	async create(data: Omit<NewGame, 'id'>): Promise<Game> {
		const [row] = await db.insert(games).values(data).returning();
		return row;
	}
	async update(id: string, data: Partial<Omit<NewGame, 'id'>>): Promise<Game | undefined> {
		const [row] = await db.update(games).set(data).where(eq(games.id, id)).returning();
		return row;
	}
	async delete(id: string): Promise<boolean> {
		const res = await db.delete(games).where(eq(games.id, id)).returning({ id: games.id });
		return res.length > 0;
	}
	async addUser(gameId: string, userId: string, role: GameUserRole = 'Reader'): Promise<UserGame> {
		const [row] = await db
			.insert(userGames)
			.values({ gameId, userId, role })
			.onConflictDoNothing()
			.returning();
		return row;
	}
	async removeUser(gameId: string, userId: string): Promise<boolean> {
		const res = await db
			.delete(userGames)
			.where(and(eq(userGames.gameId, gameId), eq(userGames.userId, userId)))
			.returning({ gameId: userGames.gameId });
		return res.length > 0;
	}
	async getUsers(gameId: string): Promise<UserGame[]> {
		return await db.select().from(userGames).where(eq(userGames.gameId, gameId));
	}
	async getUserDetailed(
		gameId: string,
		userId: string
	): Promise<{ id: string; displayName: string; email: string; role: GameUserRole } | undefined> {
		const [row] = await db
			.select({
				id: users.id,
				displayName: users.displayName,
				email: users.email,
				role: userGames.role
			})
			.from(userGames)
			.innerJoin(users, eq(users.id, userGames.userId))
			.where(and(eq(userGames.gameId, gameId), eq(users.id, userId)));
		return row;
	}
	async getUsersDetailed(
		gameId: string
	): Promise<{ id: string; displayName: string; email: string; role: GameUserRole }[]> {
		const rows = await db
			.select({
				id: users.id,
				displayName: users.displayName,
				email: users.email,
				role: userGames.role
			})
			.from(userGames)
			.innerJoin(users, eq(users.id, userGames.userId))
			.where(eq(userGames.gameId, gameId));
		return rows;
	}
	async getForUserEmail(
		email: string,
		options?: {
			role?: GameUserRole;
			search?: string;
			sortBy?: 'name';
			sortOrder?: 'asc' | 'desc';
		}
	): Promise<(Game & { role: GameUserRole })[]> {
		// Build conditions array
		const conditions = [eq(users.email, email)];

		if (options?.role) {
			conditions.push(eq(userGames.role, options.role));
		}

		if (options?.search) {
			conditions.push(like(games.name, `%${options.search}%`));
		}

		// Build query with proper ordering
		const orderFn = options?.sortBy === 'name' && options?.sortOrder === 'desc' ? desc : asc;
		const orderColumn = options?.sortBy === 'name' ? orderFn(games.name) : games.name;

		// Join users -> userGames -> games filtering by user email
		const query = db
			.select({
				id: games.id,
				name: games.name,
				createdAt: games.createdAt,
				updatedAt: games.updatedAt,
				role: userGames.role
			})
			.from(games)
			.innerJoin(userGames, eq(userGames.gameId, games.id))
			.innerJoin(users, eq(users.id, userGames.userId))
			.where(and(...conditions))
			.orderBy(orderColumn);

		return await query;
	}

	async getGameModules(gameId: string): Promise<
		{
			id: string;
			name: string;
			url: string;
			currentVersion: string | null;
			selectedVersion: string | null;
			selectedVersionId: string | null;
			githubRepo: string | null;
			createdAt: Date;
			updatedAt: Date;
		}[]
	> {
		const gameModules = await db
			.select({
				id: modules.id,
				name: modules.name,
				url: modules.url,
				currentVersion: modules.currentVersion,
				selectedVersion: moduleVersions.version,
				selectedVersionId: moduleGames.selectedVersionId,
				githubRepo: modules.githubRepo,
				createdAt: modules.createdAt,
				updatedAt: modules.updatedAt
			})
			.from(modules)
			.innerJoin(moduleGames, eq(modules.id, moduleGames.moduleId))
			.leftJoin(moduleVersions, eq(moduleGames.selectedVersionId, moduleVersions.id))
			.where(eq(moduleGames.gameId, gameId))
			.orderBy(modules.name);

		return gameModules;
	}

	async addModuleToGame(
		gameId: string,
		moduleId: string,
		selectedVersionId?: string
	): Promise<
		{
			id: string;
			name: string;
			url: string;
			currentVersion: string | null;
			selectedVersion: string | null;
			selectedVersionId: string | null;
			githubRepo: string | null;
			createdAt: Date;
			updatedAt: Date;
		}[]
	> {
		await db
			.insert(moduleGames)
			.values({
				gameId,
				moduleId,
				selectedVersionId
			})
			.onConflictDoNothing();

		// Return updated list of modules for the game
		return await this.getGameModules(gameId);
	}

	async removeModuleFromGame(gameId: string, moduleId: string): Promise<boolean> {
		const result = await db
			.delete(moduleGames)
			.where(and(eq(moduleGames.gameId, gameId), eq(moduleGames.moduleId, moduleId)))
			.returning({ gameId: moduleGames.gameId });

		return result.length > 0;
	}

	async setModuleVersion(
		gameId: string,
		moduleId: string,
		versionId: string
	): Promise<{
		success: boolean;
		migrationResult?: MigrationResult;
	}> {
		// Update the module version
		const result = await db
			.update(moduleGames)
			.set({ selectedVersionId: versionId })
			.where(and(eq(moduleGames.gameId, gameId), eq(moduleGames.moduleId, moduleId)))
			.returning({ gameId: moduleGames.gameId });

		if (result.length === 0) {
			return { success: false };
		}

		// Migrate production instances to the new version
		const migrationResult =
			await productionInstanceMigrationService.migrateProductionInstancesForGameModule(
				gameId,
				moduleId,
				versionId
			);

		return {
			success: true,
			migrationResult
		};
	}
}

export const gameService: IGameService = new GameService();
