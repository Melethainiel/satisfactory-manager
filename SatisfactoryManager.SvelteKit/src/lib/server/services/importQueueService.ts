import type { ArchiveContentImportResult } from './archiveContentService';

// Import queue entry status
export type ImportStatus = 
	| 'queued' 
	| 'processing' 
	| 'completed' 
	| 'failed' 
	| 'cancelled';

// Import queue entry interface
export interface ImportQueueEntry {
	id: string;
	moduleId: string;
	archiveUrl: string;
	moduleVersionId: string;
	status: ImportStatus;
	progress?: {
		currentPhase: string;
		itemsProcessed: number;
		totalItems?: number;
		percentComplete: number;
	};
	result?: ArchiveContentImportResult;
	error?: string;
	createdAt: Date;
	startedAt?: Date;
	completedAt?: Date;
}

// Queue configuration
const QUEUE_CONFIG = {
	MAX_CONCURRENT_IMPORTS: 3, // Maximum concurrent imports
	QUEUE_TIMEOUT: 30 * 60 * 1000, // 30 minutes timeout per import
	MAX_QUEUE_SIZE: 50, // Maximum number of queued imports
	CLEANUP_INTERVAL: 5 * 60 * 1000 // Cleanup completed entries every 5 minutes
};

export interface IImportQueueService {
	// Queue management
	queueImport(moduleId: string, archiveUrl: string, moduleVersionId: string): Promise<string>;
	getQueueStatus(importId: string): Promise<ImportQueueEntry | null>;
	getAllQueueEntries(): Promise<ImportQueueEntry[]>;
	getModuleQueueEntries(moduleId: string): Promise<ImportQueueEntry[]>;
	cancelImport(importId: string): Promise<boolean>;
	
	// Queue processing
	processQueue(): Promise<void>;
	isImportInProgress(moduleId: string): Promise<boolean>;
}

class ImportQueueService implements IImportQueueService {
	private queue = new Map<string, ImportQueueEntry>();
	private processingQueue = new Set<string>();
	private cleanupInterval: NodeJS.Timeout | null = null;

	constructor() {
		// Start cleanup timer
		this.startCleanupTimer();
	}

