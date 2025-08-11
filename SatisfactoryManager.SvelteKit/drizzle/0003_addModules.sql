CREATE TABLE "module_games" (
	"module_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	CONSTRAINT "module_games_module_id_game_id_pk" PRIMARY KEY("module_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"url" varchar(2048) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "module_games" ADD CONSTRAINT "module_games_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_games" ADD CONSTRAINT "module_games_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;