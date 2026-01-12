ALTER TABLE "modules" ADD COLUMN "description" varchar(1000);--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "version" varchar(100);--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "dependencies" varchar(5000);--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "manifest_url" varchar(2048);--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "download_url" varchar(2048);