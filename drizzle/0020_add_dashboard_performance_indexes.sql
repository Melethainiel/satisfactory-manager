CREATE INDEX "building_versions_building_id_idx" ON "building_versions" USING btree ("building_id");--> statement-breakpoint
CREATE INDEX "item_versions_item_id_idx" ON "item_versions" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "module_games_game_id_idx" ON "module_games" USING btree ("game_id","module_id");--> statement-breakpoint
CREATE INDEX "production_instances_site_id_composite_idx" ON "production_instances" USING btree ("site_id","building_count","efficiency_ratio","is_built");--> statement-breakpoint
CREATE INDEX "production_instances_building_recipe_idx" ON "production_instances" USING btree ("building_version_id","recipe_version_id");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_recipe_version_id_idx" ON "recipe_ingredients" USING btree ("recipe_version_id");--> statement-breakpoint
CREATE INDEX "recipe_products_recipe_version_id_idx" ON "recipe_products" USING btree ("recipe_version_id");--> statement-breakpoint
CREATE INDEX "recipe_versions_recipe_id_idx" ON "recipe_versions" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "sites_game_id_idx" ON "sites" USING btree ("game_id");