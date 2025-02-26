import { pgTable, uuid, text, unique, integer, doublePrecision, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { staff } from "./staffSchema";

export const applied_or_not = pgEnum("applied_or_not", ['yes', 'no', 'partial'])

export const students = pgTable('students', {
  staffId: uuid('staff_id').references(() => staff.staffId),
  studentId: uuid('student_id').primaryKey().references(() => staff.studentId),
  password: text('password').notNull(),
  userId:text('user_id'),
  email: text('email_id').notNull().references(() => staff.studentEmailId),
  skillSet: text('skill_set'),
  phoneNumber: integer('phone_number'),
  languagesKnown: text('languages_known'),
  name: text('name').notNull(),
  tenthMark: doublePrecision('tenth_mark'),
  twelfthMark: doublePrecision('twelfth_mark'),
  cgpa: doublePrecision('cgpa'),
  year: text('year'),
  linkedinUrl: text('linkedin_url'),
  githubUrl: text('github_url'),
  regNo: integer('reg_no').notNull().unique(),
  rollNo: integer('roll_no').notNull().unique(),
  department: text('department'),
  noOfArrears: integer('no_of_arrears'),
}, (students) => ({
  uniqueEmail: unique().on(students.email),
}));

// Schema for selecting student records
export const selectStudentSchema = createSelectSchema(students);

// Schema for inserting new student records
export const insertStudentSchema = createInsertSchema(students, {
  email: (schema) => schema.email.regex(/^[0-9]+@saec\.ac\.in$/),
  phoneNumber: (schema) => schema.phoneNumber.min(1000000000).max(9999999999), // 10-digit phone number
}).required({
  email: true,
  department: true,
  studentId: true,
  password: true,
  name: true,
  regNo: true, rollNo: true,
  year: true
}).omit({
  studentId: true,
});


export const loginStudentSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})



// Schema for deleting a student record
export const deleteStudentSchema = z.object({
  studentId: z.string().uuid(),
});
