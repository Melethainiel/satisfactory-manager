import yaml from 'js-yaml';

export interface IModuleManifest {
	name: string;
	version: string;
	description?: string;
	dependencies?: string[];
	url?: string;
	download?: string;
	manifest?: string;
}

export interface IParsedModuleInfo {
	name: string;
	version: string;
	description?: string;
	dependencies: string[];
	url?: string;
	downloadUrl?: string;
	manifestUrl: string;
}

export interface IYamlService {
	fetchAndParseManifest(url: string): Promise<IParsedModuleInfo>;
	extractRepoNameFromUrl(url: string): string;
	validateManifest(manifest: any): IModuleManifest;
}

class YamlService implements IYamlService {
	private readonly fetchTimeout = 10000; // 10 seconds timeout

	async fetchAndParseManifest(manifestUrl: string): Promise<IParsedModuleInfo> {
		// Validate URL format
		try {
			new URL(manifestUrl);
		} catch {
			throw new Error('Invalid manifest URL format');
		}

		// Fetch YAML content with timeout
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.fetchTimeout);

		let yamlContent: string;
		try {
			const response = await fetch(manifestUrl, {
				signal: controller.signal,
				headers: {
					Accept: 'text/yaml, application/x-yaml, text/plain',
					'User-Agent': 'SatisfactoryManager/1.0'
				}
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				if (response.status === 404) {
					throw new Error('Manifest file not found at the provided URL');
				}
				throw new Error(`Failed to fetch manifest: HTTP ${response.status}`);
			}

			yamlContent = await response.text();
		} catch (error) {
			clearTimeout(timeoutId);

			if (error instanceof Error) {
				if (error.name === 'AbortError') {
					throw new Error('Request timeout - manifest file took too long to download');
				}
				throw error;
			}
			throw new Error('Network error while fetching manifest');
		}

		// Parse YAML content
		let parsedYaml: any;
		try {
			parsedYaml = yaml.load(yamlContent);
		} catch (error) {
			throw new Error('Invalid YAML format in manifest file');
		}

		// Validate and normalize manifest
		const manifest = this.validateManifest(parsedYaml);

		return {
			name: manifest.name,
			version: manifest.version,
			description: manifest.description,
			dependencies: manifest.dependencies || [],
			url: manifest.url,
			downloadUrl: manifest.download,
			manifestUrl
		};
	}

	extractRepoNameFromUrl(url: string): string {
		try {
			const urlObj = new URL(url);
			const pathParts = urlObj.pathname.split('/').filter((part) => part.length > 0);

			// For GitHub URLs: https://github.com/owner/repo
			if (urlObj.hostname === 'github.com' && pathParts.length >= 2) {
				return pathParts[1]; // Return repo name
			}

			// For other Git URLs, try to extract from path
			const lastPart = pathParts[pathParts.length - 1];
			if (lastPart) {
				// Remove .git extension if present
				return lastPart.replace(/\.git$/, '');
			}

			// Fallback: use hostname
			return urlObj.hostname.replace(/^www\./, '');
		} catch {
			throw new Error('Unable to extract repository name from URL');
		}
	}

	validateManifest(manifest: any): IModuleManifest {
		if (!manifest || typeof manifest !== 'object') {
			throw new Error('Manifest must be a valid YAML object');
		}

		// Validate required fields
		if (!manifest.name || typeof manifest.name !== 'string' || !manifest.name.trim()) {
			throw new Error('Manifest must contain a valid "name" field');
		}

		if (!manifest.version || typeof manifest.version !== 'string' || !manifest.version.trim()) {
			throw new Error('Manifest must contain a valid "version" field');
		}

		// Validate optional fields
		const validated: IModuleManifest = {
			name: manifest.name.trim(),
			version: manifest.version.trim()
		};

		if (manifest.description && typeof manifest.description === 'string') {
			validated.description = manifest.description.trim();
		}

		if (manifest.url && typeof manifest.url === 'string') {
			try {
				new URL(manifest.url.trim());
				validated.url = manifest.url.trim();
			} catch {
				throw new Error('Invalid URL format in manifest');
			}
		}

		if (manifest.download && typeof manifest.download === 'string') {
			try {
				new URL(manifest.download.trim());
				validated.download = manifest.download.trim();
			} catch {
				throw new Error('Invalid download URL format in manifest');
			}
		}

		if (manifest.manifest && typeof manifest.manifest === 'string') {
			try {
				new URL(manifest.manifest.trim());
				validated.manifest = manifest.manifest.trim();
			} catch {
				throw new Error('Invalid manifest URL format in manifest');
			}
		}

		if (manifest.dependencies) {
			if (Array.isArray(manifest.dependencies)) {
				validated.dependencies = manifest.dependencies
					.filter((dep: any) => typeof dep === 'string' && dep.trim())
					.map((dep: any) => dep.trim());
			} else {
				throw new Error('Dependencies must be an array of strings');
			}
		}

		return validated;
	}
}

export const yamlService: IYamlService = new YamlService();
