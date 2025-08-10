import { db } from '../db';
import { users, type User, type NewUser } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface IUserService {
	getAll(): Promise<User[]>;
	getById(id: string): Promise<User | undefined>; // UUID
	getByEmail(email: string): Promise<User | undefined>;
	create(data: Omit<NewUser, 'id'>): Promise<User>;
	update(id: string, data: Partial<Omit<NewUser, 'id'>>): Promise<User | undefined>; // UUID
	delete(id: string): Promise<boolean>; // UUID
}

class UserService implements IUserService {
	async getAll(): Promise<User[]> {
		return await db.select().from(users).orderBy(users.id);
	}
	async getById(id: string): Promise<User | undefined> {
		const [row] = await db.select().from(users).where(eq(users.id, id));
		return row;
	}
	async getByEmail(email: string): Promise<User | undefined> {
		const [row] = await db.select().from(users).where(eq(users.email, email));
		return row;
	}
	async create(data: Omit<NewUser, 'id'>): Promise<User> {
		const [row] = await db.insert(users).values(data).returning();
		return row;
	}
	async update(id: string, data: Partial<Omit<NewUser, 'id'>>): Promise<User | undefined> {
		const [row] = await db
			.update(users)
			.set(data)
			.where(eq(users.id, id))
			.returning();
		return row;
	}
	async delete(id: string): Promise<boolean> {
		const res = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
		return res.length > 0;
	}
}

export const userService: IUserService = new UserService();
