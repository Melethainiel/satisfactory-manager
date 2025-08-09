import { pgTable, serial, varchar } from 'drizzle-orm/pg-core';

// Users table with DisplayName and Email (unique)
// Using column-level unique() to avoid deprecated pgTable extraConfig signature.
export const users = pgTable('users', {
	id: serial('id').primaryKey(),
	displayName: varchar('display_name', { length: 200 }).notNull(),
	email: varchar('email', { length: 320 }).notNull().unique()
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
