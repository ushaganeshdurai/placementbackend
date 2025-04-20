import { pgTable, foreignKey, unique, bigint, uuid,pgSchema, timestamp, serial, text, doublePrecision, integer, varchar, date, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const appliedOrNot = pgEnum("applied_or_not", ['yes', 'no', 'partial'])
export const placedOrNot = pgEnum("placed_or_not", ['yes', 'no'])
export const userRole = pgEnum("user_role", ['staff', 'student', 'super_admin'])


const auth = pgSchema("auth");

export const users = auth.table("users", {
    id: uuid('id').primaryKey(),
    email: text('email').notNull().unique()
});



export const applications = pgTable("applications", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "applications_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 92233775807, cache: 1 }),
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

export const groupMails = pgTable("group_mails", {
	id: serial().primaryKey().notNull(),
	email: text().notNull(),
}, (table) => [
	unique("group_mails_email_key").on(table.email),
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

export const superAdmin = pgTable("super_admin", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	userId: uuid("user_id").notNull(),
	password: text().notNull(),
	name: text(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "super_admin_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "super_admin_user_id_fkey"
		}).onDelete("cascade"),
	unique("super_admin_email_unique").on(table.email),
	unique("super_admin_email_key").on(table.email),
	unique("super_admin_user_id_key").on(table.userId),
]);

export const staff = pgTable("staff", {
	staffId: uuid("staff_id").defaultRandom().primaryKey().notNull(),
	name: text(),
	userId: uuid("user_id"),
	email: text().notNull(),
	password: text(),
	department: text(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "staff_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "staff_user_id_fkey"
		}).onDelete("cascade"),
	unique("staff_email_unique").on(table.email),
]);

export const students = pgTable("students", {
	staffId: uuid("staff_id").notNull(),
	studentId: uuid("student_id").defaultRandom().primaryKey().notNull(),
	password: text(),
	url: text(),
	companyPlacedIn: text("company_placed_in"),
	userId: text("user_id"),
	placedStatus: placedOrNot("placedStatus"),
	email: text().notNull(),
	skillSet: text("skill_set"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	phoneNumber: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "ph_no_seq", startWith: 1111111111, increment: 1, minValue: 1111111111, maxValue: 9999999999, cache: 1 }),
	languagesKnown: text("languages_known"),
	name: text(),
	tenthMark: doublePrecision("tenth_mark"),
	twelfthMark: doublePrecision("twelfth_mark"),
	cgpa: doublePrecision(),
	batch: text(),
	linkedinUrl: text("linkedin_url"),
	githubUrl: text("github_url"),
	rollNo: integer("roll_no"),
	regNo: text('reg_no').unique(),
	department: text(),
	noOfArrears: integer("no_of_arrears"),
}, (table) => [
	foreignKey({
			columns: [table.staffId],
			foreignColumns: [staff.staffId],
			name: "students_staff_id_staff_staff_id_fk"
		}),
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
	unique("students_student_id_unique").on(table.studentId),
	unique("students_email_unique").on(table.email),
	unique("students_roll_no_unique").on(table.rollNo),
	unique("students_roll_no_key").on(table.rollNo),
	unique("unique_student_roll_no").on(table.rollNo),
]);

export const coordinators = pgTable("coordinators", {
	name: text(),
	dept: text(),
	phoneNumber: text("phone number"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "coordinators_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 92233775807, cache: 1 }),
});

export const drive = pgTable("drive", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "drive_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 92233775807, cache: 1 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	companyName: varchar("company_name"),
	jobDescription: text("job_description"),
	driveDate: date("drive_date"),
	driveLink: text("drive_link"),
	role: text(),
	lpa: text(),
	expiration: timestamp({ withTimezone: true, mode: 'string' }),
	department: text().array(),
	batch: text(),
});

export const events = pgTable("events", {
	id: serial().primaryKey().notNull(),
	eventName: text("event_name").notNull(),
	eventLink: text("event_link"),
	date: text(),
	url: text(),
});
