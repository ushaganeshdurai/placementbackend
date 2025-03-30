import { pgTable, uuid, text, unique, integer, doublePrecision, pgEnum, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { staff } from "./staffSchema";

export const applied_or_not = pgEnum("applied_or_not", ['yes', 'no', 'partial']);
export const placed_or_not = pgEnum("placed_or_not", ['yes', 'no']);

export const students = pgTable('students', {
  staffId: uuid('staff_id').references(() => staff.staffId).notNull(),
  studentId: uuid('student_id').defaultRandom().primaryKey(),
  password: text('password'),
  url:text('url'),
  companyPlacedIn: text('company_placed_in'),
  userId: text('user_id'),
  placedStatus: placed_or_not("placed_status"),
  email: text('email_id').notNull(),
  skillSet: text('skill_set'),
  phoneNumber: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "ph_no_seq", minValue: 1111111111, maxValue: 9999999999, cache: 1 }),
  languagesKnown: text('languages_known'),
  name: text('name').notNull(),
  tenthMark: doublePrecision('tenth_mark'),
  twelfthMark: doublePrecision('twelfth_mark'),
  cgpa: doublePrecision('cgpa'),
  batch: text('batch'), 
  linkedinUrl: text('linkedin_url'),
  githubUrl: text('github_url'),
  regNo: text('reg_no').unique(),
  rollNo: integer('roll_no').unique(),
  department: text('department'),
  noOfArrears: integer('no_of_arrears'),
}, (students) => ({
  uniqueEmail: unique().on(students.email),
}));

export const selectStudentSchema = createSelectSchema(students);

export const insertStudentSchema = createInsertSchema(students).required({
  email: true,
  password: true,
}).omit({
  studentId: true,
  userId: true,
  department: true,
  placedStatus: true,
  url:true,
  staffId: true,
  skillSet: true,
  languagesKnown: true,
  phoneNumber: true,
  noOfArrears: true,
  githubUrl: true,
  linkedinUrl: true,
  twelfthMark: true,
  tenthMark: true,
  cgpa: true,
  name: true,
  companyPlacedIn: true,
  regNo: true,
  rollNo: true,
});

export const loginStudentSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const deleteStudentSchema = z.object({
  studentId: z.string().uuid(),
});