import * as yaml from 'js-yaml';
import { archiveService, type IArchiveService } from './archiveService';
import { recipeService } from './recipeService';

// Interface for recipes as they appear in the Satisfactory mod archive YAML files
interface ArchiveRecipeData {
	ClassName: string;
	DisplayName: string;
	ManufacturingDuration: number;
	Ingredients: Array<{
		Item: string;
		Count: number;
	}>;
	Products: Array<{
		Item: string;
		Count: number;
	}>;
	CraftedIn: string[];
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
	 * Parses YAML content and converts recipes to import format
	 * @param yamlContent Raw YAML content string
	 * @returns Array of recipes in import format
	 */
	async parseRecipesYaml(yamlContent: string): Promise<ImportRecipeData[]> {
		try {
			// Parse YAML
			const parsedYaml: any = yaml.load(yamlContent);

			if (!parsedYaml) {
				throw new Error('Invalid or empty YAML content');
			}

			// Handle different possible YAML structures
			let recipesArray: any[];

			if (Array.isArray(parsedYaml)) {
				// YAML is a direct array of recipes
				recipesArray = parsedYaml;
			} else if (parsedYaml.recipes && Array.isArray(parsedYaml.recipes)) {
				// YAML has a 'recipes' property containing the array
				recipesArray = parsedYaml.recipes;
			} else if (parsedYaml.Recipes && Array.isArray(parsedYaml.Recipes)) {
				// YAML has 'Recipes' (capitalized) property containing the array
				recipesArray = parsedYaml.Recipes;
			} else {
				// Try to find any array property
				const arrayProperty = Object.values(parsedYaml).find((val) => Array.isArray(val));
				if (arrayProperty) {
					recipesArray = arrayProperty as any[];
				} else {
					throw new Error(
						'No recipes array found in YAML. Expected structure: array of recipes or {recipes: [...]}'
					);
				}
			}

			// Validate and convert each recipe
			const validRecipes: ImportRecipeData[] = [];
			const errors: string[] = [];

			for (let i = 0; i < recipesArray.length; i++) {
				const validatedRecipe = this.validateArchiveRecipe(recipesArray[i], i);
				if (validatedRecipe) {
					validRecipes.push(this.convertToImportFormat(validatedRecipe));
				} else {
					errors.push(`Invalid recipe data at index ${i}`);
				}
			}

			if (errors.length > 0) {
				console.warn('Archive recipe validation errors:', errors);
			}

			return validRecipes;
		} catch (error) {
			console.error('Error parsing recipes YAML:', error);
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

			const validatedIngredients: Array<{ Item: string; Count: number }> = [];
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
					Item: item.trim(),
					Count: numericCount
				});
			}

			// Validate products array
			if (!Array.isArray(products) || products.length === 0) {
				console.warn(`Recipe at index ${index} (${className}) missing or empty products array`);
				return null;
			}

			const validatedProducts: Array<{ Item: string; Count: number }> = [];
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
					Item: item.trim(),
					Count: numericCount
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
				ClassName: className.trim(),
				DisplayName: displayName.trim(),
				ManufacturingDuration: numericDuration,
				Ingredients: validatedIngredients,
				Products: validatedProducts,
				CraftedIn: validatedCraftedIn
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
			className: archiveRecipe.ClassName,
			displayName: archiveRecipe.DisplayName,
			manufacturingDuration: archiveRecipe.ManufacturingDuration,
			ingredients: archiveRecipe.Ingredients.map((ing) => ({
				itemClassName: ing.Item,
				count: ing.Count.toString()
			})),
			products: archiveRecipe.Products.map((prod) => ({
				itemClassName: prod.Item,
				count: prod.Count.toString()
			})),
			craftedIn: archiveRecipe.CraftedIn.map((building) => ({
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
