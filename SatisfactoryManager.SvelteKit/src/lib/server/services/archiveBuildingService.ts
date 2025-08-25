import * as yaml from 'js-yaml';
import { archiveService, type IArchiveService } from './archiveService';
import { buildingService } from './buildingService';
import { yamlValidationService } from './yamlValidationService';
import { db } from '../db';
import { moduleVersions } from '../db/schema';
import { eq } from 'drizzle-orm';

// Interface for buildings as they appear in the Satisfactory mod archive YAML files
interface ArchiveBuildingData {
	className: string;
	name: string;
	type: 'Generator' | 'Constructor' | 'Miner';
	energyConsumption?: number;
	energyProduction?: number;
	supplementalLoadAmount?: number;
	output?: number;
	// Additional fields that might exist but we don't use yet
	[key: string]: any;
}

// Interface for the converted format that matches our existing import API
interface ImportBuildingData {
	className: string;
	name: string;
	type: 'Generator' | 'Constructor' | 'Miner';
	energyConsumption?: number;
	energyProduction?: number;
	supplementalLoadAmount?: number;
	output?: number;
}

export interface ArchiveBuildingImportResult {
	totalBuildings: number;
	validBuildings: number;
	importResults: {
		created: number;
		updated: number;
		versionsCreated: number;
		errors: string[];
	};
}

export interface IArchiveBuildingService {
	importBuildingsFromArchive(
		archiveUrl: string,
		moduleVersionId: string
	): Promise<ArchiveBuildingImportResult>;
	importBuildingsFromYamlContent(
		yamlContent: string,
		moduleVersionId: string
	): Promise<ArchiveBuildingImportResult>;
	parseBuildingsYaml(yamlContent: string): Promise<ImportBuildingData[]>;
	validateArchiveBuilding(building: any, index: number): ArchiveBuildingData | null;
	convertToImportFormat(archiveBuilding: ArchiveBuildingData): ImportBuildingData;
}

class ArchiveBuildingService implements IArchiveBuildingService {
	constructor(private archiveService: IArchiveService) {}

	/**
	 * Downloads an archive, extracts and imports buildings from Files/buildings.yaml
	 * @param archiveUrl URL of the archive to download
	 * @param moduleVersionId Module version to associate buildings with
	 * @returns Import results with statistics
	 */
	async importBuildingsFromArchive(
		archiveUrl: string,
		moduleVersionId: string
	): Promise<ArchiveBuildingImportResult> {
		try {
			// Download and extract the buildings.yaml file
			const yamlContent = await this.archiveService.downloadAndExtractFile(
				archiveUrl,
				'Files/buildings.yaml'
			);

			if (!yamlContent) {
				// Buildings file is optional, don't throw error
				return {
					totalBuildings: 0,
					validBuildings: 0,
					importResults: {
						created: 0,
						updated: 0,
						versionsCreated: 0,
						errors: []
					}
				};
			}

			// Parse YAML content
			const importBuildings = await this.parseBuildingsYaml(yamlContent);

			if (importBuildings.length === 0) {
				return {
					totalBuildings: 0,
					validBuildings: 0,
					importResults: {
						created: 0,
						updated: 0,
						versionsCreated: 0,
						errors: ['No valid buildings found in Files/buildings.yaml']
					}
				};
			}

			// Use existing building import logic
			const results = await this.importBuildingsBulk(importBuildings, moduleVersionId);

			return {
				totalBuildings: importBuildings.length,
				validBuildings: importBuildings.length,
				importResults: results
			};
		} catch (error) {
			console.error('Error importing buildings from archive:', error);
			throw new Error(`Failed to import buildings from archive: ${error}`);
		}
	}

