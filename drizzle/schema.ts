import { pgTable, foreignKey, unique, uuid, text, date, integer, doublePrecision, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const appliedOrNot = pgEnum("applied_or_not", ['yes', 'partial', 'no'])
export const userRole = pgEnum("user_role", ['staff', 'student', 'super_admin'])


export const profiles = pgTable("profiles", {
	id: uuid().primaryKey().notNull(),
	userRole: userRole("user_role").notNull(),
	email: text(),
}, (table) => [
	foreignKey({
			columns: [table.id],
			foreignColumns: [users.id],
			name: "profiles_id_fkey"
		}).onDelete("cascade"),
	unique("profiles_email_key").on(table.email),
]);

export const staff = pgTable("staff", {
	staffId: uuid("staff_id").defaultRandom().primaryKey().notNull(),
	name: text(),
	studentId: uuid("student_id"),
	email: text().notNull(),
	password: text(),
	department: text(),
	studentEmailId: text("student_email_id"),
	jobDescription: text("job_description"),
	driveDate: date("drive_date"),
	appliedStudentsEmailIds: text("applied_students_emailIds").array(),
	userId: uuid("user_id"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "staff_user_id_fkey"
		}).onDelete("cascade"),
	unique("staff_student_id_key").on(table.studentId),
	unique("staff_email_unique").on(table.email),
	unique("staff_student_email_id_key").on(table.studentEmailId),
]);

export const students = pgTable("students", {
	staffId: uuid("staff_id"),
	studentId: uuid("student_id").primaryKey().notNull(),
	password: text().notNull(),
	email: text().notNull(),
	skillSet: text("skill_set"),
	phoneNumber: integer("phone_number"),
	languagesKnown: text("languages_known"),
	name: text(),
	tenthMark: doublePrecision("tenth_mark"),
	twelfthMark: doublePrecision("twelfth_mark"),
	cgpa: doublePrecision(),
	year: text(),
	linkedinUrl: text("linkedin_url"),
	githubUrl: text("github_url"),
	regNo: integer("reg_no").notNull(),
	rollNo: integer("roll_no").notNull(),
	department: text(),
	noOfArrears: integer("no_of_arrears"),
	appliedOrNot: appliedOrNot("applied_or_not"),
	userId: uuid("user_id"),
}, (table) => [
	foreignKey({
			columns: [table.staffId],
			foreignColumns: [staff.staffId],
			name: "students_staff_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "students_user_id_fkey"
		}).onDelete("cascade"),
	unique("students_student_id_unique").on(table.studentId),
	unique("students_email_unique").on(table.email),
	unique("students_reg_no_key").on(table.regNo),
	unique("students_roll_no_key").on(table.rollNo),
]);

export const superAdmin = pgTable("super_admin", {
	id: uuid().defaultRandom().notNull(),
	email: text().notNull(),
	userId: uuid().notNull(),
	password: text(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "super_admin_user_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.id, table.userId], name: "super_admin_pkey"}),
	unique("super_admin_email_key").on(table.email),
	unique("super_admin_user_id_key").on(table.userId),
]);
