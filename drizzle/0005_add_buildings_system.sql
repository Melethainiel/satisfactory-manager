CREATE TYPE "public"."building_type" AS ENUM('Generator', 'Constructor', 'Miner');--> statement-breakpoint
CREATE TABLE "building_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_id" uuid NOT NULL,
	"module_version_id" uuid NOT NULL,
	"energy_consumption" numeric(10, 2),
	"energy_production" numeric(10, 2),
	"supplemental_load_amount" numeric(10, 2),
	"output" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buildings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_name" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" "building_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "buildings_class_name_unique" UNIQUE("class_name")
);
--> statement-breakpoint
ALTER TABLE "building_versions" ADD CONSTRAINT "building_versions_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "building_versions" ADD CONSTRAINT "building_versions_module_version_id_module_versions_id_fk" FOREIGN KEY ("module_version_id") REFERENCES "public"."module_versions"("id") ON DELETE cascade ON UPDATE no action;