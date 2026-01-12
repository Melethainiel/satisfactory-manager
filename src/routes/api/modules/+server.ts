import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { moduleService } from '$lib/server/services/moduleService';

// GET /api/modules - List all modules with optional search
export const GET: RequestHandler = async ({ url }) => {
	try {
		const search = url.searchParams.get('search');

		const options = search ? { search } : undefined;
		const modules = await moduleService.getAll(options);
		return json(modules);
	} catch (error) {
		console.error('Error loading modules:', error);
		return json({ error: 'Failed to load modules' }, { status: 500 });
	}
};

// POST /api/modules - Create a new module
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { name, url, githubRepo, manifestUrl, importMode } = await request.json();

		// Check if this is an import from YAML manifest
		if (importMode === 'yaml' && manifestUrl) {
			// Import mode - only manifestUrl is required
			if (!manifestUrl || typeof manifestUrl !== 'string' || !manifestUrl.trim()) {
				return json({ error: 'Manifest URL is required for import mode' }, { status: 400 });
			}

			// Validate manifest URL format
			try {
				const parsedUrl = new URL(manifestUrl.trim());
				if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
					return json(
						{ error: 'Invalid manifest URL format - URL must use http or https protocol' },
						{ status: 400 }
					);
				}
			} catch {
				return json({ error: 'Invalid manifest URL format' }, { status: 400 });
			}

			// Create module from YAML manifest
			const module = await moduleService.createFromUrl(manifestUrl.trim());
			return json(module, { status: 201 });
		} else {
			// Manual mode - existing validation logic
			if (!name || typeof name !== 'string' || !name.trim()) {
				return json({ error: 'Module name is required' }, { status: 400 });
			}

			// Validate module name length (matches database constraint)
			if (name.trim().length > 200) {
				return json({ error: 'Module name cannot exceed 200 characters' }, { status: 400 });
			}

			if (!url || typeof url !== 'string' || !url.trim()) {
				return json({ error: 'Module URL is required' }, { status: 400 });
			}

			// Validate URL format - must be a valid URL with http/https protocol
			try {
				const parsedUrl = new URL(url.trim());
				if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
					return json(
						{ error: 'Invalid URL format - URL must use http or https protocol' },
						{ status: 400 }
					);
				}
				// Additional validation: ensure hostname exists and is not just a dot
				if (!parsedUrl.hostname || parsedUrl.hostname === '.' || parsedUrl.hostname === '') {
					return json({ error: 'Invalid URL format' }, { status: 400 });
				}
			} catch {
				return json({ error: 'Invalid URL format' }, { status: 400 });
			}

			// Validate GitHub repo if provided (can be owner/repo format or full URL)
			if (githubRepo && typeof githubRepo === 'string' && githubRepo.trim()) {
				const repoPattern = /^[\w.-]+\/[\w.-]+$/; // owner/repo pattern
				if (!repoPattern.test(githubRepo.trim())) {
					try {
						new URL(githubRepo.trim());
					} catch {
						return json(
							{ error: 'Invalid GitHub repository format (expected owner/repo or full URL)' },
							{ status: 400 }
						);
					}
				}
			}

			// Check if module with same name already exists
			const existingModule = await moduleService.getByName(name.trim());
			if (existingModule) {
				return json({ error: 'A module with this name already exists' }, { status: 409 });
			}

			// Check if module with same URL already exists
			const existingUrlModule = await moduleService.getByUrl(url.trim());
			if (existingUrlModule) {
				return json({ error: 'A module with this URL already exists' }, { status: 409 });
			}

			const module = await moduleService.create({
				name: name.trim(),
				url: url.trim(),
				githubRepo: githubRepo?.trim() || null
			});

			// If GitHub repo is provided, try to fetch and sync versions
			if (githubRepo?.trim()) {
				try {
					await moduleService.fetchAndSyncVersionsFromGitHub(module.id);
				} catch (error) {
					console.warn('Failed to sync versions from GitHub:', error);
					// Don't fail the module creation if GitHub sync fails
				}
			}

			return json(module, { status: 201 });
		}
	} catch (error) {
		console.error('Error creating module:', error);

		// Return specific error message if available
		const errorMessage = error instanceof Error ? error.message : 'Failed to create module';

		return json({ error: errorMessage }, { status: 500 });
	}
};
