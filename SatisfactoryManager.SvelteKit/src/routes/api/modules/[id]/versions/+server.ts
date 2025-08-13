import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { moduleService } from '$lib/server/services/moduleService';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const moduleId = params.id;

		if (!moduleId) {
			return json({ error: 'Module ID is required' }, { status: 400 });
		}

		// Check if module exists
		const module = await moduleService.getById(moduleId);
		if (!module) {
			return json({ error: 'Module not found' }, { status: 404 });
		}

		const versions = await moduleService.getVersions(moduleId);
		return json(versions);
	} catch (error) {
		console.error('Error loading module versions:', error);
		return json({ error: 'Failed to load module versions' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, params }) => {
	try {
		const moduleId = params.id;
		const { version, releaseUrl, releaseNotes, publishedAt } = await request.json();

		if (!moduleId) {
			return json({ error: 'Module ID is required' }, { status: 400 });
		}

		if (!version || typeof version !== 'string' || !version.trim()) {
			return json({ error: 'Version is required' }, { status: 400 });
		}

		// Check if module exists
		const module = await moduleService.getById(moduleId);
		if (!module) {
			return json({ error: 'Module not found' }, { status: 404 });
		}

		// Check if version already exists
		const existingVersions = await moduleService.getVersions(moduleId);
		const versionExists = existingVersions.some(v => v.version === version.trim());
		if (versionExists) {
			return json({ error: 'Version already exists' }, { status: 409 });
		}

		const newVersion = await moduleService.addVersion(moduleId, {
			version: version.trim(),
			releaseUrl: releaseUrl?.trim() || null,
			releaseNotes: releaseNotes?.trim() || null,
			publishedAt: publishedAt ? new Date(publishedAt) : new Date()
		});

		return json(newVersion, { status: 201 });
	} catch (error) {
		console.error('Error creating module version:', error);
		return json({ error: 'Failed to create module version' }, { status: 500 });
	}
};