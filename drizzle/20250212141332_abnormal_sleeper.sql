CREATE TABLE IF NOT EXISTS "staff" (
	"staff_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empid" integer,
	"name" text NOT NULL,
	"username" text NOT NULL,
	"email_id" text NOT NULL,
	"password" text NOT NULL,
	"department" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staff_empid_unique" UNIQUE("empid"),
	CONSTRAINT "staff_email_unique" UNIQUE("email_id"),
	CONSTRAINT "staff_username_unique" UNIQUE("username")
);