	/**
	 * Adds an import to the queue
	 */
	async queueImport(moduleId: string, archiveUrl: string, moduleVersionId: string): Promise<string> {
		// Check if import already in progress for this module
		const existingImport = Array.from(this.queue.values()).find(
			entry => entry.moduleId === moduleId && 
			(entry.status === 'queued' || entry.status === 'processing')
		);

		if (existingImport) {
			throw new Error(`Import already in progress for module ${moduleId} (ID: ${existingImport.id})`);
		}

		// Check queue size limit
		if (this.queue.size >= QUEUE_CONFIG.MAX_QUEUE_SIZE) {
			throw new Error('Import queue is full. Please try again later.');
		}

		// Generate unique import ID
		const importId = `import_${moduleId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		// Create queue entry
		const queueEntry: ImportQueueEntry = {
			id: importId,
			moduleId,
			archiveUrl,
			moduleVersionId,
			status: 'queued',
			createdAt: new Date()
		};

		this.queue.set(importId, queueEntry);

		console.log(`Queued import ${importId} for module ${moduleId}`);

		// Start processing queue
		setImmediate(() => this.processQueue());

		return importId;
	}

	/**
	 * Gets the status of a specific import
	 */
	async getQueueStatus(importId: string): Promise<ImportQueueEntry | null> {
		return this.queue.get(importId) || null;
	}

	/**
	 * Gets all queue entries
	 */
	async getAllQueueEntries(): Promise<ImportQueueEntry[]> {
		return Array.from(this.queue.values());
	}

	/**
	 * Gets queue entries for a specific module
	 */
	async getModuleQueueEntries(moduleId: string): Promise<ImportQueueEntry[]> {
		return Array.from(this.queue.values()).filter(entry => entry.moduleId === moduleId);
	}

	/**
	 * Cancels an import
	 */
	async cancelImport(importId: string): Promise<boolean> {
		const entry = this.queue.get(importId);
		
		if (!entry) {
			return false;
		}

		// Can only cancel queued imports
		if (entry.status === 'queued') {
			entry.status = 'cancelled';
			entry.completedAt = new Date();
			console.log(`Cancelled import ${importId}`);
			return true;
		}

		// Processing imports cannot be cancelled safely
		return false;
	}

	/**
	 * Checks if an import is in progress for a module
	 */
	async isImportInProgress(moduleId: string): Promise<boolean> {
		return Array.from(this.queue.values()).some(
			entry => entry.moduleId === moduleId && 
			(entry.status === 'queued' || entry.status === 'processing')
		);
	}

	/**
	 * Processes the import queue
	 */
	async processQueue(): Promise<void> {
		try {
			// Get queued entries
			const queuedEntries = Array.from(this.queue.values())
				.filter(entry => entry.status === 'queued')
				.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

			// Check how many are currently processing
			const processingCount = this.processingQueue.size;
			const availableSlots = QUEUE_CONFIG.MAX_CONCURRENT_IMPORTS - processingCount;

			if (availableSlots <= 0 || queuedEntries.length === 0) {
				return;
			}

			// Start processing available entries
			const entriesToProcess = queuedEntries.slice(0, availableSlots);

			for (const entry of entriesToProcess) {
				this.processImportEntry(entry);
			}

		} catch (error) {
			console.error('Error processing import queue:', error);
		}
	}

	/**
	 * Processes a single import entry
	 */
	private async processImportEntry(entry: ImportQueueEntry): Promise<void> {
		const { id, moduleId, archiveUrl, moduleVersionId } = entry;

		// Mark as processing
		entry.status = 'processing';
		entry.startedAt = new Date();
		this.processingQueue.add(id);

		console.log(`Starting import ${id} for module ${moduleId}`);

		try {
			// Import with timeout
			const importPromise = this.executeImport(archiveUrl, moduleVersionId, entry);
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(() => reject(new Error('Import timeout')), QUEUE_CONFIG.QUEUE_TIMEOUT);
			});

			const result = await Promise.race([importPromise, timeoutPromise]);

			// Mark as completed
			entry.status = 'completed';
			entry.result = result;
			entry.completedAt = new Date();

			console.log(`Completed import ${id} for module ${moduleId}`);

		} catch (error) {
			// Mark as failed
			entry.status = 'failed';
			entry.error = error instanceof Error ? error.message : String(error);
			entry.completedAt = new Date();

			console.error(`Failed import ${id} for module ${moduleId}:`, error);

		} finally {
			// Remove from processing set
			this.processingQueue.delete(id);

			// Continue processing queue
			setImmediate(() => this.processQueue());
		}
	}

	/**
	 * Executes the actual import with progress tracking
	 */
	private async executeImport(
		archiveUrl: string, 
		moduleVersionId: string, 
		entry: ImportQueueEntry
	): Promise<ArchiveContentImportResult> {
		// Dynamically import the service to avoid circular dependencies
		const { archiveContentService } = await import('./archiveContentService');

		// Update progress
		entry.progress = {
			currentPhase: 'Starting import',
			itemsProcessed: 0,
			percentComplete: 0
		};

		// Execute import
		const result = await archiveContentService.importContentFromArchive(archiveUrl, moduleVersionId);

		// Update final progress
		entry.progress = {
			currentPhase: 'Completed',
			itemsProcessed: result.summary.totalProcessed,
			totalItems: result.summary.totalProcessed,
			percentComplete: 100
		};

		return result;
	}

	/**
	 * Starts the cleanup timer to remove old entries
	 */
	private startCleanupTimer(): void {
		this.cleanupInterval = setInterval(() => {
			this.cleanupCompletedEntries();
		}, QUEUE_CONFIG.CLEANUP_INTERVAL);
	}

	/**
	 * Cleans up old completed/failed/cancelled entries
	 */
	private cleanupCompletedEntries(): void {
		const now = new Date().getTime();
		const entriesToRemove: string[] = [];

		for (const [id, entry] of this.queue.entries()) {
			// Remove entries older than 1 hour that are completed/failed/cancelled
			if ((entry.status === 'completed' || entry.status === 'failed' || entry.status === 'cancelled') &&
				entry.completedAt &&
				now - entry.completedAt.getTime() > 60 * 60 * 1000) { // 1 hour
				entriesToRemove.push(id);
			}
		}

		for (const id of entriesToRemove) {
			this.queue.delete(id);
		}

		if (entriesToRemove.length > 0) {
			console.log(`Cleaned up ${entriesToRemove.length} old import entries`);
		}
	}

	/**
	 * Cleanup resources when service is destroyed
	 */
	destroy(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}
	}
}

export const importQueueService: IImportQueueService = new ImportQueueService();