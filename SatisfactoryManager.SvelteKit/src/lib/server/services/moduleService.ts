import { db } from '../db';
import {
	type Module,
	type ModuleVersion,
	type NewModule,
	type NewModuleVersion,
	moduleVersions,
	modules
} from '../db/schema';
import { desc, eq, ilike } from 'drizzle-orm';
import { type IModuleVersion, githubService } from './githubService';
import { type IParsedModuleInfo, yamlService } from './yamlService';
import { type ArchiveContentImportResult, archiveContentService } from './archiveContentService';
import { importQueueService } from './importQueueService';
import { getModuleConfig, validateModuleConfig } from '../config/moduleConfig';

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
	getVersionById(versionId: string): Promise<ModuleVersion | undefined>;
	addVersion(
		moduleId: string,
		versionData: Omit<NewModuleVersion, 'id' | 'moduleId' | 'createdAt'>
	): Promise<ModuleVersion>;
	updateCurrentVersion(moduleId: string, version: string): Promise<Module | undefined>;
	fetchAndSyncVersionsFromGitHub(moduleId: string): Promise<ModuleVersion[]>;
	getAvailableVersionsFromGitHub(githubUrl: string): Promise<IModuleVersion[]>;

	// YAML manifest methods
	previewFromManifest(manifestUrl: string): Promise<IParsedModuleInfo>;

	// Archive import methods
	importContentFromModuleArchive(moduleId: string): Promise<ArchiveContentImportResult | null>;
	importContentFromVersionArchive(
		moduleId: string,
		versionId: string
	): Promise<ArchiveContentImportResult | null>;
	checkVersionContentExists(versionId: string): Promise<boolean>;
	queueContentImportFromModuleArchive(moduleId: string): Promise<string | null>;
}

class ModuleService implements IModuleService {
	private readonly config = getModuleConfig();

	constructor() {
		// Validate configuration on startup
		validateModuleConfig(this.config);
	}
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

		// Ensure we have at least one module version for item import
		const hasVersions = await this.getVersions(module.id);
		if (hasVersions.length === 0 && parsedInfo.version) {
			try {
				await this.addVersion(module.id, {
					version: parsedInfo.version,
					releaseUrl: parsedInfo.downloadUrl || null,
					releaseNotes: 'Version from manifest',
					publishedAt: new Date()
				});
				console.log(`Created version ${parsedInfo.version} for module ${module.name}`);
			} catch (error) {
				console.warn('Failed to create version from manifest:', error);
			}
		}

