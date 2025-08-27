import * as yaml from 'js-yaml';
import { z } from 'zod';

// Security limits for YAML processing
export const YAML_SECURITY_LIMITS = {
	MAX_CONTENT_SIZE: 10 * 1024 * 1024, // 10MB
	MAX_PARSE_DEPTH: 10, // Maximum nesting depth
	MAX_ARRAY_LENGTH: 10000, // Maximum array length
	MAX_STRING_LENGTH: 1000, // Maximum string field length
	PARSE_TIMEOUT: 30000 // 30 seconds timeout
};

// Zod schemas for validation
export const ArchiveItemSchema = z
	.object({
		className: z.string().min(1).max(YAML_SECURITY_LIMITS.MAX_STRING_LENGTH),
		displayName: z.string().min(1).max(YAML_SECURITY_LIMITS.MAX_STRING_LENGTH),
		description: z.string().max(YAML_SECURITY_LIMITS.MAX_STRING_LENGTH).optional(),
		form: z.enum(['RF_SOLID', 'RF_LIQUID', 'RF_GAS']),
		energyValue: z.number().nonnegative().optional(),
		extractionBuildings: z
			.array(z.string().min(1).max(YAML_SECURITY_LIMITS.MAX_STRING_LENGTH))
			.max(50)
			.optional(),
		fuelGenerators: z
			.array(z.string().min(1).max(YAML_SECURITY_LIMITS.MAX_STRING_LENGTH))
			.max(50)
			.optional()
	})
	.strict();

export const ArchiveBuildingSchema = z
	.object({
		className: z.string().min(1).max(YAML_SECURITY_LIMITS.MAX_STRING_LENGTH),
		name: z.string().min(1).max(YAML_SECURITY_LIMITS.MAX_STRING_LENGTH),
		type: z.enum(['Generator', 'Constructor', 'Miner']),
		energyConsumption: z.number().nonnegative().optional(),
		energyProduction: z.number().nonnegative().optional(),
		supplementalLoadAmount: z.number().nonnegative().optional(),
		output: z.number().nonnegative().optional()
	})
	.strict();

export const ArchiveRecipeIngredientSchema = z
	.object({
		item: z.string().min(1).max(YAML_SECURITY_LIMITS.MAX_STRING_LENGTH),
		count: z.number().positive()
	})
	.strict();

export const ArchiveRecipeProductSchema = z
	.object({
		item: z.string().min(1).max(YAML_SECURITY_LIMITS.MAX_STRING_LENGTH),
		count: z.number().positive()
	})
	.strict();

export const ArchiveRecipeSchema = z
	.object({
		className: z.string().min(1).max(YAML_SECURITY_LIMITS.MAX_STRING_LENGTH),
		displayName: z.string().min(1).max(YAML_SECURITY_LIMITS.MAX_STRING_LENGTH),
		manufacturingDuration: z.number().positive(),
		ingredients: z.array(ArchiveRecipeIngredientSchema).max(50), // Reasonable limit for recipe complexity
		products: z.array(ArchiveRecipeProductSchema).max(50),
		craftedIn: z.array(z.string().min(1).max(YAML_SECURITY_LIMITS.MAX_STRING_LENGTH)).max(20)
	})
	.strict();

// Generic YAML array schemas
export const ItemsArraySchema = z
	.array(ArchiveItemSchema)
	.max(YAML_SECURITY_LIMITS.MAX_ARRAY_LENGTH);
export const BuildingsArraySchema = z
	.array(ArchiveBuildingSchema)
	.max(YAML_SECURITY_LIMITS.MAX_ARRAY_LENGTH);
export const RecipesArraySchema = z
	.array(ArchiveRecipeSchema)
	.max(YAML_SECURITY_LIMITS.MAX_ARRAY_LENGTH);

// Custom error classes
export class YamlValidationError extends Error {
	constructor(
		message: string,
		public readonly cause?: Error
	) {
		super(message);
		this.name = 'YamlValidationError';
	}
}

export class YamlSecurityError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'YamlSecurityError';
	}
}

// Timeout wrapper for parsing operations
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
	return new Promise((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			reject(new YamlSecurityError(`YAML parsing timeout after ${timeoutMs}ms`));
		}, timeoutMs);

		promise
			.then(resolve)
			.catch(reject)
			.finally(() => clearTimeout(timeoutId));
	});
}

export interface IYamlValidationService {
	validateAndParseItemsYaml(yamlContent: string): Promise<any[]>;
	validateAndParseBuildingsYaml(yamlContent: string): Promise<any[]>;
	validateAndParseRecipesYaml(yamlContent: string): Promise<any[]>;

	// Streaming methods for large files
	validateAndParseItemsYamlStreaming(yamlContent: string): Promise<any[]>;
	validateAndParseBuildingsYamlStreaming(yamlContent: string): Promise<any[]>;
	validateAndParseRecipesYamlStreaming(yamlContent: string): Promise<any[]>;
}

