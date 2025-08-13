import { pgTable, varchar, uuid, primaryKey, pgEnum, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
	id: uuid('id').defaultRandom().primaryKey(),
	displayName: varchar('display_name', { length: 200 }).notNull(),
	email: varchar('email', { length: 320 }).notNull().unique()
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// Games table
export const games = pgTable('games', {
	id: uuid('id').defaultRandom().primaryKey(),
	name: varchar('name', { length: 200 }).notNull()
});

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;

// Module table
export const modules = pgTable('modules', {
	id: uuid('id').defaultRandom().primaryKey(),
	name: varchar('name', { length: 200 }).notNull(),
	url: varchar('url', { length: 2048 }).notNull(),
	currentVersion: varchar('current_version', { length: 100 }),
	githubRepo: varchar('github_repo', { length: 500 }),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export type Module = typeof modules.$inferSelect;
export type NewModule = typeof modules.$inferInsert;

// Module versions table to track available versions
export const moduleVersions = pgTable('module_versions', {
	id: uuid('id').defaultRandom().primaryKey(),
	moduleId: uuid('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
	version: varchar('version', { length: 100 }).notNull(),
	releaseUrl: varchar('release_url', { length: 2048 }),
	releaseNotes: varchar('release_notes', { length: 5000 }),
	publishedAt: timestamp('published_at'),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export type ModuleVersion = typeof moduleVersions.$inferSelect;
export type NewModuleVersion = typeof moduleVersions.$inferInsert;

// Authorization / role levels for a user within a game context
export const gameUserRoleEnum = pgEnum('game_user_role', [
	'Reader',
	'Contributor',
	'Administrator',
	'Owner'
]);

// Relations (many-to-many) User/Game
export const userGames = pgTable(
	'user_games',
	{
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		gameId: uuid('game_id')
			.notNull()
			.references(() => games.id, { onDelete: 'cascade' }),
		role: gameUserRoleEnum('role').notNull().default('Reader')
	},
	(t) => [primaryKey({ columns: [t.userId, t.gameId] })]
);

export const usersRelations = relations(users, ({ many }) => ({
	userGames: many(userGames)
}));

export const gamesRelations = relations(games, ({ many }) => ({
	userGames: many(userGames)
}));

export const userGamesRelations = relations(userGames, ({ one }) => ({
	user: one(users, {
		fields: [userGames.userId],
		references: [users.id]
	}),
	game: one(games, {
		fields: [userGames.gameId],
		references: [games.id]
	})
}));

export type UserGame = typeof userGames.$inferSelect;
export type NewUserGame = typeof userGames.$inferInsert;
export type GameUserRole = (typeof gameUserRoleEnum.enumValues)[number];

// Relations (many-to-many) Game/Module
export const moduleGames = pgTable(
	'module_games',
	{
		moduleId: uuid('module_id')
			.notNull()
			.references(() => modules.id, { onDelete: 'cascade' }),
		gameId: uuid('game_id')
			.notNull()
			.references(() => games.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.moduleId, t.gameId] })]
);

export const modulesRelation = relations(modules, ({ many }) => ({
	moduleGame: many(moduleGames),
	versions: many(moduleVersions)
}));

export const moduleVersionsRelations = relations(moduleVersions, ({ one }) => ({
	module: one(modules, {
		fields: [moduleVersions.moduleId],
		references: [modules.id]
	})
}));

export const gamesRelation = relations(games, ({ many }) => ({
	moduleGame: many(moduleGames)
}));

export const moduleGamesRelations = relations(moduleGames, ({ one }) => ({
	user: one(modules, {
		fields: [moduleGames.moduleId],
		references: [modules.id]
	}),
	game: one(games, {
		fields: [moduleGames.gameId],
		references: [games.id]
	})
}));
