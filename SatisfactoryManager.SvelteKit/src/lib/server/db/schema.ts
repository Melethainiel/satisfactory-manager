import { pgTable, varchar, uuid, primaryKey, pgEnum } from 'drizzle-orm/pg-core';
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

// Authorization / role levels for a user within a game context
export const gameUserRoleEnum = pgEnum('game_user_role', [
	'Reader',
	'Contributor',
	'Administrator',
	'Owner'
]);

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

// Relations (many-to-many) using Drizzle relations helper
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