class YamlValidationService implements IYamlValidationService {
	/**
	 * Safely parses YAML with security limits and validation
	 */
	private async parseYamlSafely(yamlContent: string): Promise<any> {
		// Check content size limits
		if (yamlContent.length > YAML_SECURITY_LIMITS.MAX_CONTENT_SIZE) {
			throw new YamlSecurityError(
				`YAML content too large: ${yamlContent.length} bytes (max ${YAML_SECURITY_LIMITS.MAX_CONTENT_SIZE})`
			);
		}

		// Wrap parsing in timeout
		const parsePromise = new Promise((resolve, reject) => {
			try {
				const parsed = yaml.load(yamlContent, {
					// Security options
					schema: yaml.CORE_SCHEMA, // Only allow core types, no custom constructors
					json: true, // Prevent prototype pollution
					filename: 'archive-content', // For better error messages
					onWarning: (warning) => {
						console.warn('YAML parsing warning:', warning);
					}
				});

				resolve(parsed);
			} catch (error) {
				reject(new YamlValidationError(`Failed to parse YAML: ${error}`));
			}
		});

		return await withTimeout(parsePromise, YAML_SECURITY_LIMITS.PARSE_TIMEOUT);
	}

	/**
	 * Extracts array from parsed YAML with various naming conventions
	 */
	private extractArrayFromYaml(parsedYaml: any, entityType: string): any[] {
		if (!parsedYaml) {
			throw new YamlValidationError('Invalid or empty YAML content');
		}

		// Direct array
		if (Array.isArray(parsedYaml)) {
			if (parsedYaml.length > YAML_SECURITY_LIMITS.MAX_ARRAY_LENGTH) {
				throw new YamlSecurityError(
					`Array too large: ${parsedYaml.length} items (max ${YAML_SECURITY_LIMITS.MAX_ARRAY_LENGTH})`
				);
			}
			return parsedYaml;
		}

		// Object with array property
		const possibleKeys = [
			entityType.toLowerCase(),
			entityType.charAt(0).toUpperCase() + entityType.slice(1),
			entityType.toLowerCase() + 's',
			entityType.charAt(0).toUpperCase() + entityType.slice(1) + 's'
		];

		for (const key of possibleKeys) {
			if (parsedYaml[key] && Array.isArray(parsedYaml[key])) {
				if (parsedYaml[key].length > YAML_SECURITY_LIMITS.MAX_ARRAY_LENGTH) {
					throw new YamlSecurityError(
						`Array too large: ${parsedYaml[key].length} items (max ${YAML_SECURITY_LIMITS.MAX_ARRAY_LENGTH})`
					);
				}
				return parsedYaml[key];
			}
		}

		// Try to find any array property as fallback
		const arrayProperties = Object.values(parsedYaml).filter((val) => Array.isArray(val));
		if (arrayProperties.length === 1) {
			const foundArray = arrayProperties[0] as any[];
			if (foundArray.length > YAML_SECURITY_LIMITS.MAX_ARRAY_LENGTH) {
				throw new YamlSecurityError(
					`Array too large: ${foundArray.length} items (max ${YAML_SECURITY_LIMITS.MAX_ARRAY_LENGTH})`
				);
			}
			return foundArray;
		}

		throw new YamlValidationError(
			`No ${entityType} array found. Expected: ${possibleKeys.join(', ')}`
		);
	}

	/**
	 * Validates items YAML with strict schema validation
	 */
	async validateAndParseItemsYaml(yamlContent: string): Promise<any[]> {
		try {
			const parsed = await this.parseYamlSafely(yamlContent);
			const itemsArray = this.extractArrayFromYaml(parsed, 'item');

			// Validate with Zod schema
			const validatedItems = ItemsArraySchema.parse(itemsArray);

			return validatedItems;
		} catch (error) {
			if (error instanceof z.ZodError) {
				const errorMessages = error.issues
					.map((err: any) => `${err.path.join('.')}: ${err.message}`)
					.join(', ');
				throw new YamlValidationError(`Items validation failed: ${errorMessages}`);
			}
			throw error;
		}
	}

	/**
	 * Validates buildings YAML with strict schema validation
	 */
	async validateAndParseBuildingsYaml(yamlContent: string): Promise<any[]> {
		try {
			const parsed = await this.parseYamlSafely(yamlContent);
			const buildingsArray = this.extractArrayFromYaml(parsed, 'building');

			// Validate with Zod schema
			const validatedBuildings = BuildingsArraySchema.parse(buildingsArray);

			return validatedBuildings;
		} catch (error) {
			if (error instanceof z.ZodError) {
				const errorMessages = error.issues
					.map((err: any) => `${err.path.join('.')}: ${err.message}`)
					.join(', ');
				throw new YamlValidationError(`Buildings validation failed: ${errorMessages}`);
			}
			throw error;
		}
	}

