import { pgTable, varchar, uuid, primaryKey } from 'drizzle-orm/pg-core';
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

// Junction table users <-> games (many-to-many)
// NOTE: The pgTable overload with the 3rd "extra config" callback shows a deprecated signature
// in the type hints, but this callback is STILL the current way to declare composite primary keys
// (and other multi-column constraints) in Drizzle as of 0.40.0. This code already uses the
// recommended pattern. The deprecation warning refers to the older form returning PgTableExtraConfig
// directly; Drizzle keeps the signature for backwards compatibility. Safe to keep until the library
// introduces a new API for composite PKs.
export const userGames = pgTable(
	'user_games',
	{
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		gameId: uuid('game_id')
			.notNull()
			.references(() => games.id, { onDelete: 'cascade' })
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
