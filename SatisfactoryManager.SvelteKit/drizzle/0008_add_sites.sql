CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"game_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_buildings" ADD COLUMN "building_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD COLUMN "item_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_products" ADD COLUMN "item_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_buildings" ADD CONSTRAINT "recipe_buildings_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_products" ADD CONSTRAINT "recipe_products_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "buildings_class_name_idx" ON "buildings" USING btree ("class_name");--> statement-breakpoint
CREATE INDEX "items_class_name_idx" ON "items" USING btree ("class_name");--> statement-breakpoint
CREATE INDEX "recipes_class_name_idx" ON "recipes" USING btree ("class_name");--> statement-breakpoint
ALTER TABLE "recipe_buildings" DROP COLUMN "building_class_name";--> statement-breakpoint
ALTER TABLE "recipe_ingredients" DROP COLUMN "item_class_name";--> statement-breakpoint
ALTER TABLE "recipe_products" DROP COLUMN "item_class_name";--> statement-breakpoint
ALTER TABLE "module_versions" ADD CONSTRAINT "module_versions_module_id_version_unique" UNIQUE("module_id","version");