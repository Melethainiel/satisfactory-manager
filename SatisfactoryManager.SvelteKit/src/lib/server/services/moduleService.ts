import { db } from '../db';
import {
	modules,
	moduleVersions,
	type Module,
	type NewModule,
	type ModuleVersion,
	type NewModuleVersion
} from '../db/schema';
import { eq, desc, ilike } from 'drizzle-orm';
import { githubService, type IModuleVersion } from './githubService';
import { yamlService, type IParsedModuleInfo } from './yamlService';

export interface IModuleService {
	getAll(options?: { search?: string }): Promise<Module[]>;
	getById(id: string): Promise<Module | undefined>; // UUID
	getByName(name: string): Promise<Module | undefined>;
	getByUrl(url: string): Promise<Module | undefined>;
	create(data: Omit<NewModule, 'id' | 'createdAt' | 'updatedAt'>): Promise<Module>;
	createFromUrl(manifestUrl: string): Promise<Module>;
	update(
		id: string,
		data: Partial<Omit<NewModule, 'id' | 'createdAt' | 'updatedAt'>>
	): Promise<Module | undefined>; // UUID
	delete(id: string): Promise<boolean>; // UUID

	// Version management methods
	getVersions(moduleId: string): Promise<ModuleVersion[]>;
	addVersion(
		moduleId: string,
		versionData: Omit<NewModuleVersion, 'id' | 'moduleId' | 'createdAt'>
	): Promise<ModuleVersion>;
	updateCurrentVersion(moduleId: string, version: string): Promise<Module | undefined>;
	fetchAndSyncVersionsFromGitHub(moduleId: string): Promise<ModuleVersion[]>;
	getAvailableVersionsFromGitHub(githubUrl: string): Promise<IModuleVersion[]>;

	// YAML manifest methods
	previewFromManifest(manifestUrl: string): Promise<IParsedModuleInfo>;
}

class ModuleService implements IModuleService {
	async getAll(options?: { search?: string }): Promise<Module[]> {
		if (options?.search) {
			return await db
				.select()
				.from(modules)
				.where(ilike(modules.name, `%${options.search}%`))
				.orderBy(modules.name);
		} else {
			return await db.select().from(modules).orderBy(modules.name);
		}
	}
	async getById(id: string): Promise<Module | undefined> {
		const [row] = await db.select().from(modules).where(eq(modules.id, id));
		return row;
	}
	async getByName(name: string): Promise<Module | undefined> {
		const [row] = await db.select().from(modules).where(eq(modules.name, name));
		return row;
	}
	async getByUrl(url: string): Promise<Module | undefined> {
		const [row] = await db.select().from(modules).where(eq(modules.url, url));
		return row;
	}
	async create(data: Omit<NewModule, 'id' | 'createdAt' | 'updatedAt'>): Promise<Module> {
		const [row] = await db.insert(modules).values(data).returning();
		return row;
	}
	async update(
		id: string,
		data: Partial<Omit<NewModule, 'id' | 'createdAt' | 'updatedAt'>>
	): Promise<Module | undefined> {
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

	async createFromUrl(manifestUrl: string): Promise<Module> {
		// Parse the YAML manifest
		const parsedInfo = await yamlService.fetchAndParseManifest(manifestUrl);

		// Check if module with same name already exists
		const existingModule = await this.getByName(parsedInfo.name);
		if (existingModule) {
			throw new Error(`A module with name "${parsedInfo.name}" already exists`);
		}

		// Determine the module URL (prefer from manifest, fallback to guess from manifestUrl)
		let moduleUrl = parsedInfo.url;
		if (!moduleUrl) {
			// Try to guess the repository URL from manifest URL
			try {
				const manifestUrlObj = new URL(manifestUrl);
				if (
					manifestUrlObj.hostname === 'github.com' ||
					manifestUrlObj.hostname === 'raw.githubusercontent.com'
				) {
					const pathParts = manifestUrlObj.pathname.split('/').filter((p) => p.length > 0);
					if (pathParts.length >= 2) {
						moduleUrl = `https://github.com/${pathParts[0]}/${pathParts[1]}`;
					}
				}
			} catch {
				// If we can't guess, we'll use the manifest URL as fallback
				moduleUrl = manifestUrl;
			}
		}

		// Check if module with same URL already exists
		if (moduleUrl) {
			const existingUrlModule = await this.getByUrl(moduleUrl);
			if (existingUrlModule) {
				throw new Error(`A module with URL "${moduleUrl}" already exists`);
			}
		}

		// Extract GitHub repo info if possible
		let githubRepo: string | null = null;
		if (moduleUrl) {
			const parsedRepo = githubService.parseGitHubUrl(moduleUrl);
			if (parsedRepo) {
				githubRepo = `${parsedRepo.owner}/${parsedRepo.repo}`;
			}
		}

		// Create the module with all parsed information
		const moduleData = {
			name: parsedInfo.name,
			url: moduleUrl || manifestUrl,
			description: parsedInfo.description || null,
			version: parsedInfo.version,
			dependencies:
				parsedInfo.dependencies.length > 0 ? JSON.stringify(parsedInfo.dependencies) : null,
			manifestUrl,
			downloadUrl: parsedInfo.downloadUrl || null,
			githubRepo
		};

		const module = await this.create(moduleData);

		// If GitHub repo is available, try to sync versions
		if (githubRepo) {
			try {
				await this.fetchAndSyncVersionsFromGitHub(module.id);
			} catch (error) {
				console.warn('Failed to sync versions from GitHub:', error);
				// Don't fail the module creation if GitHub sync fails
			}
		}

		return module;
	}

	async previewFromManifest(manifestUrl: string): Promise<IParsedModuleInfo> {
		return yamlService.fetchAndParseManifest(manifestUrl);
	}

	async getVersions(moduleId: string): Promise<ModuleVersion[]> {
		return await db
			.select()
			.from(moduleVersions)
			.where(eq(moduleVersions.moduleId, moduleId))
			.orderBy(desc(moduleVersions.publishedAt), desc(moduleVersions.createdAt));
	}

	async addVersion(
		moduleId: string,
		versionData: Omit<NewModuleVersion, 'id' | 'moduleId' | 'createdAt'>
	): Promise<ModuleVersion> {
		// Check if version already exists for this module
		const existingVersions = await this.getVersions(moduleId);
		const existingVersion = existingVersions.find((v) => v.version === versionData.version);
		if (existingVersion) {
			throw new Error(`Version ${versionData.version} already exists for this module`);
		}

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
		const existingVersionNumbers = new Set(existingVersions.map((v) => v.version));

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
