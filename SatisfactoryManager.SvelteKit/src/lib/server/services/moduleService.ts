import { db } from '../db';
import { modules, moduleVersions, type Module, type NewModule, type ModuleVersion, type NewModuleVersion } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { githubService, type IModuleVersion } from './githubService';

export interface IModuleService {
	getAll(): Promise<Module[]>;
	getById(id: string): Promise<Module | undefined>; // UUID
	getByName(name: string): Promise<Module | undefined>;
	create(data: Omit<NewModule, 'id' | 'createdAt' | 'updatedAt'>): Promise<Module>;
	update(id: string, data: Partial<Omit<NewModule, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Module | undefined>; // UUID
	delete(id: string): Promise<boolean>; // UUID
	
	// Version management methods
	getVersions(moduleId: string): Promise<ModuleVersion[]>;
	addVersion(moduleId: string, versionData: Omit<NewModuleVersion, 'id' | 'moduleId' | 'createdAt'>): Promise<ModuleVersion>;
	updateCurrentVersion(moduleId: string, version: string): Promise<Module | undefined>;
	fetchAndSyncVersionsFromGitHub(moduleId: string): Promise<ModuleVersion[]>;
	getAvailableVersionsFromGitHub(githubUrl: string): Promise<IModuleVersion[]>;
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
	async create(data: Omit<NewModule, 'id' | 'createdAt' | 'updatedAt'>): Promise<Module> {
		const [row] = await db.insert(modules).values(data).returning();
		return row;
	}
	async update(id: string, data: Partial<Omit<NewModule, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Module | undefined> {
		const [row] = await db
			.update(modules)
			.set({ 
				...data,
				updatedAt: new Date()
			})
			.where(eq(modules.id, id))
			.returning();
		return row;
	}
	async delete(id: string): Promise<boolean> {
		const res = await db.delete(modules).where(eq(modules.id, id)).returning({ id: modules.id });
		return res.length > 0;
	}

	async getVersions(moduleId: string): Promise<ModuleVersion[]> {
		return await db
			.select()
			.from(moduleVersions)
			.where(eq(moduleVersions.moduleId, moduleId))
			.orderBy(desc(moduleVersions.publishedAt), desc(moduleVersions.createdAt));
	}

	async addVersion(moduleId: string, versionData: Omit<NewModuleVersion, 'id' | 'moduleId' | 'createdAt'>): Promise<ModuleVersion> {
		const [version] = await db
			.insert(moduleVersions)
			.values({
				moduleId,
				...versionData
			})
			.returning();
		return version;
	}

	async updateCurrentVersion(moduleId: string, version: string): Promise<Module | undefined> {
		const [updatedModule] = await db
			.update(modules)
			.set({ 
				currentVersion: version,
				updatedAt: new Date()
			})
			.where(eq(modules.id, moduleId))
			.returning();
		return updatedModule;
	}

	async fetchAndSyncVersionsFromGitHub(moduleId: string): Promise<ModuleVersion[]> {
		// Get the module to find its GitHub URL
		const module = await this.getById(moduleId);
		if (!module || !module.githubRepo) {
			throw new Error('Module not found or does not have a GitHub repository');
		}

		// Fetch versions from GitHub
		const githubVersions = await githubService.getModuleVersions(module.githubRepo);

		// Get existing versions from database
		const existingVersions = await this.getVersions(moduleId);
		const existingVersionNumbers = new Set(existingVersions.map(v => v.version));

		// Add new versions to database
		const newVersions: ModuleVersion[] = [];
		for (const githubVersion of githubVersions) {
			if (!existingVersionNumbers.has(githubVersion.version)) {
				const newVersion = await this.addVersion(moduleId, {
					version: githubVersion.version,
					releaseUrl: githubVersion.releaseUrl,
					releaseNotes: githubVersion.releaseNotes,
					publishedAt: githubVersion.publishedAt
				});
				newVersions.push(newVersion);
			}
		}

		// Update current version to latest if not set
		if (!module.currentVersion && githubVersions.length > 0) {
			await this.updateCurrentVersion(moduleId, githubVersions[0].version);
		}

		return newVersions;
	}

	async getAvailableVersionsFromGitHub(githubUrl: string): Promise<IModuleVersion[]> {
		return await githubService.getModuleVersions(githubUrl);
	}
}

export const moduleService: IModuleService = new ModuleService();