	/**
	 * Imports buildings directly from YAML content without downloading
	 * @param yamlContent Raw YAML content string
	 * @param moduleVersionId Module version to associate buildings with
	 * @returns Import results with statistics
	 */
	async importBuildingsFromYamlContent(
		yamlContent: string,
		moduleVersionId: string
	): Promise<ArchiveBuildingImportResult> {
		try {
			// Parse YAML content
			const importBuildings = await this.parseBuildingsYaml(yamlContent);

			if (importBuildings.length === 0) {
				return {
					totalBuildings: 0,
					validBuildings: 0,
					importResults: {
						created: 0,
						updated: 0,
						versionsCreated: 0,
						errors: ['No valid buildings found in YAML content']
					}
				};
			}

			// Use existing building import logic
			const results = await this.importBuildingsBulk(importBuildings, moduleVersionId);

			return {
				totalBuildings: importBuildings.length,
				validBuildings: importBuildings.length,
				importResults: results
			};
		} catch (error) {
			console.error('Error importing buildings from YAML content:', error);
			throw new Error(`Failed to import buildings from YAML content: ${error}`);
		}
	}

	/**
	 * Parses YAML content and converts buildings to import format
	 * @param yamlContent Raw YAML content string
	 * @returns Array of buildings in import format
	 */
	async parseBuildingsYaml(yamlContent: string): Promise<ImportBuildingData[]> {
		try {
			// Use secure YAML validation service
			const validatedBuildings =
				await yamlValidationService.validateAndParseBuildingsYaml(yamlContent);

			// Convert validated buildings to import format
			const importBuildings: ImportBuildingData[] = validatedBuildings.map((building) =>
				this.convertToImportFormat(building)
			);

			return importBuildings;
		} catch (error) {
			console.error('Error parsing buildings YAML with security validation:', error);
			throw new Error(`Failed to parse buildings YAML: ${error}`);
		}
	}

	/**
	 * Validates and normalizes a building from the archive
	 * @param building Raw building data from YAML
	 * @param index Index for error reporting
	 * @returns Validated building or null if invalid
	 */
	validateArchiveBuilding(building: any, index: number): ArchiveBuildingData | null {
		try {
			// Check required fields
			if (!building || typeof building !== 'object') {
				console.warn(`Building at index ${index} is not an object`);
				return null;
			}

			// Handle both camelCase and PascalCase formats
			const className = building.className || building.ClassName;
			const name = building.name || building.Name;
			const type = building.type || building.Type;
			const energyConsumption =
				building.energyConsumption !== undefined
					? building.energyConsumption
					: building.EnergyConsumption;
			const energyProduction =
				building.energyProduction !== undefined
					? building.energyProduction
					: building.EnergyProduction;
			const supplementalLoadAmount =
				building.supplementalLoadAmount !== undefined
					? building.supplementalLoadAmount
					: building.SupplementalLoadAmount;
			const output = building.output !== undefined ? building.output : building.Output;

			if (!className || typeof className !== 'string' || !className.trim()) {
				console.warn(`Building at index ${index} missing or invalid className/ClassName`);
				return null;
			}

			if (!name || typeof name !== 'string' || !name.trim()) {
				console.warn(`Building at index ${index} missing or invalid name/Name`);
				return null;
			}

			// Validate Type enum
			const validTypes = ['Generator', 'Constructor', 'Miner'];
			if (!type || !validTypes.includes(type)) {
				console.warn(`Building at index ${index} (${className}) has invalid type/Type: ${type}`);
				return null;
			}

			// Validate optional numeric fields
			let validatedEnergyConsumption: number | undefined;
			if (energyConsumption !== undefined && energyConsumption !== null) {
				const numericValue = Number(energyConsumption);
				if (isNaN(numericValue) || numericValue < 0) {
					console.warn(
						`Building at index ${index} (${className}) has invalid energyConsumption: ${energyConsumption}`
					);
					return null;
				}
				validatedEnergyConsumption = numericValue;
			}

			let validatedEnergyProduction: number | undefined;
			if (energyProduction !== undefined && energyProduction !== null) {
				const numericValue = Number(energyProduction);
				if (isNaN(numericValue) || numericValue < 0) {
					console.warn(
						`Building at index ${index} (${className}) has invalid energyProduction: ${energyProduction}`
					);
					return null;
				}
				validatedEnergyProduction = numericValue;
			}

			let validatedSupplementalLoadAmount: number | undefined;
			if (supplementalLoadAmount !== undefined && supplementalLoadAmount !== null) {
				const numericValue = Number(supplementalLoadAmount);
				if (isNaN(numericValue) || numericValue < 0) {
					console.warn(
						`Building at index ${index} (${className}) has invalid supplementalLoadAmount: ${supplementalLoadAmount}`
					);
					return null;
				}
				validatedSupplementalLoadAmount = numericValue;
			}

			let validatedOutput: number | undefined;
			if (output !== undefined && output !== null) {
				const numericValue = Number(output);
				if (isNaN(numericValue) || numericValue < 0) {
					console.warn(`Building at index ${index} (${className}) has invalid output: ${output}`);
					return null;
				}
				validatedOutput = numericValue;
			}

			// Return validated building with normalized field names
			return {
				className: className.trim(),
				name: name.trim(),
				type: type as 'Generator' | 'Constructor' | 'Miner',
				energyConsumption: validatedEnergyConsumption,
				energyProduction: validatedEnergyProduction,
				supplementalLoadAmount: validatedSupplementalLoadAmount,
				output: validatedOutput
			};
		} catch (error) {
			console.warn(`Error validating building at index ${index}:`, error);
			return null;
		}
	}

