import type {
	NewUser,
	NewGame,
	NewModule,
	NewModuleVersion,
	NewItem,
	NewBuilding,
	NewRecipe
} from '../../src/lib/server/db/schema';

export const testUsers: NewUser[] = [
	{
		displayName: 'Test User 1',
		email: 'testuser1@example.com'
	},
	{
		displayName: 'Test User 2',
		email: 'testuser2@example.com'
	},
	{
		displayName: 'Admin User',
		email: 'admin@example.com'
	},
	{
		displayName: 'Owner User',
		email: 'owner@example.com'
	}
];

export const testGames: NewGame[] = [
	{
		name: 'Test Game 1'
	},
	{
		name: 'Test Game 2'
	},
	{
		name: 'Private Game'
	}
];

export const testModules: NewModule[] = [
	{
		name: 'Base Game Module',
		url: 'https://github.com/satisfactory/base-game',
		currentVersion: '1.0.0',
		githubRepo: 'satisfactory/base-game'
	},
	{
		name: 'Community Module',
		url: 'https://github.com/community/satisfactory-mod',
		currentVersion: '2.1.0',
		githubRepo: 'community/satisfactory-mod'
	},
	{
		name: 'Test Module Without GitHub',
		url: 'https://example.com/module-no-github',
		currentVersion: null,
		githubRepo: null
	}
];

export const testModuleVersions: (moduleId: string) => NewModuleVersion[] = (moduleId: string) => [
	{
		moduleId,
		version: '1.0.0',
		releaseUrl: 'https://github.com/satisfactory/base-game/releases/tag/v1.0.0',
		releaseNotes: 'Initial release',
		publishedAt: new Date('2024-01-01')
	},
	{
		moduleId,
		version: '1.1.0',
		releaseUrl: 'https://github.com/satisfactory/base-game/releases/tag/v1.1.0',
		releaseNotes: 'Bug fixes and improvements',
		publishedAt: new Date('2024-02-01')
	},
	{
		moduleId,
		version: '2.0.0-beta',
		releaseUrl: 'https://github.com/satisfactory/base-game/releases/tag/v2.0.0-beta',
		releaseNotes: 'Major update with breaking changes',
		publishedAt: new Date('2024-03-01')
	}
];

export const testItems: NewItem[] = [
	{
		className: 'Desc_IronIngot_C',
		displayName: 'Iron Ingot',
		description: 'Basic iron ingot for crafting',
		form: 'RF_SOLID'
	},
	{
		className: 'Desc_IronPlate_C',
		displayName: 'Iron Plate',
		description: 'Processed iron plate',
		form: 'RF_SOLID'
	},
	{
		className: 'Desc_Water_C',
		displayName: 'Water',
		description: 'Pure H2O',
		form: 'RF_LIQUID'
	},
	{
		className: 'Desc_NitrogenGas_C',
		displayName: 'Nitrogen Gas',
		description: 'Compressed nitrogen gas',
		form: 'RF_GAS'
	}
];

export const testBuildings: NewBuilding[] = [
	{
		className: 'Build_ConstructorMk1_C',
		name: 'Constructor',
		type: 'Constructor'
	},
	{
		className: 'Build_MinerMk1_C',
		name: 'Miner Mk.1',
		type: 'Miner'
	},
	{
		className: 'Build_GeneratorCoal_C',
		name: 'Coal Generator',
		type: 'Generator'
	}
];

export const testRecipes: NewRecipe[] = [
	{
		className: 'Recipe_IronPlate_C',
		displayName: 'Iron Plate'
	},
	{
		className: 'Recipe_IronIngot_C',
		displayName: 'Iron Ingot'
	},
	{
		className: 'Recipe_Concrete_C',
		displayName: 'Concrete'
	}
];

// Complex import data with relationships
export const testImportRecipeData = {
	recipes: [
		{
			className: 'Recipe_IronPlate_C',
			displayName: 'Iron Plate',
			manufacturingDuration: 6.0,
			ingredients: [
				{
					item: 'Desc_IronIngot_C',
					count: 3
				}
			],
			products: [
				{
					item: 'Desc_IronPlate_C',
					count: 2
				}
			],
			craftedIn: ['Build_ConstructorMk1_C']
		},
		{
			className: 'Recipe_Concrete_C',
			displayName: 'Concrete',
			manufacturingDuration: 4.0,
			ingredients: [
				{
					item: 'Desc_Stone_C',
					count: 3
				},
				{
					item: 'Desc_Water_C',
					count: 1.5
				}
			],
			products: [
				{
					item: 'Desc_Concrete_C',
					count: 1
				}
			],
			craftedIn: ['Build_ConstructorMk1_C', 'Build_AssemblerMk1_C']
		}
	]
};

