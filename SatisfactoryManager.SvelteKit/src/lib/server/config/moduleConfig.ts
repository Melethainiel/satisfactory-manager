/**
 * Configuration for module-related services
 * Centralizes all magic values and configurable parameters
 */

export interface ModuleServiceConfig {
	// URL Resolution Configuration
	urlResolution: {
		// Manifest file names to try, in order of priority
		manifestNames: string[];
		// Supported archive extensions for direct downloads
		archiveExtensions: string[];
		// Allowed domains for external requests (SSRF protection)
		allowedHosts: string[];
		// Suspicious patterns to reject in URLs
		suspiciousPatterns: string[];
	};

	// HTTP Request Configuration
	httpRequests: {
		// Request timeout in milliseconds
		timeoutMs: number;
		// User agent string for external requests
		userAgent: string;
	};

	// Archive Processing Configuration
	archiveProcessing: {
		// Maximum archive size in bytes (100MB)
		maxArchiveSize: number;
		// Download timeout in milliseconds
		downloadTimeoutMs: number;
		// Allowed archive extensions
		allowedExtensions: string[];
	};

	// Cache Configuration
	cache: {
		// Cache TTL in milliseconds (5 minutes)
		ttlMs: number;
		// Maximum number of entries in cache
		maxEntries: number;
	};
}

/**
 * Default configuration for module services
 */
export const DEFAULT_MODULE_CONFIG: ModuleServiceConfig = {
	urlResolution: {
		manifestNames: ['plugin.yaml', 'manifest.yaml', 'mod.yaml', 'module.yaml'],
		archiveExtensions: ['.zip', '.tar.gz', '.tar', '.rar'],
		allowedHosts: ['github.com', 'raw.githubusercontent.com', 'api.github.com'],
		suspiciousPatterns: [
			'/admin',
			'/internal',
			'localhost',
			'127.0.0.1',
			'::1',
			'metadata' // Cloud metadata endpoints
		]
	},

	httpRequests: {
		timeoutMs: 30000, // 30 seconds
		userAgent: 'SatisfactoryManager/1.0'
	},

	archiveProcessing: {
		maxArchiveSize: 100 * 1024 * 1024, // 100MB
		downloadTimeoutMs: 30000, // 30 seconds
		allowedExtensions: ['.zip']
	},

	cache: {
		ttlMs: 5 * 60 * 1000, // 5 minutes
		maxEntries: 1000 // Maximum cached entries
	}
};

/**
 * Get module service configuration
 * In the future, this could be extended to read from environment variables
 * or configuration files for deployment-specific settings
 */
export function getModuleConfig(): ModuleServiceConfig {
	// For now, return default config
	// TODO: Add environment variable overrides
	return DEFAULT_MODULE_CONFIG;
}

/**
 * Validate configuration values
 */
export function validateModuleConfig(config: ModuleServiceConfig): void {
	if (config.urlResolution.manifestNames.length === 0) {
		throw new Error('At least one manifest name must be configured');
	}

	if (config.urlResolution.allowedHosts.length === 0) {
		throw new Error('At least one allowed host must be configured');
	}

	if (config.httpRequests.timeoutMs <= 0) {
		throw new Error('HTTP timeout must be positive');
	}

	if (config.archiveProcessing.maxArchiveSize <= 0) {
		throw new Error('Max archive size must be positive');
	}

	if (config.cache.ttlMs <= 0) {
		throw new Error('Cache TTL must be positive');
	}

	if (config.cache.maxEntries <= 0) {
		throw new Error('Cache max entries must be positive');
	}
}
