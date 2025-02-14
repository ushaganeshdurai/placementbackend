CREATE TABLE "students" (
	"student_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"password" text NOT NULL,
	"email_id" text NOT NULL,
	"skill_set" text,
	"phone_number" integer,
	"languages_known" text,
	"name" text NOT NULL,
	"username" text NOT NULL,
	"tenth_mark" double precision,
	"twelfth_mark" double precision,
	"cgpa" double precision,
	"linkedin_url" text,
	"github_url" text,
	"reg_no" integer,
	"department" text,
	"no_of_arrears" integer,
	"staff_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "students_reg_no_unique" UNIQUE("reg_no"),
	CONSTRAINT "students_email_id_unique" UNIQUE("email_id"),
	CONSTRAINT "students_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "super_admin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"student_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "super_admin_email_unique" UNIQUE("email")
);
