import { db } from '../db';
import {
	items,
	itemVersions,
	type Item,
	type NewItem,
	type ItemVersion,
	type NewItemVersion,
	type ItemForm
} from '../db/schema';
import { eq, desc } from 'drizzle-orm';

export interface IItemService {
	// Item CRUD operations
	getAllItems(): Promise<Item[]>;
	getItemById(id: string): Promise<Item | undefined>;
	getItemByClassName(className: string): Promise<Item | undefined>;
	createItem(data: Omit<NewItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<Item>;
	updateItem(
		id: string,
		data: Partial<Omit<NewItem, 'id' | 'createdAt' | 'updatedAt'>>
	): Promise<Item | undefined>;
	deleteItem(id: string): Promise<boolean>;

	// Item version management
	getItemVersions(itemId: string): Promise<ItemVersion[]>;
	getItemVersionsByModuleVersion(moduleVersionId: string): Promise<ItemVersion[]>;
	addItemVersion(
		itemId: string,
		versionData: Omit<NewItemVersion, 'id' | 'itemId' | 'createdAt'>
	): Promise<ItemVersion>;
	getItemVersionByModuleAndItem(
		itemId: string,
		moduleVersionId: string
	): Promise<ItemVersion | undefined>;

	// Bulk operations
	bulkCreateItems(itemsData: Omit<NewItem, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Item[]>;
	bulkCreateItemVersions(
		versionsData: Omit<NewItemVersion, 'id' | 'createdAt'>[]
	): Promise<ItemVersion[]>;

	// Helper methods
	getItemsByForm(form: ItemForm): Promise<Item[]>;
}

class ItemService implements IItemService {
	async getAllItems(): Promise<Item[]> {
		return await db.select().from(items).orderBy(items.displayName);
	}

	async getItemById(id: string): Promise<Item | undefined> {
		const [row] = await db.select().from(items).where(eq(items.id, id));
		return row;
	}

	async getItemByClassName(className: string): Promise<Item | undefined> {
		const [row] = await db.select().from(items).where(eq(items.className, className));
		return row;
	}

	async createItem(data: Omit<NewItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<Item> {
		const [row] = await db.insert(items).values(data).returning();
		return row;
	}

	async updateItem(
		id: string,
		data: Partial<Omit<NewItem, 'id' | 'createdAt' | 'updatedAt'>>
	): Promise<Item | undefined> {
		const [row] = await db
			.update(items)
			.set({
				...data,
				updatedAt: new Date()
			})
			.where(eq(items.id, id))
			.returning();
		return row;
	}

	async deleteItem(id: string): Promise<boolean> {
		const res = await db.delete(items).where(eq(items.id, id)).returning({ id: items.id });
		return res.length > 0;
	}

	async getItemVersions(itemId: string): Promise<ItemVersion[]> {
		return await db
			.select()
			.from(itemVersions)
			.where(eq(itemVersions.itemId, itemId))
			.orderBy(desc(itemVersions.createdAt));
	}

	async getItemVersionsByModuleVersion(moduleVersionId: string): Promise<ItemVersion[]> {
		return await db
			.select()
			.from(itemVersions)
			.where(eq(itemVersions.moduleVersionId, moduleVersionId))
			.orderBy(itemVersions.itemId);
	}

	async addItemVersion(
		itemId: string,
		versionData: Omit<NewItemVersion, 'id' | 'itemId' | 'createdAt'>
	): Promise<ItemVersion> {
		const [version] = await db
			.insert(itemVersions)
			.values({
				itemId,
				...versionData
			})
			.returning();
		return version;
	}

	async getItemVersionByModuleAndItem(
		itemId: string,
		moduleVersionId: string
	): Promise<ItemVersion | undefined> {
		const [row] = await db
			.select()
			.from(itemVersions)
			.where(eq(itemVersions.itemId, itemId) && eq(itemVersions.moduleVersionId, moduleVersionId));
		return row;
	}

	async bulkCreateItems(
		itemsData: Omit<NewItem, 'id' | 'createdAt' | 'updatedAt'>[]
	): Promise<Item[]> {
		if (itemsData.length === 0) return [];
		return await db.insert(items).values(itemsData).returning();
	}

	async bulkCreateItemVersions(
		versionsData: Omit<NewItemVersion, 'id' | 'createdAt'>[]
	): Promise<ItemVersion[]> {
		if (versionsData.length === 0) return [];
		return await db.insert(itemVersions).values(versionsData).returning();
	}

	async getItemsByForm(form: ItemForm): Promise<Item[]> {
		return await db.select().from(items).where(eq(items.form, form)).orderBy(items.displayName);
	}
}

export const itemService: IItemService = new ItemService();
