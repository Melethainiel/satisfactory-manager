CREATE TYPE "public"."item_form" AS ENUM('RF_SOLID', 'RF_LIQUID', 'RF_GAS');--> statement-breakpoint
CREATE TABLE "item_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"module_version_id" uuid NOT NULL,
	"energy_value" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_name" varchar(100) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"description" varchar(1000),
	"form" "item_form" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "items_class_name_unique" UNIQUE("class_name")
);
--> statement-breakpoint
ALTER TABLE "item_versions" ADD CONSTRAINT "item_versions_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_versions" ADD CONSTRAINT "item_versions_module_version_id_module_versions_id_fk" FOREIGN KEY ("module_version_id") REFERENCES "public"."module_versions"("id") ON DELETE cascade ON UPDATE no action;