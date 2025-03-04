import { pgTable, bigint, timestamp, varchar, text, date, foreignKey, unique, uuid, integer, doublePrecision, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const appliedOrNot = pgEnum("applied_or_not", ['yes', 'partial', 'no'])
export const userRole = pgEnum("user_role", ['staff', 'student', 'super_admin'])


export const drive = pgTable("drive", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "drive_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	companyName: varchar("company_name"),
	jobDescription: text("job description"),
	driveDate: date("drive_date"),
	expiration: timestamp({ withTimezone: true, mode: 'string' }),
	applicantList: text("applicant_list"),
	batch: text(),
	department: text().array(),
});

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
	appliedStudentsEmailIds: text("applied_students_emailIds").array(),
	userId: uuid("user_id"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "staff_user_id_fkey"
		}).onDelete("cascade"),
	unique("staff_email_unique").on(table.email),
]);

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
	regNo: text("reg_no").unique(),
	rollNo: integer("roll_no"),
	department: text(),
	noOfArrears: integer("no_of_arrears"),
	appliedOrNot: appliedOrNot("applied_or_not"),
	userId: uuid("user_id"),
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
	unique("students_reg_no_key").on(table.regNo),
	unique("unique_student_reg_no").on(table.regNo),
	unique("students_roll_no_key").on(table.rollNo),
	unique("unique_student_roll_no").on(table.rollNo),
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
