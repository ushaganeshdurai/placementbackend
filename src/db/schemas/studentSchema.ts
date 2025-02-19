import { pgTable, uuid, text, unique, integer, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { staff } from "./staffSchema";

export const students = pgTable('students', {
  studentId: uuid('student_id').primaryKey().defaultRandom().references(()=>users.id),
  password: text('password').notNull(),
  emailId: text('email_id').notNull(),
  skillSet: text('skill_set'),
  phoneNumber: integer('phone_number'),
  languagesKnown: text('languages_known'),
  name: text('name').notNull(),
  tenthMark: doublePrecision('tenth_mark'),
  twelfthMark: doublePrecision('twelfth_mark'),
  cgpa: doublePrecision('cgpa'),
  linkedinUrl: text('linkedin_url'),
  githubUrl: text('github_url'),
  regNo: integer('reg_no').notNull().unique(),
  rollNo:integer('roll_no').notNull().unique(),
  department: text('department'),
  noOfArrears: integer('no_of_arrears'),
  staffId: uuid('staff_id').references(()=>staff.staffId),
}, (students) => ({
  uniqueEmail: unique().on(students.emailId),
}));

// Schema for selecting student records
export const selectStudentSchema = createSelectSchema(students);

// Schema for inserting new student records
export const insertStudentSchema = createInsertSchema(students, {
  emailId: (schema) => schema.emailId.regex(/^[0-9]+@saec\.ac\.in$/),
  phoneNumber: (schema) => schema.phoneNumber.min(1000000000).max(9999999999), // 10-digit phone number
}).required({
  name: true,
  emailId: true,
  password: true,
  department: true,
}).omit({
  studentId: true,
});

// Schema for deleting a student record
export const deleteStudentSchema = z.object({
  studentId: z.string().uuid(),
});
