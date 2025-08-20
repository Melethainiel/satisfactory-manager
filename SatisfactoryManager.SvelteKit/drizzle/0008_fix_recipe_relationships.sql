-- Fix recipe relationships to use proper foreign keys instead of class names

-- Add proper foreign key columns first (nullable for now)
ALTER TABLE "recipe_ingredients" ADD COLUMN "item_id" uuid;
ALTER TABLE "recipe_products" ADD COLUMN "item_id" uuid;
ALTER TABLE "recipe_buildings" ADD COLUMN "building_id" uuid;

-- Update the item_id columns by joining with items table on class_name
UPDATE "recipe_ingredients" 
SET "item_id" = (SELECT i.id FROM items i WHERE i.class_name = "recipe_ingredients"."item_class_name");

UPDATE "recipe_products" 
SET "item_id" = (SELECT i.id FROM items i WHERE i.class_name = "recipe_products"."item_class_name");

UPDATE "recipe_buildings" 
SET "building_id" = (SELECT b.id FROM buildings b WHERE b.class_name = "recipe_buildings"."building_class_name");

-- Make the new columns NOT NULL
ALTER TABLE "recipe_ingredients" ALTER COLUMN "item_id" SET NOT NULL;
ALTER TABLE "recipe_products" ALTER COLUMN "item_id" SET NOT NULL;
ALTER TABLE "recipe_buildings" ALTER COLUMN "building_id" SET NOT NULL;

-- Add foreign key constraints
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "recipe_products" ADD CONSTRAINT "recipe_products_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;  
ALTER TABLE "recipe_buildings" ADD CONSTRAINT "recipe_buildings_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;

-- Drop the old class name columns
ALTER TABLE "recipe_ingredients" DROP COLUMN "item_class_name";
ALTER TABLE "recipe_products" DROP COLUMN "item_class_name"; 
ALTER TABLE "recipe_buildings" DROP COLUMN "building_class_name";