export const testImportItemData = {
	items: [
		{
			className: 'Desc_IronIngot_C',
			displayName: 'Iron Ingot',
			description: 'Basic iron ingot for crafting',
			stackSize: 100,
			energyValue: 0,
			radioactiveDecay: 0,
			form: 'RF_SOLID'
		},
		{
			className: 'Desc_IronPlate_C',
			displayName: 'Iron Plate',
			description: 'Processed iron plate',
			stackSize: 200,
			energyValue: 0,
			radioactiveDecay: 0,
			form: 'RF_SOLID'
		},
		{
			className: 'Desc_Water_C',
			displayName: 'Water',
			description: 'Pure H2O',
			stackSize: 50,
			energyValue: 0,
			radioactiveDecay: 0,
			form: 'RF_LIQUID'
		},
		{
			className: 'Desc_UraniumPellet_C',
			displayName: 'Uranium Pellet',
			description: 'Radioactive uranium pellet',
			stackSize: 100,
			energyValue: 750,
			radioactiveDecay: 20,
			form: 'RF_SOLID'
		}
	]
};

export const testImportBuildingData = [
	{
		className: 'Build_ConstructorMk1_C',
		name: 'Constructor',
		type: 'Constructor',
		energyConsumption: 4.0,
		energyProduction: 0,
		supplementalLoadAmount: 0,
		output: 15
	},
	{
		className: 'Build_MinerMk1_C',
		name: 'Miner Mk.1',
		type: 'Miner',
		energyConsumption: 5.0,
		energyProduction: 0,
		supplementalLoadAmount: 0,
		output: 60
	},
	{
		className: 'Build_GeneratorCoal_C',
		name: 'Coal Generator',
		type: 'Generator',
		energyConsumption: 0,
		energyProduction: 75,
		supplementalLoadAmount: 0,
		output: 75
	}
];

// Bulk import data for performance testing
export const generateLargeItemDataset = (count: number) => ({
	items: Array.from({ length: count }, (_, i) => ({
		className: `Desc_TestItem${i}_C`,
		displayName: `Test Item ${i}`,
		description: `Auto-generated test item ${i}`,
		stackSize: 100,
		energyValue: Math.floor(Math.random() * 1000),
		radioactiveDecay: Math.floor(Math.random() * 50),
		form: ['RF_SOLID', 'RF_LIQUID', 'RF_GAS'][Math.floor(Math.random() * 3)] as 'RF_SOLID' | 'RF_LIQUID' | 'RF_GAS'
	}))
});

export const generateLargeBuildingDataset = (count: number) =>
	Array.from({ length: count }, (_, i) => ({
		className: `Build_TestBuilding${i}_C`,
		name: `Test Building ${i}`,
		type: ['Constructor', 'Miner', 'Generator'][Math.floor(Math.random() * 3)] as 'Constructor' | 'Miner' | 'Generator',
		energyConsumption: Math.floor(Math.random() * 100),
		energyProduction: Math.floor(Math.random() * 100),
		supplementalLoadAmount: 0,
		output: Math.floor(Math.random() * 100)
	}));

export const generateLargeRecipeDataset = (count: number) => ({
	recipes: Array.from({ length: count }, (_, i) => ({
		className: `Recipe_TestRecipe${i}_C`,
		displayName: `Test Recipe ${i}`,
		manufacturingDuration: Math.random() * 60,
		ingredients: [
			{
				item: 'Desc_IronIngot_C',
				count: Math.floor(Math.random() * 10) + 1
			}
		],
		products: [
			{
				item: `Desc_TestItem${i}_C`,
				count: Math.floor(Math.random() * 5) + 1
			}
		],
		craftedIn: ['Build_ConstructorMk1_C']
	}))
});

// User role test data
export const testUserGameRoles = [
	{ role: 'Reader' as const },
	{ role: 'Contributor' as const },
	{ role: 'Administrator' as const },
	{ role: 'Owner' as const }
];

// GitHub API mock responses
export const mockGitHubReleases = [
	{
		tag_name: 'v1.0.0',
		name: 'Version 1.0.0',
		body: 'Initial release',
		published_at: '2024-01-01T00:00:00Z',
		html_url: 'https://github.com/test/repo/releases/tag/v1.0.0'
	},
	{
		tag_name: 'v1.1.0',
		name: 'Version 1.1.0',
		body: 'Bug fixes and improvements',
		published_at: '2024-02-01T00:00:00Z',
		html_url: 'https://github.com/test/repo/releases/tag/v1.1.0'
	}
];

// Complex versioned data for relationship testing
export const createVersionedTestData = (moduleVersionId: string) => ({
	items: testImportItemData.items.map((item) => ({
		...item,
		moduleVersionId
	})),
	buildings: testImportBuildingData.map((building) => ({
		...building,
		moduleVersionId
	})),
	recipes: testImportRecipeData.recipes.map((recipe) => ({
		...recipe,
		moduleVersionId
	}))
});
