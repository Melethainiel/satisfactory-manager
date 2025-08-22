import * as yaml from 'js-yaml';
import { archiveService, type IArchiveService } from './archiveService';
import { buildingService } from './buildingService';

// Interface for buildings as they appear in the Satisfactory mod archive YAML files
interface ArchiveBuildingData {
	ClassName: string;
	Name: string;
	Type: 'Generator' | 'Constructor' | 'Miner';
	EnergyConsumption?: number;
	EnergyProduction?: number;
	SupplementalLoadAmount?: number;
	Output?: number;
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
	 * Parses YAML content and converts buildings to import format
	 * @param yamlContent Raw YAML content string
	 * @returns Array of buildings in import format
	 */
	async parseBuildingsYaml(yamlContent: string): Promise<ImportBuildingData[]> {
		try {
			// Parse YAML
			const parsedYaml: any = yaml.load(yamlContent);

			if (!parsedYaml) {
				throw new Error('Invalid or empty YAML content');
			}

			// Handle different possible YAML structures
			let buildingsArray: any[];

			if (Array.isArray(parsedYaml)) {
				// YAML is a direct array of buildings
				buildingsArray = parsedYaml;
			} else if (parsedYaml.buildings && Array.isArray(parsedYaml.buildings)) {
				// YAML has a 'buildings' property containing the array
				buildingsArray = parsedYaml.buildings;
			} else if (parsedYaml.Buildings && Array.isArray(parsedYaml.Buildings)) {
				// YAML has 'Buildings' (capitalized) property containing the array
				buildingsArray = parsedYaml.Buildings;
			} else {
				// Try to find any array property
				const arrayProperty = Object.values(parsedYaml).find((val) => Array.isArray(val));
				if (arrayProperty) {
					buildingsArray = arrayProperty as any[];
				} else {
					throw new Error(
						'No buildings array found in YAML. Expected structure: array of buildings or {buildings: [...]}'
					);
				}
			}

			// Validate and convert each building
			const validBuildings: ImportBuildingData[] = [];
			const errors: string[] = [];

			for (let i = 0; i < buildingsArray.length; i++) {
				const validatedBuilding = this.validateArchiveBuilding(buildingsArray[i], i);
				if (validatedBuilding) {
					validBuildings.push(this.convertToImportFormat(validatedBuilding));
				} else {
					errors.push(`Invalid building data at index ${i}`);
				}
			}

			if (errors.length > 0) {
				console.warn('Archive building validation errors:', errors);
			}

			return validBuildings;
		} catch (error) {
			console.error('Error parsing buildings YAML:', error);
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
				ClassName: className.trim(),
				Name: name.trim(),
				Type: type as 'Generator' | 'Constructor' | 'Miner',
				EnergyConsumption: validatedEnergyConsumption,
				EnergyProduction: validatedEnergyProduction,
				SupplementalLoadAmount: validatedSupplementalLoadAmount,
				Output: validatedOutput
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
			className: archiveBuilding.ClassName,
			name: archiveBuilding.Name,
			type: archiveBuilding.Type,
			energyConsumption: archiveBuilding.EnergyConsumption,
			energyProduction: archiveBuilding.EnergyProduction,
			supplementalLoadAmount: archiveBuilding.SupplementalLoadAmount,
			output: archiveBuilding.Output
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
