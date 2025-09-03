// Note: YAML parsing is now handled by yamlValidationService
import { type IArchiveService, archiveService } from './archiveService';
import { recipeService } from './recipeService';
import { yamlValidationService } from './yamlValidationService';
import { db } from '../db';
import { moduleVersions } from '../db/schema';
import { eq } from 'drizzle-orm';

// Interface for recipes as they appear in the Satisfactory mod archive YAML files
interface ArchiveRecipeData {
	className: string;
	displayName: string;
	manufacturingDuration: number;
	ingredients: Array<{
		item: string;
		count: number;
	}>;
	products: Array<{
		item: string;
		count: number;
	}>;
	craftedIn: string[];
	// Additional fields that might exist but we don't use yet
	[key: string]: any;
}

// Interface for the converted format that matches our existing import API
interface ImportRecipeData {
	className: string;
	displayName: string;
	manufacturingDuration: number;
	ingredients: Array<{
		itemClassName: string;
		count: string;
	}>;
	products: Array<{
		itemClassName: string;
		count: string;
	}>;
	craftedIn: Array<{
		buildingClassName: string;
	}>;
}

export interface ArchiveRecipeImportResult {
	totalRecipes: number;
	validRecipes: number;
	importResults: {
		created: number;
		updated: number;
		versionsCreated: number;
		errors: string[];
	};
}

export interface IArchiveRecipeService {
	importRecipesFromArchive(
		archiveUrl: string,
		moduleVersionId: string
	): Promise<ArchiveRecipeImportResult>;
	importRecipesFromYamlContent(
		yamlContent: string,
		moduleVersionId: string
	): Promise<ArchiveRecipeImportResult>;
	parseRecipesYaml(yamlContent: string): Promise<ImportRecipeData[]>;
	validateArchiveRecipe(recipe: any, index: number): ArchiveRecipeData | null;
	convertToImportFormat(archiveRecipe: ArchiveRecipeData): ImportRecipeData;
}

class ArchiveRecipeService implements IArchiveRecipeService {
	constructor(private archiveService: IArchiveService) {}

	/**
	 * Downloads an archive, extracts and imports recipes from Files/recipes.yaml
	 * @param archiveUrl URL of the archive to download
	 * @param moduleVersionId Module version to associate recipes with
	 * @returns Import results with statistics
	 */
	async importRecipesFromArchive(
		archiveUrl: string,
		moduleVersionId: string
	): Promise<ArchiveRecipeImportResult> {
		try {
			// Download and extract the recipes.yaml file
			const yamlContent = await this.archiveService.downloadAndExtractFile(
				archiveUrl,
				'Files/recipes.yaml'
			);

			if (!yamlContent) {
				// Recipes file is optional, don't throw error
				return {
					totalRecipes: 0,
					validRecipes: 0,
					importResults: {
						created: 0,
						updated: 0,
						versionsCreated: 0,
						errors: []
					}
				};
			}

			// Parse YAML content
			const importRecipes = await this.parseRecipesYaml(yamlContent);

			if (importRecipes.length === 0) {
				return {
					totalRecipes: 0,
					validRecipes: 0,
					importResults: {
						created: 0,
						updated: 0,
						versionsCreated: 0,
						errors: ['No valid recipes found in Files/recipes.yaml']
					}
				};
			}

			// Use existing recipe import logic
			const results = await this.importRecipesBulk(importRecipes, moduleVersionId);

			return {
				totalRecipes: importRecipes.length,
				validRecipes: importRecipes.length,
				importResults: results
			};
		} catch (error) {
			console.error('Error importing recipes from archive:', error);
			throw new Error(`Failed to import recipes from archive: ${error}`);
		}
	}

	/**
	 * Imports recipes directly from YAML content without downloading
	 * @param yamlContent Raw YAML content string
	 * @param moduleVersionId Module version to associate recipes with
	 * @returns Import results with statistics
	 */
	async importRecipesFromYamlContent(
		yamlContent: string,
		moduleVersionId: string
	): Promise<ArchiveRecipeImportResult> {
		try {
			// Parse YAML content
			const importRecipes = await this.parseRecipesYaml(yamlContent);

			if (importRecipes.length === 0) {
				return {
					totalRecipes: 0,
					validRecipes: 0,
					importResults: {
						created: 0,
						updated: 0,
						versionsCreated: 0,
						errors: ['No valid recipes found in YAML content']
					}
				};
			}

			// Use existing recipe import logic
			const results = await this.importRecipesBulk(importRecipes, moduleVersionId);

			return {
				totalRecipes: importRecipes.length,
				validRecipes: importRecipes.length,
				importResults: results
			};
		} catch (error) {
			console.error('Error importing recipes from YAML content:', error);
			throw new Error(`Failed to import recipes from YAML content: ${error}`);
		}
	}

