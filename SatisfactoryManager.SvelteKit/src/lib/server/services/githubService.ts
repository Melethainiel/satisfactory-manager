export interface GitHubRelease {
	id: number;
	tag_name: string;
	name: string;
	body: string;
	published_at: string;
	html_url: string;
	prerelease: boolean;
	draft: boolean;
}

export interface ParsedGitHubRepo {
	owner: string;
	repo: string;
}

export interface IModuleVersion {
	version: string;
	releaseUrl: string;
	releaseNotes: string;
	publishedAt: Date;
}

export interface IGitHubService {
	parseGitHubUrl(url: string): ParsedGitHubRepo | null;
	fetchReleases(owner: string, repo: string): Promise<GitHubRelease[]>;
	getModuleVersions(githubUrl: string): Promise<IModuleVersion[]>;
}

class GitHubService implements IGitHubService {
	private readonly baseUrl = 'https://api.github.com';

	parseGitHubUrl(url: string): ParsedGitHubRepo | null {
		try {
			const urlObj = new URL(url);
			
			if (urlObj.hostname !== 'github.com') {
				return null;
			}

			const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
			
			if (pathParts.length < 2) {
				return null;
			}

			return {
				owner: pathParts[0],
				repo: pathParts[1]
			};
		} catch {
			return null;
		}
	}

	async fetchReleases(owner: string, repo: string): Promise<GitHubRelease[]> {
		const url = `${this.baseUrl}/repos/${owner}/${repo}/releases`;
		
		try {
			const response = await fetch(url, {
				headers: {
					'Accept': 'application/vnd.github.v3+json',
					'User-Agent': 'SatisfactoryManager/1.0'
				}
			});

			if (!response.ok) {
				if (response.status === 404) {
					throw new Error(`Repository ${owner}/${repo} not found or has no releases`);
				}
				throw new Error(`GitHub API error: ${response.status}`);
			}

			const releases: GitHubRelease[] = await response.json();
			
			// Filter out drafts and sort by publication date (newest first)
			return releases
				.filter(release => !release.draft)
				.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
		} catch (error) {
			if (error instanceof Error) {
				throw error;
			}
			throw new Error('Failed to fetch releases from GitHub');
		}
	}

	async getModuleVersions(githubUrl: string): Promise<IModuleVersion[]> {
		const parsedRepo = this.parseGitHubUrl(githubUrl);
		
		if (!parsedRepo) {
			throw new Error('Invalid GitHub URL');
		}

		const releases = await this.fetchReleases(parsedRepo.owner, parsedRepo.repo);
		
		return releases.map(release => ({
			version: release.tag_name,
			releaseUrl: release.html_url,
			releaseNotes: release.body || '',
			publishedAt: new Date(release.published_at)
		}));
	}
}

export const githubService: IGitHubService = new GitHubService();