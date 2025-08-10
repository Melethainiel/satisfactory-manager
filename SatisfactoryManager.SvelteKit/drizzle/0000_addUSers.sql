CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"email" varchar(320) NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
