import { pgTable, unique, pgPolicy, uuid, integer, text, timestamp, doublePrecision, foreignKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { users } from "@/db/schemas/users";

export const userRole = pgEnum("user_role", ['staff', 'student'])


export const staff = pgTable("staff", {
	staffId: uuid("staff_id").defaultRandom().primaryKey().notNull(),
	empid: integer(),
	name: text().notNull(),
	emailId: text("email_id").notNull(),
	password: text().notNull(),
	department: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("staff_empid_unique").on(table.empid),
	unique("staff_email_unique").on(table.emailId),
	pgPolicy("super_admin_delete_staffs", { as: "permissive", for: "delete", to: ["public"], using: sql`(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.user_role = 'super_admin'::text))))` }),
	pgPolicy("super_admin_update_staffs", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("super_admin_insert_staffs", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("super_admin_update_students", { as: "permissive", for: "update", to: ["public"] }),
]);

export const students = pgTable("students", {
	studentId: uuid("student_id").defaultRandom().primaryKey().notNull(),
	password: text().notNull(),
	email: text("email_id").notNull(),
	skillSet: text("skill_set"),
	phoneNumber: integer("phone_number"),
	languagesKnown: text("languages_known"),
	name: text().notNull(),
	username: text().notNull(),
	tenthMark: doublePrecision("tenth_mark"),
	twelfthMark: doublePrecision("twelfth_mark"),
	cgpa: doublePrecision(),
	rollNo:integer(),
	linkedinUrl: text("linkedin_url"),
	githubUrl: text("github_url"),
	regNo: integer("reg_no"),
	department: text(),
	noOfArrears: integer("no_of_arrears"),
	staffId: uuid("staff_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("students_email_id_unique").on(table.email),
	unique("students_username_unique").on(table.username),
	unique("students_reg_no_unique").on(table.regNo),
	pgPolicy("super_admin_update_students", { as: "permissive", for: "update", to: ["public"], using: sql`(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.user_role = 'super_admin'::text))))` }),
]);

export const superAdmin = pgTable("super_admin", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	password: text().notNull(),
	studentId: uuid("student_id"),
	userId: uuid("userId").notNull().references(() => users.id),
	staffId: uuid("staff_id"),
}, (table) => [
	unique("super_admin_email_unique").on(table.email),
]);

export const profiles = pgTable("profiles", {
	id: uuid().primaryKey().notNull(),
	userRole: text("user_role"),
}, (table) => [
	foreignKey({
			columns: [table.id],
			foreignColumns: [users.id],
			name: "profiles_id_fkey"
		}).onDelete("cascade"),
]);