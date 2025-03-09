import { pgTable, bigint, timestamp, varchar, text, date, uuid, foreignKey, unique, integer, doublePrecision, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const appliedOrNot = pgEnum("applied_or_not", ['yes', 'partial', 'no'])
export const placedOrNot = pgEnum("placed_or_not", ['yes', 'no'])
export const userRole = pgEnum("user_role", ['staff', 'student', 'super_admin'])

export const drive = pgTable("drive", {
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "drive_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	companyName: varchar("company_name"),
	jobDescription: text("job_description"),
	driveDate: date("drive_date"),
	driveLink:text("drive_link"),
	expiration: timestamp({ withTimezone: true, mode: 'string' }),
	batch: varchar({ length: 4 }),
	department: text().array(),
});

export const students = pgTable("students", {
	staffId: uuid("staff_id"),
	studentId: uuid("student_id").defaultRandom().primaryKey().notNull(),
	password: text(),
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
	regNo: text("reg_no"),
	rollNo: integer("roll_no"),
	department: text(),
	noOfArrears: integer("no_of_arrears"),
	userId: uuid("user_id"),
	placedStatus: placedOrNot().default('no'),
}, (table) => [
	foreignKey({
			columns: [table.staffId],
			foreignColumns: [staff.staffId],
			name: "fk_staff"
		}).onDelete("set null"),
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
	unique("unique_student_reg_no").on(table.regNo),
	unique("students_reg_no_key").on(table.regNo),
	unique("students_roll_no_key").on(table.rollNo),
	unique("unique_student_roll_no").on(table.rollNo),
]);

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
	email: text().notNull(),
	password: text(),
	department: text(),
	userId: uuid("user_id"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "staff_user_id_fkey"
		}).onDelete("cascade"),
	unique("staff_email_unique").on(table.email),
]);

export const applications = pgTable("applications", {
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "applications_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	studentId: uuid("student_id").notNull(),
	driveId: bigint("drive_id", { mode: "number" }).notNull(),
	appliedAt: timestamp("applied_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.driveId],
			foreignColumns: [drive.id],
			name: "applications_drive_id_fkey"
		}),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [students.studentId],
			name: "applications_student_id_fkey"
		}),
	unique("unique_application").on(table.studentId, table.driveId),
]);

export const superAdmin = pgTable("super_admin", {
	id: uuid().defaultRandom().notNull(),
	email: text().notNull(),
	userId: uuid("user_id").notNull(),
	password: text(),
	name: text(),
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
