import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { moduleService } from '$lib/server/services/moduleService';

export const GET: RequestHandler = async () => {
	try {
		const modules = await moduleService.getAll();
		return json(modules);
	} catch (error) {
		console.error('Error loading modules:', error);
		return json({ error: 'Failed to load modules' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { name, url, githubRepo } = await request.json();

		if (!name || typeof name !== 'string' || !name.trim()) {
			return json({ error: 'Module name is required' }, { status: 400 });
		}

		if (!url || typeof url !== 'string' || !url.trim()) {
			return json({ error: 'Module URL is required' }, { status: 400 });
		}

		// Validate URL format
		try {
			new URL(url.trim());
		} catch {
			return json({ error: 'Invalid URL format' }, { status: 400 });
		}

		// Validate GitHub repo URL if provided
		if (githubRepo && typeof githubRepo === 'string' && githubRepo.trim()) {
			try {
				new URL(githubRepo.trim());
			} catch {
				return json({ error: 'Invalid GitHub repository URL format' }, { status: 400 });
			}
		}

		// Check if module with same name already exists
		const existingModule = await moduleService.getByName(name.trim());
		if (existingModule) {
			return json({ error: 'A module with this name already exists' }, { status: 409 });
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
	} catch (error) {
		console.error('Error creating module:', error);
		return json({ error: 'Failed to create module' }, { status: 500 });
	}
};
