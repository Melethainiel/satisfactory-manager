import { db } from '../db';
import { modules, type Module, type NewModule } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface IModuleService {
	getAll(): Promise<Module[]>;
	getById(id: string): Promise<Module | undefined>; // UUID
	getByName(name: string): Promise<Module | undefined>;
	create(data: Omit<NewModule, 'id'>): Promise<Module>;
	update(id: string, data: Partial<Omit<NewModule, 'id'>>): Promise<Module | undefined>; // UUID
	delete(id: string): Promise<boolean>; // UUID
}

class ModuleService implements IModuleService {
	async getAll(): Promise<Module[]> {
		return await db.select().from(modules).orderBy(modules.id);
	}
	async getById(id: string): Promise<Module | undefined> {
		const [row] = await db.select().from(modules).where(eq(modules.id, id));
		return row;
	}
	async getByName(name: string): Promise<Module | undefined> {
		const [row] = await db.select().from(modules).where(eq(modules.name, name));
		return row;
	}
	async create(data: Omit<NewModule, 'id'>): Promise<Module> {
		const [row] = await db.insert(modules).values(data).returning();
		return row;
	}
	async update(id: string, data: Partial<Omit<NewModule, 'id'>>): Promise<Module | undefined> {
		const [row] = await db
			.update(modules)
			.set(data)
			.where(eq(modules.id, id))
			.returning();
		return row;
	}
	async delete(id: string): Promise<boolean> {
		const res = await db.delete(modules).where(eq(modules.id, id)).returning({ id: modules.id });
		return res.length > 0;
	}
}

export const moduleService: IModuleService = new ModuleService();