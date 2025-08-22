import * as yauzl from 'yauzl-promise';
import * as tmp from 'tmp';
import { promises as fs } from 'fs';
import * as path from 'path';
import { createWriteStream } from 'fs';

export interface IArchiveService {
	downloadAndExtractFile(archiveUrl: string, targetFilePath: string): Promise<string | null>;
	downloadArchive(url: string): Promise<string>;
	extractFileFromArchive(archivePath: string, targetFilePath: string): Promise<string | null>;
	cleanup(paths: string[]): Promise<void>;
}

export interface ArchiveExtractionOptions {
	maxArchiveSize?: number; // Default: 100MB
	downloadTimeout?: number; // Default: 30 seconds
	allowedExtensions?: string[]; // Default: ['.zip']
}

class ArchiveService implements IArchiveService {
	private readonly defaultOptions: Required<ArchiveExtractionOptions> = {
		maxArchiveSize: 100 * 1024 * 1024, // 100MB
		downloadTimeout: 30000, // 30 seconds
		allowedExtensions: ['.zip']
	};

	/**
	 * Downloads an archive from URL and extracts a specific file from it
	 * @param archiveUrl URL of the archive to download
	 * @param targetFilePath Path of the file to extract from archive (e.g., 'Files/items.yaml')
	 * @param options Extraction options
	 * @returns Content of the extracted file as string, or null if file not found
	 */
	async downloadAndExtractFile(
		archiveUrl: string,
		targetFilePath: string,
		options?: ArchiveExtractionOptions
	): Promise<string | null> {
		const opts = { ...this.defaultOptions, ...options };
		const tempFiles: string[] = [];

		try {
			// Download archive
			const archivePath = await this.downloadArchive(archiveUrl, opts);
			tempFiles.push(archivePath);

			// Extract target file
			const extractedContent = await this.extractFileFromArchive(archivePath, targetFilePath);

			return extractedContent;
		} catch (error) {
			console.error('Error downloading and extracting file:', error);
			throw error;
		} finally {
			// Cleanup temporary files
			await this.cleanup(tempFiles);
		}
	}

	/**
	 * Downloads an archive from URL to a temporary file
	 * @param url URL to download from
	 * @param options Download options
	 * @returns Path to the downloaded temporary file
	 */
	async downloadArchive(url: string, options?: ArchiveExtractionOptions): Promise<string> {
		const opts = { ...this.defaultOptions, ...options };

		// Validate URL
		let parsedUrl: URL;
		try {
			parsedUrl = new URL(url);
		} catch {
			throw new Error(`Invalid archive URL: ${url}`);
		}

		// Check file extension if URL has one
		const urlPath = parsedUrl.pathname.toLowerCase();
		const hasValidExtension = opts.allowedExtensions.some((ext) => urlPath.endsWith(ext));
		if (urlPath.includes('.') && !hasValidExtension) {
			throw new Error(`Unsupported archive format. Allowed: ${opts.allowedExtensions.join(', ')}`);
		}

		// Create temporary file
		const tempFile = tmp.fileSync({ prefix: 'archive-', postfix: '.zip' });
		const tempPath = tempFile.name;

		try {
			// Download with timeout and size limits
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), opts.downloadTimeout);

