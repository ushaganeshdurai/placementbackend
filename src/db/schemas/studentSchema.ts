import { pgTable, uuid, text, timestamp, unique, integer, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod"; // Import Zod for validation

export const students = pgTable('students', {
  studentId: uuid('student_id').primaryKey().defaultRandom(),
  password: text('password').notNull(),
  emailId: text('email_id').notNull(),
  skillSet: text('skill_set'),
  phoneNumber: integer('phone_number'),
  languagesKnown: text('languages_known'),
  name: text('name').notNull(),
  username: text('username').notNull(),
  tenthMark: doublePrecision('tenth_mark'),
  twelfthMark: doublePrecision('twelfth_mark'),
  cgpa: doublePrecision('cgpa'),
  linkedinUrl: text('linkedin_url'),
  githubUrl: text('github_url'),
  regNo: integer('reg_no').unique(),
  department: text('department'),
  noOfArrears: integer('no_of_arrears'),
  staffId: uuid('staff_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (students) => ({
  uniqueEmail: unique().on(students.emailId),
  uniqueUsername: unique().on(students.username),
}));

// Schema for selecting student records
export const selectStudentSchema = createSelectSchema(students);

// Schema for inserting new student records
export const insertStudentSchema = createInsertSchema(students, {
  emailId: (schema) => schema.emailId.regex(/^[0-9]+@saec\.ac\.in$/),
  phoneNumber: (schema) => schema.phoneNumber.min(1000000000).max(9999999999), // 10-digit phone number
}).required({
  name: true,
  username: true,
  emailId: true,
  password: true,
  department: true,
}).omit({
  studentId: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for deleting a student record
export const deleteStudentSchema = z.object({
  studentId: z.string().uuid(),
});
