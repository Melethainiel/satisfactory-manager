ALTER TABLE "buildings" DROP CONSTRAINT "buildings_class_name_unique";--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_class_name_unique";--> statement-breakpoint
ALTER TABLE "recipes" DROP CONSTRAINT "recipes_class_name_unique";--> statement-breakpoint
ALTER TABLE "buildings" ADD COLUMN "module_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "module_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "module_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_module_id_class_name_unique" UNIQUE("module_id","class_name");--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_module_id_class_name_unique" UNIQUE("module_id","class_name");--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_module_id_class_name_unique" UNIQUE("module_id","class_name");