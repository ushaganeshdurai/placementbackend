CREATE TABLE "staff" (
	"staff_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empid" integer,
	"name" text NOT NULL,
	"email_id" text NOT NULL,
	"password" text,
	"department" text,
	CONSTRAINT "staff_empid_unique" UNIQUE("empid"),
	CONSTRAINT "staff_email_unique" UNIQUE("email_id")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"student_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"password" text NOT NULL,
	"email_id" text NOT NULL,
	"skill_set" text,
	"phone_number" integer,
	"languages_known" text,
	"name" text NOT NULL,
	"tenth_mark" double precision,
	"twelfth_mark" double precision,
	"cgpa" double precision,
	"linkedin_url" text,
	"github_url" text,
	"reg_no" integer NOT NULL,
	"roll_no" integer NOT NULL,
	"department" text,
	"no_of_arrears" integer,
	"staff_id" uuid,
	CONSTRAINT "students_reg_no_unique" UNIQUE("reg_no"),
	CONSTRAINT "students_roll_no_unique" UNIQUE("roll_no"),
	CONSTRAINT "students_email_id_unique" UNIQUE("email_id")
);
--> statement-breakpoint
CREATE TABLE "super_admin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"userId" uuid,
	"password" text NOT NULL,
	"student_id" uuid,
	"staff_id" uuid,
	CONSTRAINT "super_admin_userId_unique" UNIQUE("userId"),
	CONSTRAINT "super_admin_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth"."profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_role" "user_role" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."users" (
	"id" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_staff_id_staff_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("staff_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "super_admin" ADD CONSTRAINT "super_admin_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "super_admin" ADD CONSTRAINT "super_admin_student_id_students_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "super_admin" ADD CONSTRAINT "super_admin_staff_id_staff_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("staff_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;