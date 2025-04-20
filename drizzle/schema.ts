import { pgTable, unique, serial, text, smallint, bigint, timestamp, varchar, date, foreignKey, uuid, doublePrecision, integer, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const appliedOrNot = pgEnum("applied_or_not", ['yes', 'partial', 'no'])
export const placedOrNot = pgEnum("placed_or_not", ['yes', 'no'])
export const userRole = pgEnum("user_role", ['staff', 'student', 'super_admin'])
import { pgSchema } from "drizzle-orm/pg-core";


const auth = pgSchema("auth");

export const users = auth.table("users", {
    id: uuid('id').primaryKey(),
    email: text('email').notNull()
});



export const groupMails = pgTable("group_mails", {
	id: serial().primaryKey().notNull(),
	email: text().notNull(),
}, (table) => [
	unique("group_mails_email_key").on(table.email),
]);

export const coordinators = pgTable("coordinators", {
	name: text(),
	dept: text(),
	phoneNumber: text("phone number"),
	id: smallint().primaryKey().generatedByDefaultAsIdentity({ name: "coordinators_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 32767, cache: 1 }),
}, (table) => [
	unique("coordinators_id_key").on(table.id),
]);

export const drive = pgTable("drive", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "drive_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 92233, cache: 1 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	companyName: varchar("company_name"),
	jobDescription: text("job_description"),
	driveDate: date("drive_date"),
	expiration: timestamp({ withTimezone: true, mode: 'string' }),
	batch: text(),
	department: text().array(),
	driveLink: text("drive_link"),
	role: text(),
	lpa: text(),
});

export const profiles = pgTable("profiles", {
	id: uuid().primaryKey().notNull(),
	userRole: userRole("user_role").notNull(),
	email: text(),
}, (table) => [
	foreignKey({
			columns: [table.id],
			//@ts-ignore
			foreignColumns: [users.id],
			name: "profiles_id_fkey"
		}).onDelete("cascade"),
	unique("profiles_email_key").on(table.email),
]);

export const students = pgTable("students", {
	staffId: uuid("staff_id"),
	studentId: uuid("student_id").defaultRandom().primaryKey().notNull(),
	password: text(),
	email: text().notNull(),
	skillSet: text("skill_set"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	phoneNumber: bigint("phone_number", { mode: "number" }),
	languagesKnown: text("languages_known"),
	name: text(),
	tenthMark: doublePrecision("tenth_mark"),
	twelfthMark: doublePrecision("twelfth_mark"),
	cgpa: doublePrecision(),
	batch: text(),
	linkedinUrl: text("linkedin_url"),
	githubUrl: text("github_url"),
	regNo: text("reg_no"),
	rollNo: integer("roll_no"),
	department: text(),
	noOfArrears: integer("no_of_arrears"),
	userId: uuid("user_id"),
	placedStatus: placedOrNot().default('no'),
	url: text(),
	companyPlacedIn: text("company_placed_in"),
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

export const events = pgTable("events", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "events_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 922335807, cache: 1 }),
	eventName: text("event_name").notNull(),
	eventLink: text("event_link"),
	url: text(),
	date: text(),
});

export const applications = pgTable("applications", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "applications_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 922335807, cache: 1 }),
	studentId: uuid("student_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
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
			//@ts-ignore
			foreignColumns: [users.id],
			name: "super_admin_user_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.id, table.userId], name: "super_admin_pkey"}),
	unique("super_admin_email_key").on(table.email),
	unique("super_admin_user_id_key").on(table.userId),
]);
