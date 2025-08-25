ALTER TABLE "recipe_instances" RENAME TO "production_instances";--> statement-breakpoint
ALTER TABLE "production_instances" DROP CONSTRAINT "recipe_instances_site_id_sites_id_fk";
--> statement-breakpoint
ALTER TABLE "production_instances" DROP CONSTRAINT "recipe_instances_recipe_version_id_recipe_versions_id_fk";
--> statement-breakpoint
ALTER TABLE "production_instances" DROP CONSTRAINT "recipe_instances_building_id_buildings_id_fk";
--> statement-breakpoint
ALTER TABLE "production_instances" ALTER COLUMN "recipe_version_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "production_instances" ADD COLUMN "extracted_item_id" uuid;--> statement-breakpoint
ALTER TABLE "production_instances" ADD CONSTRAINT "production_instances_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_instances" ADD CONSTRAINT "production_instances_recipe_version_id_recipe_versions_id_fk" FOREIGN KEY ("recipe_version_id") REFERENCES "public"."recipe_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_instances" ADD CONSTRAINT "production_instances_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_instances" ADD CONSTRAINT "production_instances_extracted_item_id_items_id_fk" FOREIGN KEY ("extracted_item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;