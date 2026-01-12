ALTER TABLE "production_instances" DROP CONSTRAINT "production_instances_building_id_buildings_id_fk";
--> statement-breakpoint
ALTER TABLE "production_instances" ADD COLUMN "building_version_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "production_instances" ADD CONSTRAINT "production_instances_building_version_id_building_versions_id_fk" FOREIGN KEY ("building_version_id") REFERENCES "public"."building_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_instances" DROP COLUMN "building_id";