CREATE TABLE "item_extraction_buildings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_version_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_fuel_generators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_version_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item_extraction_buildings" ADD CONSTRAINT "item_extraction_buildings_item_version_id_item_versions_id_fk" FOREIGN KEY ("item_version_id") REFERENCES "public"."item_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_extraction_buildings" ADD CONSTRAINT "item_extraction_buildings_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_fuel_generators" ADD CONSTRAINT "item_fuel_generators_item_version_id_item_versions_id_fk" FOREIGN KEY ("item_version_id") REFERENCES "public"."item_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_fuel_generators" ADD CONSTRAINT "item_fuel_generators_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;