			const response = await fetch(url, {
				signal: controller.signal,
				headers: {
					'User-Agent': 'SatisfactoryManager/1.0'
				}
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				throw new Error(`Failed to download archive: ${response.status} ${response.statusText}`);
			}

			// Check content length
			const contentLength = response.headers.get('content-length');
			if (contentLength && parseInt(contentLength) > opts.maxArchiveSize) {
				throw new Error(`Archive too large: ${contentLength} bytes (max: ${opts.maxArchiveSize})`);
			}

			// Stream to temporary file with size monitoring
			if (!response.body) {
				throw new Error('No response body');
			}

			const writeStream = createWriteStream(tempPath);
			let downloadedSize = 0;

			const reader = response.body.getReader();
			const writer = writeStream;

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					downloadedSize += value.length;
					if (downloadedSize > opts.maxArchiveSize) {
						throw new Error(
							`Archive too large: ${downloadedSize} bytes (max: ${opts.maxArchiveSize})`
						);
					}

					writer.write(value);
				}
			} finally {
				reader.releaseLock();
				writer.end();
			}

			// Wait for write stream to finish
			await new Promise<void>((resolve, reject) => {
				writer.on('finish', () => resolve());
				writer.on('error', reject);
			});

			return tempPath;
		} catch (error) {
			// Cleanup temp file on error
			try {
				await fs.unlink(tempPath);
			} catch {
				// Ignore cleanup errors
			}
			throw error;
		}
	}

	/**
	 * Extracts a specific file from a ZIP archive
	 * @param archivePath Path to the archive file
	 * @param targetFilePath Path of file to extract (case-insensitive)
	 * @returns Content of the file as string, or null if not found
	 */
	async extractFileFromArchive(
		archivePath: string,
		targetFilePath: string
	): Promise<string | null> {
		let zip: yauzl.ZipFile | null = null;

		try {
			// Open ZIP file
			zip = await yauzl.open(archivePath);

			// Normalize target path for comparison (case-insensitive, forward slashes)
			const normalizedTarget = targetFilePath.toLowerCase().replace(/\\/g, '/');

			// Find the target file
			for await (const entry of zip) {
				// Skip directories
				if (entry.filename.endsWith('/')) {
					continue;
				}

				// Normalize entry filename for comparison
				const normalizedEntry = entry.filename.toLowerCase().replace(/\\/g, '/');

				// Check for exact match or match without leading slash
				const isMatch =
					normalizedEntry === normalizedTarget ||
					normalizedEntry === '/' + normalizedTarget ||
					normalizedEntry.endsWith('/' + normalizedTarget);

				if (isMatch) {
					// Validate path to prevent directory traversal
					if (this.containsUnsafePath(entry.filename)) {
						console.warn(`Skipping unsafe path: ${entry.filename}`);
						continue;
					}

					// Extract file content
					const readStream = await entry.openReadStream();
					const chunks: Buffer[] = [];

					return new Promise((resolve, reject) => {
						readStream.on('data', (chunk: Buffer) => {
							chunks.push(chunk);
						});

						readStream.on('end', async () => {
							try {
								const content = Buffer.concat(chunks).toString('utf-8');
								await zip!.close();
								resolve(content);
							} catch (error) {
								reject(error);
							}
						});

						readStream.on('error', async (error) => {
							try {
								await zip!.close();
							} catch (closeError) {
								console.warn('Failed to close ZIP after read error:', closeError);
							}
							reject(error);
						});
					});
				}
			}

			// File not found - close ZIP before returning
			if (zip) {
				await zip.close();
			}
			return null;
		} catch (error) {
			console.error('Error extracting file from archive:', error);
			// Close ZIP on error
			if (zip) {
				try {
					await zip.close();
				} catch (closeError) {
					console.warn('Failed to close ZIP after error:', closeError);
				}
			}
			throw new Error(`Failed to extract file from archive: ${error}`);
		}
	}

	/**
	 * Checks if a path contains unsafe directory traversal sequences
	 * @param filePath Path to check
	 * @returns True if path is unsafe
	 */
	private containsUnsafePath(filePath: string): boolean {
		const normalized = path.normalize(filePath);
		return (
			normalized.includes('..') ||
			normalized.startsWith('/') ||
			normalized.includes('\0') ||
			path.isAbsolute(normalized)
		);
	}

	/**
	 * Cleans up temporary files
	 * @param paths Array of file paths to delete
	 */
	async cleanup(paths: string[]): Promise<void> {
		for (const filePath of paths) {
			try {
				await fs.unlink(filePath);
			} catch (error) {
				// Log but don't throw - cleanup is best effort
				console.warn(`Failed to cleanup file ${filePath}:`, error);
			}
		}
	}
}

export const archiveService: IArchiveService = new ArchiveService();
