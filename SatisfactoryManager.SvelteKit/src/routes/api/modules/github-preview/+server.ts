import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { moduleService } from '$lib/server/services/moduleService';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { githubUrl } = await request.json();

		if (!githubUrl || typeof githubUrl !== 'string' || !githubUrl.trim()) {
			return json({ error: 'GitHub URL is required' }, { status: 400 });
		}

		// Validate URL format
		try {
			new URL(githubUrl.trim());
		} catch {
			return json({ error: 'Invalid GitHub URL format' }, { status: 400 });
		}

		const versions = await moduleService.getAvailableVersionsFromGitHub(githubUrl.trim());

		return json({
			githubUrl: githubUrl.trim(),
			versions
		});
	} catch (error) {
		console.error('Error fetching GitHub versions:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to fetch versions from GitHub'
			},
			{ status: 500 }
		);
	}
};