		// If module has download URL, queue content import from archive
		if (parsedInfo.downloadUrl) {
			try {
				const importId = await this.queueContentImportFromModuleArchive(module.id);
				if (importId) {
					console.log(`Queued content import for module ${module.name} (ID: ${importId})`);
				}
			} catch (error) {
				console.warn('Failed to queue content import from module archive:', error);
				// Don't fail the module creation if queue fails
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

	async getVersionById(versionId: string): Promise<ModuleVersion | undefined> {
		const [version] = await db
			.select()
			.from(moduleVersions)
			.where(eq(moduleVersions.id, versionId))
			.limit(1);
		return version;
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
		const githubVersions = await githubService.getModuleVersions(
			`https://github.com/${module.githubRepo}`
		);

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

	async importContentFromModuleArchive(
		moduleId: string
	): Promise<ArchiveContentImportResult | null> {
		// Get the module to check if it has a download URL
		const module = await this.getById(moduleId);
		if (!module || !module.downloadUrl) {
			return null;
		}

		// Get the latest version for this module to associate content with
		const versions = await this.getVersions(moduleId);
		if (versions.length === 0) {
			throw new Error(
				'No versions found for module. Cannot import content without a module version.'
			);
		}

		// Use the latest version (versions are ordered by date descending)
		const latestVersion = versions[0];

		// Import both items and buildings from the archive
		const importResult = await archiveContentService.importContentFromArchive(
			module.downloadUrl,
			latestVersion.id
		);

		return importResult;
	}

	async queueContentImportFromModuleArchive(moduleId: string): Promise<string | null> {
		// Get the module to check if it has a download URL
		const module = await this.getById(moduleId);
		if (!module || !module.downloadUrl) {
			return null;
		}

		// Get the latest version for this module to associate content with
		const versions = await this.getVersions(moduleId);
		if (versions.length === 0) {
			throw new Error(
				'No versions found for module. Cannot import content without a module version.'
			);
		}

		// Use the latest version (versions are ordered by date descending)
		const latestVersion = versions[0];

		// Queue the import
		const importId = await importQueueService.queueImport(
			moduleId,
			module.downloadUrl,
			latestVersion.id
		);

		return importId;
	}

	/**
	 * Detect the type of URL based on its structure
	 */
	private detectUrlType(
		url: string
	): 'github_release' | 'direct_download' | 'manifest' | 'unknown' {
		try {
			const urlObj = new URL(url);

			// GitHub release page URL
			if (urlObj.hostname === 'github.com' && url.includes('/releases/tag/')) {
				return 'github_release';
			}

			// Manifest URL (ends with .yaml or .yml)
			if (url.toLowerCase().endsWith('.yaml') || url.toLowerCase().endsWith('.yml')) {
				return 'manifest';
			}

			// Direct download URL (ends with .zip or similar archive formats)
			if (
				this.config.urlResolution.archiveExtensions.some((ext) => url.toLowerCase().endsWith(ext))
			) {
				return 'direct_download';
			}

			return 'unknown';
		} catch {
			return 'unknown';
		}
	}

	/**
	 * Build manifest URL from GitHub release URL with custom filename
	 * Transforms: https://github.com/user/repo/releases/tag/v1.0.0
	 * Into: https://github.com/user/repo/releases/download/v1.0.0/{manifestFileName}
	 */
	private buildManifestUrlFromRelease(
		releaseUrl: string,
		manifestFileName = 'plugin.yaml'
	): string {
		try {
			// Validate it's a GitHub release URL
			const url = new URL(releaseUrl);
			if (url.hostname !== 'github.com' || !releaseUrl.includes('/releases/tag/')) {
				throw new Error('Not a valid GitHub release URL');
			}

			// Transform the URL
			const manifestUrl =
				releaseUrl.replace('/releases/tag/', '/releases/download/') + `/${manifestFileName}`;
			return manifestUrl;
		} catch (error) {
			throw new Error(`Failed to build manifest URL from release URL: ${releaseUrl}`);
		}
	}

	/**
	 * Try multiple manifest names to find the correct one
	 * Returns the first working manifest data and the successful URL
	 */
	private async tryMultipleManifestNames(
		releaseUrl: string
	): Promise<{ manifestData: any; manifestUrl: string; attemptedNames: string[] }> {
		// Use configured manifest names in order of priority
		const attemptedNames: string[] = [];
		const errors: string[] = [];

		for (const manifestName of this.config.urlResolution.manifestNames) {
			attemptedNames.push(manifestName);
			try {
				const manifestUrl = this.buildManifestUrlFromRelease(releaseUrl, manifestName);
				console.log(`Trying manifest: ${manifestUrl}`);

				const manifestData = await yamlService.fetchAndParseManifest(manifestUrl);
				console.log(`Successfully found manifest: ${manifestName}`);

				return { manifestData, manifestUrl, attemptedNames };
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				errors.push(`${manifestName}: ${errorMsg}`);
				console.warn(`Failed to fetch manifest ${manifestName}:`, errorMsg);
			}
		}

		// If we reach here, none of the manifest names worked
		throw new Error(
			`Could not find manifest file. Tried: ${attemptedNames.join(', ')}. Errors: ${errors.join('; ')}`
		);
	}

	/**
	 * Validate that a URL is safe for external requests (SSRF protection)
	 */
	private async isUrlSafe(url: string): Promise<boolean> {
		try {
			const urlObj = new URL(url);

			// Only allow HTTPS for external requests (security requirement)
			if (urlObj.protocol !== 'https:') {
				console.warn(`Rejected non-HTTPS URL: ${url}`);
				return false;
			}

			// Allow only trusted domains to prevent SSRF attacks
			if (!this.config.urlResolution.allowedHosts.includes(urlObj.hostname)) {
				console.warn(`Rejected untrusted host: ${urlObj.hostname}`);
				return false;
			}

			// Reject suspicious paths or query parameters
			const fullUrl = url.toLowerCase();
			for (const pattern of this.config.urlResolution.suspiciousPatterns) {
				if (fullUrl.includes(pattern)) {
					console.warn(`Rejected URL with suspicious pattern: ${pattern}`);
					return false;
				}
			}

			return true;
		} catch (error) {
			console.warn(`URL validation failed: ${url}`, error);
			return false;
		}
	}

	/**
	 * Make a safe HTTP request with SSRF protection
	 */
	private async safeFetch(url: string, options: RequestInit = {}): Promise<Response> {
		// Validate URL safety first
		if (!(await this.isUrlSafe(url))) {
			throw new Error(`URL rejected for security reasons: ${url}`);
		}

		// Set secure defaults for fetch options
		const secureOptions: RequestInit = {
			...options,
			// Add timeout to prevent hanging requests
			signal: AbortSignal.timeout(this.config.httpRequests.timeoutMs),
			headers: {
				'User-Agent': this.config.httpRequests.userAgent,
				...options.headers
			}
		};

		try {
			const response = await fetch(url, secureOptions);

			// Check for suspicious redirects
			if (response.redirected) {
				const finalUrl = response.url;
				if (!(await this.isUrlSafe(finalUrl))) {
					throw new Error(`Redirect to unsafe URL detected: ${finalUrl}`);
				}
			}

			return response;
		} catch (error) {
			if (error instanceof Error && error.name === 'TimeoutError') {
				throw new Error(`Request timeout for URL: ${url}`);
			}
			throw error;
		}
	}

	/**
	 * Try different strategies to get a downloadable archive URL
	 */
	private async resolveDownloadUrl(url: string): Promise<string> {
		// Validate URL safety before processing
		if (!(await this.isUrlSafe(url))) {
			throw new Error(`URL rejected for security reasons: ${url}`);
		}

		const urlType = this.detectUrlType(url);

		switch (urlType) {
			case 'direct_download':
				// URL is already a direct download, return as-is
				return url;

			case 'manifest':
				// Parse manifest to get download URL
				const manifestData = await yamlService.fetchAndParseManifest(url);
				if (!manifestData.downloadUrl) {
					throw new Error('Manifest does not contain a download URL');
				}
				return manifestData.downloadUrl;

			case 'github_release':
				// Try to get manifest first, then extract download URL
				let manifestAttemptedNames: string[] = [];
				try {
					const { manifestData, manifestUrl, attemptedNames } =
						await this.tryMultipleManifestNames(url);
					manifestAttemptedNames = attemptedNames;
					if (manifestData.downloadUrl) {
						console.log(`Successfully resolved download URL from manifest: ${manifestUrl}`);
						return manifestData.downloadUrl;
					} else {
						console.warn(`Manifest found at ${manifestUrl} but no download URL specified`);
					}
				} catch (error) {
					console.warn(
						'Failed to get download URL from any manifest, will try direct asset approaches:',
						error
					);
				}

				// Fallback: try common asset patterns
				const fallbackUrls = [
					url.replace('/releases/tag/', '/releases/download/') +
						'/' +
						this.extractRepoNameFromUrl(url) +
						'.zip',
					url.replace('/releases/tag/', '/releases/download/') + '/release.zip',
					url.replace('/releases/tag/', '/releases/download/') + '/archive.zip'
				];

				const testedUrls: string[] = [];
				for (const fallbackUrl of fallbackUrls) {
					testedUrls.push(fallbackUrl);
					try {
						// Test if URL exists by making a secure HEAD request
						const response = await this.safeFetch(fallbackUrl, { method: 'HEAD' });
						if (response.ok) {
							console.log(`Successfully found direct download URL: ${fallbackUrl}`);
							return fallbackUrl;
						}
					} catch (error) {
						console.warn(`Failed to verify fallback URL: ${fallbackUrl}`, error);
						// Continue to next fallback
					}
				}

				// Provide detailed error message with all attempted approaches
				const errorDetails = [
					manifestAttemptedNames.length > 0
						? `Tried manifests: ${manifestAttemptedNames.join(', ')}`
						: 'No manifests were accessible',
					`Tried direct downloads: ${testedUrls.map((url) => url.split('/').pop()).join(', ')}`
				];

				throw new Error(
					`Could not resolve download URL from GitHub release. ${errorDetails.join('. ')}`
				);

			default:
				throw new Error(`Cannot resolve download URL for URL type: ${urlType}`);
		}
	}

	/**
	 * Extract repository name from URL for fallback download patterns
	 */
	private extractRepoNameFromUrl(url: string): string {
		try {
			const urlObj = new URL(url);
			const pathParts = urlObj.pathname.split('/').filter((part) => part.length > 0);

			if (pathParts.length >= 2) {
				return pathParts[1]; // Return repo name
			}

			throw new Error('Cannot extract repo name from URL');
		} catch {
			return 'archive'; // Generic fallback name
		}
	}

	async importContentFromVersionArchive(
		moduleId: string,
		versionId: string
	): Promise<ArchiveContentImportResult | null> {
		// Get the specific version
		const version = await this.getVersionById(versionId);
		if (!version) {
			throw new Error('Version not found');
		}

		// Check if the version has a releaseUrl to download from
		if (!version.releaseUrl) {
			throw new Error('Version does not have a release URL configured');
		}

		// Validate that the version belongs to the specified module
		if (version.moduleId !== moduleId) {
			throw new Error('Version does not belong to the specified module');
		}

		try {
			// Use intelligent URL resolution to get the actual download URL
			const downloadUrl = await this.resolveDownloadUrl(version.releaseUrl);

			// Import content from the resolved download URL with security limits
			const importResult = await archiveContentService.importContentFromArchive(
				downloadUrl,
				version.id
			);

			return importResult;
		} catch (error) {
			// Provide detailed error message with URL type information
			const urlType = this.detectUrlType(version.releaseUrl);
			if (error instanceof Error) {
				throw new Error(
					`Failed to import version content (URL type: ${urlType}): ${error.message}`
				);
			}
			throw new Error(`Failed to import version content (URL type: ${urlType})`);
		}
	}

	async checkVersionContentExists(versionId: string): Promise<boolean> {
		// Check if this version has any imported content (items, buildings, or recipes)
		// We'll use the archiveContentService to check for existing content linked to this version
		return await archiveContentService.hasContentForVersion(versionId);
	}
}

export const moduleService: IModuleService = new ModuleService();