	/**
	 * Converts archive building format to existing import API format
	 * @param archiveBuilding Validated archive building
	 * @returns Building in import format
	 */
	convertToImportFormat(archiveBuilding: ArchiveBuildingData): ImportBuildingData {
		return {
			className: archiveBuilding.className,
			name: archiveBuilding.name,
			type: archiveBuilding.type,
			energyConsumption: archiveBuilding.energyConsumption,
			energyProduction: archiveBuilding.energyProduction,
			supplementalLoadAmount: archiveBuilding.supplementalLoadAmount,
			output: archiveBuilding.output
		};
	}

	/**
	 * Uses existing building service to import buildings in bulk
	 * @param buildings Buildings to import
	 * @param moduleVersionId Module version to associate with
	 * @returns Import results
	 */
	private async importBuildingsBulk(
		buildings: ImportBuildingData[],
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

		// Process buildings in batches to avoid overwhelming the database
		const batchSize = 100;
		for (let i = 0; i < buildings.length; i += batchSize) {
			const batch = buildings.slice(i, i + batchSize);

			for (const buildingData of batch) {
				try {
					// Check if building exists
					let building = await buildingService.getBuildingByClassName(buildingData.className);

					if (!building) {
						// Create new building
						building = await buildingService.createBuilding({
							moduleId: moduleVersion.moduleId,
							className: buildingData.className,
							name: buildingData.name,
							type: buildingData.type
						});
						results.created++;
					} else {
						// Check if building needs updating
						const needsUpdate =
							building.name !== buildingData.name || building.type !== buildingData.type;

						if (needsUpdate) {
							building = await buildingService.updateBuilding(building.id, {
								name: buildingData.name,
								type: buildingData.type
							});
							results.updated++;
						}
					}

					if (building) {
						// Check if building version already exists for this module version
						const existingVersion = await buildingService.getBuildingVersionByModuleAndBuilding(
							building.id,
							moduleVersionId
						);

						if (!existingVersion) {
							// Create building version with stats
							await buildingService.addBuildingVersion(building.id, {
								moduleVersionId,
								energyConsumption: buildingData.energyConsumption?.toString() || null,
								energyProduction: buildingData.energyProduction?.toString() || null,
								supplementalLoadAmount: buildingData.supplementalLoadAmount?.toString() || null,
								output: buildingData.output?.toString() || null
							});
							results.versionsCreated++;
						}
					}
				} catch (error) {
					results.errors.push(`Error processing building ${buildingData.className}: ${error}`);
				}
			}
		}

		return results;
	}
}

export const archiveBuildingService: IArchiveBuildingService = new ArchiveBuildingService(
	archiveService
);