	/**
	 * Validates recipes YAML with strict schema validation
	 */
	async validateAndParseRecipesYaml(yamlContent: string): Promise<any[]> {
		try {
			const parsed = await this.parseYamlSafely(yamlContent);
			const recipesArray = this.extractArrayFromYaml(parsed, 'recipe');

			// Validate with Zod schema
			const validatedRecipes = RecipesArraySchema.parse(recipesArray);

			return validatedRecipes;
		} catch (error) {
			if (error instanceof z.ZodError) {
				const errorMessages = error.issues
					.map((err: any) => `${err.path.join('.')}: ${err.message}`)
					.join(', ');
				throw new YamlValidationError(`Recipes validation failed: ${errorMessages}`);
			}
			throw error;
		}
	}

	/**
	 * Process large YAML arrays in streaming chunks to avoid memory issues
	 */
	private async processArrayInChunks<T>(
		array: any[],
		schema: z.ZodSchema<T[]>,
		chunkSize: number = 1000
	): Promise<T[]> {
		const results: T[] = [];

		for (let i = 0; i < array.length; i += chunkSize) {
			// Process chunk
			const chunk = array.slice(i, i + chunkSize);

			// Validate chunk with schema
			const validatedChunk = schema.parse(chunk) as T[];
			results.push(...validatedChunk);

			// Allow event loop breathing room for large datasets
			if (i + chunkSize < array.length) {
				await new Promise((resolve) => setImmediate(resolve));
			}

			// Progress logging for very large datasets
			if (array.length > 5000 && i % 5000 === 0) {
				console.log(`Processed ${i + chunk.length}/${array.length} items...`);
			}
		}

		return results;
	}

	/**
	 * Streaming validation for large items YAML files
	 */
	async validateAndParseItemsYamlStreaming(yamlContent: string): Promise<any[]> {
		try {
			// Check if streaming is needed (large files)
			if (yamlContent.length < 1024 * 1024) {
				// < 1MB, use regular processing
				return await this.validateAndParseItemsYaml(yamlContent);
			}

			console.log('Using streaming processing for large items YAML file');
			const parsed = await this.parseYamlSafely(yamlContent);
			const itemsArray = this.extractArrayFromYaml(parsed, 'item');

			// Process in streaming chunks
			return await this.processArrayInChunks(itemsArray, ItemsArraySchema);
		} catch (error) {
			if (error instanceof z.ZodError) {
				const errorMessages = error.issues
					.map((err: any) => `${err.path.join('.')}: ${err.message}`)
					.join(', ');
				throw new YamlValidationError(`Items streaming validation failed: ${errorMessages}`);
			}
			throw error;
		}
	}

	/**
	 * Streaming validation for large buildings YAML files
	 */
	async validateAndParseBuildingsYamlStreaming(yamlContent: string): Promise<any[]> {
		try {
			// Check if streaming is needed (large files)
			if (yamlContent.length < 1024 * 1024) {
				// < 1MB, use regular processing
				return await this.validateAndParseBuildingsYaml(yamlContent);
			}

			console.log('Using streaming processing for large buildings YAML file');
			const parsed = await this.parseYamlSafely(yamlContent);
			const buildingsArray = this.extractArrayFromYaml(parsed, 'building');

			// Process in streaming chunks
			return await this.processArrayInChunks(buildingsArray, BuildingsArraySchema);
		} catch (error) {
			if (error instanceof z.ZodError) {
				const errorMessages = error.issues
					.map((err: any) => `${err.path.join('.')}: ${err.message}`)
					.join(', ');
				throw new YamlValidationError(`Buildings streaming validation failed: ${errorMessages}`);
			}
			throw error;
		}
	}

	/**
	 * Streaming validation for large recipes YAML files
	 */
	async validateAndParseRecipesYamlStreaming(yamlContent: string): Promise<any[]> {
		try {
			// Check if streaming is needed (large files)
			if (yamlContent.length < 1024 * 1024) {
				// < 1MB, use regular processing
				return await this.validateAndParseRecipesYaml(yamlContent);
			}

			console.log('Using streaming processing for large recipes YAML file');
			const parsed = await this.parseYamlSafely(yamlContent);
			const recipesArray = this.extractArrayFromYaml(parsed, 'recipe');

			// Process in streaming chunks
			return await this.processArrayInChunks(recipesArray, RecipesArraySchema);
		} catch (error) {
			if (error instanceof z.ZodError) {
				const errorMessages = error.issues
					.map((err: any) => `${err.path.join('.')}: ${err.message}`)
					.join(', ');
				throw new YamlValidationError(`Recipes streaming validation failed: ${errorMessages}`);
			}
			throw error;
		}
	}
}

export const yamlValidationService: IYamlValidationService = new YamlValidationService();
