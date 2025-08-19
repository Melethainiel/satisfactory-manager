import type { NewUser, NewGame, NewModule } from '../../src/lib/server/db/schema';

export const testUsers: NewUser[] = [
	{
		displayName: 'Test User 1',
		email: 'testuser1@example.com'
	},
	{
		displayName: 'Test User 2', 
		email: 'testuser2@example.com'
	}
];

export const testGames: NewGame[] = [
	{
		name: 'Test Game 1'
	},
	{
		name: 'Test Game 2'
	}
];

export const testModules: NewModule[] = [
	{
		name: 'Test Module 1',
		url: 'https://example.com/module1',
		currentVersion: '1.0.0',
		githubRepo: 'test/module1'
	}
];

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
		}
	]
};

export const testImportBuildingData = {
	buildings: [
		{
			className: 'Build_ConstructorMk1_C',
			displayName: 'Constructor',
			description: 'Basic building for crafting',
			powerConsumption: 4.0,
			powerConsumptionExponent: 1.6
		}
	]
};