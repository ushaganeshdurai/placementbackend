CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_role" "user_role" NOT NULL
);
--> statement-breakpoint
DROP TABLE "auth"."profiles" CASCADE;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;