	/**
	 * Parses YAML content and converts recipes to import format
	 * @param yamlContent Raw YAML content string
	 * @returns Array of recipes in import format
	 */
	async parseRecipesYaml(yamlContent: string): Promise<ImportRecipeData[]> {
		try {
			// Use secure YAML validation service
			const validatedRecipes = await yamlValidationService.validateAndParseRecipesYaml(yamlContent);

			// Convert validated recipes to import format
			const importRecipes: ImportRecipeData[] = validatedRecipes.map((recipe) =>
				this.convertToImportFormat(recipe)
			);

			return importRecipes;
		} catch (error) {
			console.error('Error parsing recipes YAML with security validation:', error);
			throw new Error(`Failed to parse recipes YAML: ${error}`);
		}
	}

	/**
	 * Validates and normalizes a recipe from the archive
	 * @param recipe Raw recipe data from YAML
	 * @param index Index for error reporting
	 * @returns Validated recipe or null if invalid
	 */
	validateArchiveRecipe(recipe: any, index: number): ArchiveRecipeData | null {
		try {
			// Check required fields
			if (!recipe || typeof recipe !== 'object') {
				console.warn(`Recipe at index ${index} is not an object`);
				return null;
			}

			// Handle both camelCase and PascalCase formats
			const className = recipe.className || recipe.ClassName;
			const displayName = recipe.displayName || recipe.DisplayName;
			const manufacturingDuration =
				recipe.manufactoringDuration !== undefined
					? recipe.manufactoringDuration
					: recipe.ManufactoringDuration;
			const ingredients = recipe.ingredients || recipe.Ingredients;
			const products = recipe.products || recipe.Products;
			const craftedIn = recipe.craftedIn || recipe.CraftedIn;

			if (!className || typeof className !== 'string' || !className.trim()) {
				console.warn(`Recipe at index ${index} missing or invalid className/ClassName`);
				return null;
			}

			if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
				console.warn(`Recipe at index ${index} missing or invalid displayName/DisplayName`);
				return null;
			}

			// Validate manufacturingDuration
			if (manufacturingDuration === undefined || manufacturingDuration === null) {
				console.warn(
					`Recipe at index ${index} (${className}) missing manufacturingDuration/ManufacturingDuration`
				);
				return null;
			}

			const numericDuration = Number(manufacturingDuration);
			if (isNaN(numericDuration) || numericDuration <= 0) {
				console.warn(
					`Recipe at index ${index} (${className}) has invalid manufacturingDuration: ${manufacturingDuration}`
				);
				return null;
			}

			// Validate ingredients array
			if (!Array.isArray(ingredients) || ingredients.length === 0) {
				console.warn(`Recipe at index ${index} (${className}) missing or empty ingredients array`);
				return null;
			}

			const validatedIngredients: Array<{ item: string; count: number }> = [];
			for (let i = 0; i < ingredients.length; i++) {
				const ing = ingredients[i];
				const item = ing.item || ing.Item;
				const count = ing.count !== undefined ? ing.count : ing.Count;

				if (!item || typeof item !== 'string' || !item.trim()) {
					console.warn(
						`Recipe at index ${index} (${className}) ingredient ${i} missing or invalid item/Item`
					);
					return null;
				}

				if (count === undefined || count === null) {
					console.warn(
						`Recipe at index ${index} (${className}) ingredient ${i} missing count/Count`
					);
					return null;
				}

				const numericCount = Number(count);
				if (isNaN(numericCount) || numericCount <= 0) {
					console.warn(
						`Recipe at index ${index} (${className}) ingredient ${i} has invalid count: ${count}`
					);
					return null;
				}

				validatedIngredients.push({
					item: item.trim(),
					count: numericCount
				});
			}

			// Validate products array
			if (!Array.isArray(products) || products.length === 0) {
				console.warn(`Recipe at index ${index} (${className}) missing or empty products array`);
				return null;
			}

			const validatedProducts: Array<{ item: string; count: number }> = [];
			for (let i = 0; i < products.length; i++) {
				const prod = products[i];
				const item = prod.item || prod.Item;
				const count = prod.count !== undefined ? prod.count : prod.Count;

				if (!item || typeof item !== 'string' || !item.trim()) {
					console.warn(
						`Recipe at index ${index} (${className}) product ${i} missing or invalid item/Item`
					);
					return null;
				}

				if (count === undefined || count === null) {
					console.warn(`Recipe at index ${index} (${className}) product ${i} missing count/Count`);
					return null;
				}

				const numericCount = Number(count);
				if (isNaN(numericCount) || numericCount <= 0) {
					console.warn(
						`Recipe at index ${index} (${className}) product ${i} has invalid count: ${count}`
					);
					return null;
				}

				validatedProducts.push({
					item: item.trim(),
					count: numericCount
				});
			}

			// Validate craftedIn array
			if (!Array.isArray(craftedIn) || craftedIn.length === 0) {
				console.warn(
					`Recipe at index ${index} (${className}) missing or empty craftedIn/CraftedIn array`
				);
				return null;
			}

			const validatedCraftedIn: string[] = [];
			for (let i = 0; i < craftedIn.length; i++) {
				const building = craftedIn[i];
				if (!building || typeof building !== 'string' || !building.trim()) {
					console.warn(
						`Recipe at index ${index} (${className}) craftedIn ${i} is not a valid string`
					);
					return null;
				}
				validatedCraftedIn.push(building.trim());
			}

			// Return validated recipe with normalized field names
			return {
				className: className.trim(),
				displayName: displayName.trim(),
				manufacturingDuration: numericDuration,
				ingredients: validatedIngredients,
				products: validatedProducts,
				craftedIn: validatedCraftedIn
			};
		} catch (error) {
			console.warn(`Error validating recipe at index ${index}:`, error);
			return null;
		}
	}

	/**
	 * Converts archive recipe format to existing import API format
	 * @param archiveRecipe Validated archive recipe
	 * @returns Recipe in import format
	 */
	convertToImportFormat(archiveRecipe: ArchiveRecipeData): ImportRecipeData {
		return {
			className: archiveRecipe.className,
			displayName: archiveRecipe.displayName,
			manufacturingDuration: archiveRecipe.manufacturingDuration,
			ingredients: archiveRecipe.ingredients.map((ing) => ({
				itemClassName: ing.item,
				count: ing.count.toString()
			})),
			products: archiveRecipe.products.map((prod) => ({
				itemClassName: prod.item,
				count: prod.count.toString()
			})),
			craftedIn: archiveRecipe.craftedIn.map((building) => ({
				buildingClassName: building
			}))
		};
	}

	/**
	 * Uses existing recipe service to import recipes in bulk
	 * @param recipes Recipes to import
	 * @param moduleVersionId Module version to associate with
	 * @returns Import results
	 */
	private async importRecipesBulk(
		recipes: ImportRecipeData[],
		moduleVersionId: string
	): Promise<{ created: number; updated: number; versionsCreated: number; errors: string[] }> {
		const results = {
			created: 0,
			updated: 0,
			versionsCreated: 0,
			errors: [] as string[]
		};

		// Get the moduleId from moduleVersionId
		const [moduleVersion] = await db
			.select()
			.from(moduleVersions)
			.where(eq(moduleVersions.id, moduleVersionId));

		if (!moduleVersion) {
			throw new Error(`Module version ${moduleVersionId} not found`);
		}

		// Process recipes in batches to avoid overwhelming the database
		const batchSize = 50; // Smaller batch size for recipes due to complexity
		for (let i = 0; i < recipes.length; i += batchSize) {
			const batch = recipes.slice(i, i + batchSize);

			for (const recipeData of batch) {
				try {
					// Check if recipe exists
					let recipe = await recipeService.getRecipeByClassName(recipeData.className);

					if (!recipe) {
						// Create new recipe
						recipe = await recipeService.createRecipe({
							moduleId: moduleVersion.moduleId,
							className: recipeData.className,
							displayName: recipeData.displayName
						});
						results.created++;
					} else {
						// Check if recipe needs updating
						const needsUpdate = recipe.displayName !== recipeData.displayName;

						if (needsUpdate) {
							recipe = await recipeService.updateRecipe(recipe.id, {
								displayName: recipeData.displayName
							});
							results.updated++;
						}
					}

					if (recipe) {
						// Check if recipe version already exists for this module version
						const existingVersion = await recipeService.getRecipeVersionByModuleAndRecipe(
							recipe.id,
							moduleVersionId
						);

						if (!existingVersion) {
							// Create recipe version with ingredients, products, and buildings
							await recipeService.createRecipeVersionFromClassNames(
								recipe.id,
								{
									moduleVersionId,
									manufacturingDuration: recipeData.manufacturingDuration.toString()
								},
								recipeData.ingredients,
								recipeData.products,
								recipeData.craftedIn
							);
							results.versionsCreated++;
						}
					}
				} catch (error) {
					results.errors.push(`Error processing recipe ${recipeData.className}: ${error}`);
					console.error(`Error processing recipe ${recipeData.className}:`, error);
				}
			}
		}

		return results;
	}
}

export const archiveRecipeService: IArchiveRecipeService = new ArchiveRecipeService(archiveService);
