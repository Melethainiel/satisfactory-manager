ALTER TABLE "production_instances" DROP CONSTRAINT "production_instances_extracted_item_id_items_id_fk";
--> statement-breakpoint
ALTER TABLE "production_instances" DROP CONSTRAINT "production_instances_fuel_item_id_items_id_fk";
--> statement-breakpoint
ALTER TABLE "production_instances" ADD COLUMN "extracted_item_version_id" uuid;--> statement-breakpoint
ALTER TABLE "production_instances" ADD COLUMN "fuel_item_version_id" uuid;--> statement-breakpoint
ALTER TABLE "production_instances" ADD CONSTRAINT "production_instances_extracted_item_version_id_item_versions_id_fk" FOREIGN KEY ("extracted_item_version_id") REFERENCES "public"."item_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_instances" ADD CONSTRAINT "production_instances_fuel_item_version_id_item_versions_id_fk" FOREIGN KEY ("fuel_item_version_id") REFERENCES "public"."item_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_instances" DROP COLUMN "extracted_item_id";--> statement-breakpoint
ALTER TABLE "production_instances" DROP COLUMN "fuel_item_id";