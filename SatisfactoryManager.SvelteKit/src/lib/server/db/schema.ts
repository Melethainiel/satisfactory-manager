import {
	pgTable,
	varchar,
	uuid,
	primaryKey,
	pgEnum,
	timestamp,
	numeric,
	boolean,
	index,
	unique
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
	id: uuid('id').defaultRandom().primaryKey(),
	displayName: varchar('display_name', { length: 200 }).notNull(),
	email: varchar('email', { length: 320 }).notNull().unique()
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// Games table
export const games = pgTable('games', {
	id: uuid('id').defaultRandom().primaryKey(),
	name: varchar('name', { length: 200 }).notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;

// Sites table
export const sites = pgTable('sites', {
	id: uuid('id').defaultRandom().primaryKey(),
	name: varchar('name', { length: 200 }).notNull(),
	gameId: uuid('game_id')
		.notNull()
		.references(() => games.id, { onDelete: 'cascade' }),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
	gameIdIdx: index('sites_game_id_idx').on(table.gameId)
}));

export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;

// Module table
export const modules = pgTable('modules', {
	id: uuid('id').defaultRandom().primaryKey(),
	name: varchar('name', { length: 200 }).notNull(),
	url: varchar('url', { length: 2048 }).notNull(),
	description: varchar('description', { length: 1000 }),
	version: varchar('version', { length: 100 }),
	currentVersion: varchar('current_version', { length: 100 }),
	dependencies: varchar('dependencies', { length: 5000 }),
	manifestUrl: varchar('manifest_url', { length: 2048 }),
	downloadUrl: varchar('download_url', { length: 2048 }),
	githubRepo: varchar('github_repo', { length: 500 }),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export type Module = typeof modules.$inferSelect;
export type NewModule = typeof modules.$inferInsert;

// Module versions table to track available versions
export const moduleVersions = pgTable(
	'module_versions',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		moduleId: uuid('module_id')
			.notNull()
			.references(() => modules.id, { onDelete: 'cascade' }),
		version: varchar('version', { length: 100 }).notNull(),
		releaseUrl: varchar('release_url', { length: 2048 }),
		releaseNotes: varchar('release_notes', { length: 5000 }),
		publishedAt: timestamp('published_at'),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => ({
		// Ensure unique combination of moduleId and version
		moduleIdVersionUnique: unique().on(table.moduleId, table.version)
	})
);

export type ModuleVersion = typeof moduleVersions.$inferSelect;
export type NewModuleVersion = typeof moduleVersions.$inferInsert;

// Building versions table - version-specific building stats
export const buildingVersions = pgTable('building_versions', {
	id: uuid('id').defaultRandom().primaryKey(),
	buildingId: uuid('building_id')
		.notNull()
		.references(() => buildings.id, { onDelete: 'cascade' }),
	moduleVersionId: uuid('module_version_id')
		.notNull()
		.references(() => moduleVersions.id, { onDelete: 'cascade' }),
	energyConsumption: numeric('energy_consumption', { precision: 10, scale: 2 }),
	energyProduction: numeric('energy_production', { precision: 10, scale: 2 }),
	supplementalLoadAmount: numeric('supplemental_load_amount', { precision: 10, scale: 2 }),
	output: numeric('output', { precision: 10, scale: 2 }),
	createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
	buildingIdIdx: index('building_versions_building_id_idx').on(table.buildingId)
}));

export type BuildingVersion = typeof buildingVersions.$inferSelect;
export type NewBuildingVersion = typeof buildingVersions.$inferInsert;

// Authorization / role levels for a user within a game context
export const gameUserRoleEnum = pgEnum('game_user_role', [
	'Reader',
	'Contributor',
	'Administrator',
	'Owner'
]);

// Building types for Satisfactory buildings
export const buildingTypeEnum = pgEnum('building_type', ['Generator', 'Constructor', 'Miner']);

// Extractor purity levels
export const extractorPurityEnum = pgEnum('extractor_purity', ['Impure', 'Normal', 'Pure']);

// Item forms for Satisfactory items
export const itemFormEnum = pgEnum('item_form', ['RF_SOLID', 'RF_LIQUID', 'RF_GAS']);

// Items table - base item definitions
export const items = pgTable(
	'items',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		moduleId: uuid('module_id')
			.notNull()
			.references(() => modules.id, { onDelete: 'cascade' }),
		className: varchar('class_name', { length: 100 }).notNull(),
		displayName: varchar('display_name', { length: 200 }).notNull(),
		description: varchar('description', { length: 1000 }),
		form: itemFormEnum('form').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => ({
		classNameIdx: index('items_class_name_idx').on(table.className),
		moduleClassNameUnique: unique().on(table.moduleId, table.className)
	})
);

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type ItemForm = (typeof itemFormEnum.enumValues)[number];
export type ExtractorPurity = (typeof extractorPurityEnum.enumValues)[number];

// Item versions table - version-specific item data
export const itemVersions = pgTable('item_versions', {
	id: uuid('id').defaultRandom().primaryKey(),
	itemId: uuid('item_id')
		.notNull()
		.references(() => items.id, { onDelete: 'cascade' }),
	moduleVersionId: uuid('module_version_id')
		.notNull()
		.references(() => moduleVersions.id, { onDelete: 'cascade' }),
	energyValue: numeric('energy_value', { precision: 10, scale: 2 }).notNull().default('0'),
	createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
	itemIdIdx: index('item_versions_item_id_idx').on(table.itemId)
}));

export type ItemVersion = typeof itemVersions.$inferSelect;
export type NewItemVersion = typeof itemVersions.$inferInsert;

// Recipes table - base recipe definitions
export const recipes = pgTable(
	'recipes',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		moduleId: uuid('module_id')
			.notNull()
			.references(() => modules.id, { onDelete: 'cascade' }),
		className: varchar('class_name', { length: 100 }).notNull(),
		displayName: varchar('display_name', { length: 200 }).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => ({
		classNameIdx: index('recipes_class_name_idx').on(table.className),
		moduleClassNameUnique: unique().on(table.moduleId, table.className)
	})
);

export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;

// Recipe versions table - version-specific recipe data
export const recipeVersions = pgTable('recipe_versions', {
	id: uuid('id').defaultRandom().primaryKey(),
	recipeId: uuid('recipe_id')
		.notNull()
		.references(() => recipes.id, { onDelete: 'cascade' }),
	moduleVersionId: uuid('module_version_id')
		.notNull()
		.references(() => moduleVersions.id, { onDelete: 'cascade' }),
	manufacturingDuration: numeric('manufacturing_duration', { precision: 10, scale: 2 }).notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
	recipeIdIdx: index('recipe_versions_recipe_id_idx').on(table.recipeId)
}));

export type RecipeVersion = typeof recipeVersions.$inferSelect;
export type NewRecipeVersion = typeof recipeVersions.$inferInsert;

// Recipe ingredients table - ingredients for each recipe version
export const recipeIngredients = pgTable('recipe_ingredients', {
	id: uuid('id').defaultRandom().primaryKey(),
	recipeVersionId: uuid('recipe_version_id')
		.notNull()
		.references(() => recipeVersions.id, { onDelete: 'cascade' }),
	itemId: uuid('item_id')
		.notNull()
		.references(() => items.id, { onDelete: 'cascade' }),
	count: numeric('count', { precision: 10, scale: 2 }).notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
	recipeVersionIdIdx: index('recipe_ingredients_recipe_version_id_idx').on(table.recipeVersionId)
}));

