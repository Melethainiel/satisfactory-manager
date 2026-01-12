CREATE TYPE "public"."game_activity_type" AS ENUM('production_instance_created', 'production_instance_updated', 'production_instance_deleted', 'site_created', 'site_updated', 'site_deleted', 'user_joined', 'user_left', 'module_version_changed', 'game_settings_updated');--> statement-breakpoint
CREATE TABLE "game_activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"activity_type" "game_activity_type" NOT NULL,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"entity_name" varchar(200),
	"change_description" varchar(500),
	"change_data" varchar(2000),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_presence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"current_site_id" uuid,
	"activity" varchar(100),
	CONSTRAINT "user_presence_user_id_game_id_unique" UNIQUE("user_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "websocket_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"connection_id" varchar(100) NOT NULL,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"last_ping_at" timestamp DEFAULT now() NOT NULL,
	"user_agent" varchar(500),
	"ip_address" varchar(45),
	CONSTRAINT "websocket_connections_connection_id_unique" UNIQUE("connection_id")
);
--> statement-breakpoint
ALTER TABLE "game_activity_logs" ADD CONSTRAINT "game_activity_logs_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_activity_logs" ADD CONSTRAINT "game_activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_presence" ADD CONSTRAINT "user_presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_presence" ADD CONSTRAINT "user_presence_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_presence" ADD CONSTRAINT "user_presence_current_site_id_sites_id_fk" FOREIGN KEY ("current_site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "websocket_connections" ADD CONSTRAINT "websocket_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "websocket_connections" ADD CONSTRAINT "websocket_connections_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_activity_logs_game_created_idx" ON "game_activity_logs" USING btree ("game_id","created_at");--> statement-breakpoint
CREATE INDEX "game_activity_logs_entity_idx" ON "game_activity_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "game_activity_logs_user_idx" ON "game_activity_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_presence_game_online_idx" ON "user_presence" USING btree ("game_id","is_online");--> statement-breakpoint
CREATE INDEX "user_presence_last_seen_idx" ON "user_presence" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "websocket_connections_user_game_idx" ON "websocket_connections" USING btree ("user_id","game_id");--> statement-breakpoint
CREATE INDEX "websocket_connections_connection_id_idx" ON "websocket_connections" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "websocket_connections_game_id_idx" ON "websocket_connections" USING btree ("game_id");