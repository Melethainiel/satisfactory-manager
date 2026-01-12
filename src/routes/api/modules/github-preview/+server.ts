import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { moduleService } from '$lib/server/services/moduleService';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const githubRepo = url.searchParams.get('githubRepo');

		if (!githubRepo || typeof githubRepo !== 'string' || !githubRepo.trim()) {
			return json({ error: 'githubRepo query parameter is required' }, { status: 400 });
		}

		// Validate GitHub repo format (owner/repo)
		const repoPattern = /^[\w.-]+\/[\w.-]+$/;
		if (!repoPattern.test(githubRepo.trim())) {
			return json(
				{ error: 'Invalid GitHub repository format (expected owner/repo)' },
				{ status: 400 }
			);
		}

		const githubUrl = `https://github.com/${githubRepo.trim()}`;
		const versions = await moduleService.getAvailableVersionsFromGitHub(githubUrl);

		return json({
			githubRepo: githubRepo.trim(),
			githubUrl,
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

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { githubUrl } = await request.json();

		if (!githubUrl || typeof githubUrl !== 'string' || !githubUrl.trim()) {
			return json({ error: 'GitHub URL is required' }, { status: 400 });
		}

		// Validate URL format and ensure it's from GitHub
		try {
			const url = new URL(githubUrl.trim());
			if (url.hostname !== 'github.com') {
				return json({ error: 'Only GitHub URLs are allowed' }, { status: 400 });
			}
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