export type RecipeIngredient = typeof recipeIngredients.$inferSelect;
export type NewRecipeIngredient = typeof recipeIngredients.$inferInsert;

// Recipe products table - products for each recipe version
export const recipeProducts = pgTable('recipe_products', {
	id: uuid('id').defaultRandom().primaryKey(),
	recipeVersionId: uuid('recipe_version_id')
		.notNull()
		.references(() => recipeVersions.id, { onDelete: 'cascade' }),
	itemId: uuid('item_id')
		.notNull()
		.references(() => items.id, { onDelete: 'cascade' }),
	count: numeric('count', { precision: 10, scale: 2 }).notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
	recipeVersionIdIdx: index('recipe_products_recipe_version_id_idx').on(table.recipeVersionId)
}));

export type RecipeProduct = typeof recipeProducts.$inferSelect;
export type NewRecipeProduct = typeof recipeProducts.$inferInsert;

// Recipe buildings table - buildings that can craft each recipe version
export const recipeBuildings = pgTable('recipe_buildings', {
	id: uuid('id').defaultRandom().primaryKey(),
	recipeVersionId: uuid('recipe_version_id')
		.notNull()
		.references(() => recipeVersions.id, { onDelete: 'cascade' }),
	buildingId: uuid('building_id')
		.notNull()
		.references(() => buildings.id, { onDelete: 'cascade' }),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export type RecipeBuilding = typeof recipeBuildings.$inferSelect;
export type NewRecipeBuilding = typeof recipeBuildings.$inferInsert;

// Item extraction buildings table - buildings that can extract each item
export const itemExtractionBuildings = pgTable('item_extraction_buildings', {
	id: uuid('id').defaultRandom().primaryKey(),
	itemVersionId: uuid('item_version_id')
		.notNull()
		.references(() => itemVersions.id, { onDelete: 'cascade' }),
	buildingId: uuid('building_id')
		.notNull()
		.references(() => buildings.id, { onDelete: 'cascade' }),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export type ItemExtractionBuilding = typeof itemExtractionBuildings.$inferSelect;
export type NewItemExtractionBuilding = typeof itemExtractionBuildings.$inferInsert;

// Item fuel generators table - buildings that can use each item as fuel
export const itemFuelGenerators = pgTable('item_fuel_generators', {
	id: uuid('id').defaultRandom().primaryKey(),
	itemVersionId: uuid('item_version_id')
		.notNull()
		.references(() => itemVersions.id, { onDelete: 'cascade' }),
	buildingId: uuid('building_id')
		.notNull()
		.references(() => buildings.id, { onDelete: 'cascade' }),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export type ItemFuelGenerator = typeof itemFuelGenerators.$inferSelect;
export type NewItemFuelGenerator = typeof itemFuelGenerators.$inferInsert;

// Buildings table - base building definitions
export const buildings = pgTable(
	'buildings',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		moduleId: uuid('module_id')
			.notNull()
			.references(() => modules.id, { onDelete: 'cascade' }),
		className: varchar('class_name', { length: 100 }).notNull(),
		name: varchar('name', { length: 200 }).notNull(),
		type: buildingTypeEnum('type').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => ({
		classNameIdx: index('buildings_class_name_idx').on(table.className),
		moduleClassNameUnique: unique().on(table.moduleId, table.className)
	})
);

export type Building = typeof buildings.$inferSelect;
export type NewBuilding = typeof buildings.$inferInsert;
export type BuildingType = (typeof buildingTypeEnum.enumValues)[number];

// Relations (many-to-many) User/Game
export const userGames = pgTable(
	'user_games',
	{
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		gameId: uuid('game_id')
			.notNull()
			.references(() => games.id, { onDelete: 'cascade' }),
		role: gameUserRoleEnum('role').notNull().default('Reader')
	},
	(t) => [primaryKey({ columns: [t.userId, t.gameId] })]
);

export const usersRelations = relations(users, ({ many }) => ({
	userGames: many(userGames)
}));

export const gamesRelations = relations(games, ({ many }) => ({
	userGames: many(userGames),
	moduleGames: many(moduleGames),
	sites: many(sites)
}));

export const userGamesRelations = relations(userGames, ({ one }) => ({
	user: one(users, {
		fields: [userGames.userId],
		references: [users.id]
	}),
	game: one(games, {
		fields: [userGames.gameId],
		references: [games.id]
	})
}));

export type UserGame = typeof userGames.$inferSelect;
export type NewUserGame = typeof userGames.$inferInsert;
export type GameUserRole = (typeof gameUserRoleEnum.enumValues)[number];

// Relations (many-to-many) Game/Module
export const moduleGames = pgTable(
	'module_games',
	{
		moduleId: uuid('module_id')
			.notNull()
			.references(() => modules.id, { onDelete: 'cascade' }),
		gameId: uuid('game_id')
			.notNull()
			.references(() => games.id, { onDelete: 'cascade' }),
		selectedVersionId: uuid('selected_version_id').references(() => moduleVersions.id, {
			onDelete: 'set null'
		})
	},
	(t) => [
		primaryKey({ columns: [t.moduleId, t.gameId] }),
		index('module_games_game_id_idx').on(t.gameId, t.moduleId)
	]
);

export const modulesRelation = relations(modules, ({ many }) => ({
	moduleGame: many(moduleGames),
	versions: many(moduleVersions),
	items: many(items),
	recipes: many(recipes),
	buildings: many(buildings)
}));

export const moduleVersionsRelations = relations(moduleVersions, ({ one, many }) => ({
	module: one(modules, {
		fields: [moduleVersions.moduleId],
		references: [modules.id]
	}),
	buildingVersions: many(buildingVersions),
	itemVersions: many(itemVersions),
	recipeVersions: many(recipeVersions)
}));

export const buildingsRelations = relations(buildings, ({ one, many }) => ({
	module: one(modules, {
		fields: [buildings.moduleId],
		references: [modules.id]
	}),
	versions: many(buildingVersions)
}));

export const buildingVersionsRelations = relations(buildingVersions, ({ one }) => ({
	building: one(buildings, {
		fields: [buildingVersions.buildingId],
		references: [buildings.id]
	}),
	moduleVersion: one(moduleVersions, {
		fields: [buildingVersions.moduleVersionId],
		references: [moduleVersions.id]
	})
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
	module: one(modules, {
		fields: [items.moduleId],
		references: [modules.id]
	}),
	versions: many(itemVersions)
}));

export const itemVersionsRelations = relations(itemVersions, ({ one }) => ({
	item: one(items, {
		fields: [itemVersions.itemId],
		references: [items.id]
	}),
	moduleVersion: one(moduleVersions, {
		fields: [itemVersions.moduleVersionId],
		references: [moduleVersions.id]
	})
}));

export const recipesRelations = relations(recipes, ({ one, many }) => ({
	module: one(modules, {
		fields: [recipes.moduleId],
		references: [modules.id]
	}),
	versions: many(recipeVersions)
}));

export const recipeVersionsRelations = relations(recipeVersions, ({ one, many }) => ({
	recipe: one(recipes, {
		fields: [recipeVersions.recipeId],
		references: [recipes.id]
	}),
	moduleVersion: one(moduleVersions, {
		fields: [recipeVersions.moduleVersionId],
		references: [moduleVersions.id]
	}),
	ingredients: many(recipeIngredients),
	products: many(recipeProducts),
	buildings: many(recipeBuildings)
}));

export const recipeIngredientsRelations = relations(recipeIngredients, ({ one }) => ({
	recipeVersion: one(recipeVersions, {
		fields: [recipeIngredients.recipeVersionId],
		references: [recipeVersions.id]
	}),
	item: one(items, {
		fields: [recipeIngredients.itemId],
		references: [items.id]
	})
}));

export const recipeProductsRelations = relations(recipeProducts, ({ one }) => ({
	recipeVersion: one(recipeVersions, {
		fields: [recipeProducts.recipeVersionId],
		references: [recipeVersions.id]
	}),
	item: one(items, {
		fields: [recipeProducts.itemId],
		references: [items.id]
	})
}));

export const recipeBuildingsRelations = relations(recipeBuildings, ({ one }) => ({
	recipeVersion: one(recipeVersions, {
		fields: [recipeBuildings.recipeVersionId],
		references: [recipeVersions.id]
	}),
	building: one(buildings, {
		fields: [recipeBuildings.buildingId],
		references: [buildings.id]
	})
}));

export const moduleGamesRelations = relations(moduleGames, ({ one }) => ({
	module: one(modules, {
		fields: [moduleGames.moduleId],
		references: [modules.id]
	}),
	game: one(games, {
		fields: [moduleGames.gameId],
		references: [games.id]
	}),
	selectedVersion: one(moduleVersions, {
		fields: [moduleGames.selectedVersionId],
		references: [moduleVersions.id]
	})
}));

// Production instances table - concrete implementations of recipes or extraction in specific sites
export const productionInstances = pgTable('production_instances', {
	id: uuid('id').defaultRandom().primaryKey(),
	siteId: uuid('site_id')
		.notNull()
		.references(() => sites.id, { onDelete: 'cascade' }),
	recipeVersionId: uuid('recipe_version_id').references(() => recipeVersions.id, {
		onDelete: 'cascade'
	}),
	buildingVersionId: uuid('building_version_id')
		.notNull()
		.references(() => buildingVersions.id, { onDelete: 'cascade' }),
	extractedItemVersionId: uuid('extracted_item_version_id').references(() => itemVersions.id, {
		onDelete: 'cascade'
	}),
	fuelItemVersionId: uuid('fuel_item_version_id').references(() => itemVersions.id, {
		onDelete: 'cascade'
	}),
	extractorPurity: extractorPurityEnum('extractor_purity').default('Normal'),
	buildingCount: numeric('building_count', { precision: 10, scale: 2 }).notNull(),
	efficiencyRatio: numeric('efficiency_ratio', { precision: 10, scale: 3 })
		.notNull()
		.default('1.000'),
	isBuilt: boolean('is_built').notNull().default(false),
	notes: varchar('notes', { length: 1000 }),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
	siteIdCompositeIdx: index('production_instances_site_id_composite_idx').on(
		table.siteId, 
		table.buildingCount, 
		table.efficiencyRatio, 
		table.isBuilt
	),
	buildingRecipeIdx: index('production_instances_building_recipe_idx').on(
		table.buildingVersionId, 
		table.recipeVersionId
	)
}));

export type ProductionInstance = typeof productionInstances.$inferSelect;
export type NewProductionInstance = typeof productionInstances.$inferInsert;

export const productionInstancesRelations = relations(productionInstances, ({ one }) => ({
	site: one(sites, {
		fields: [productionInstances.siteId],
		references: [sites.id]
	}),
	recipeVersion: one(recipeVersions, {
		fields: [productionInstances.recipeVersionId],
		references: [recipeVersions.id]
	}),
	buildingVersion: one(buildingVersions, {
		fields: [productionInstances.buildingVersionId],
		references: [buildingVersions.id]
	}),
	extractedItemVersion: one(itemVersions, {
		fields: [productionInstances.extractedItemVersionId],
		references: [itemVersions.id]
	}),
	fuelItemVersion: one(itemVersions, {
		fields: [productionInstances.fuelItemVersionId],
		references: [itemVersions.id]
	})
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
	game: one(games, {
		fields: [sites.gameId],
		references: [games.id]
	}),
	productionInstances: many(productionInstances)
}));
