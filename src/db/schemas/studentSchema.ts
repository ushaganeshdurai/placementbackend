import { pgTable, uuid, text, unique, integer, doublePrecision, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { staff } from "./staffSchema";

export const applied_or_not = pgEnum("applied_or_not", ['yes', 'no', 'partial'])

export const students = pgTable('students', {
  staffId: uuid('staff_id').references(() => staff.staffId).notNull(),
  studentId: uuid('student_id').defaultRandom().primaryKey(),
  password: text('password'),
  userId: text('user_id'),
  email: text('email_id').notNull(),
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
  appliedOrNot: applied_or_not("applied_or_not"),
  regNo: text('reg_no').unique(),
  rollNo: integer('roll_no').unique(),
  department: text('department'),
  noOfArrears: integer('no_of_arrears'),
}, (students) => ({
  uniqueEmail: unique().on(students.email),
}));

// Schema for selecting student records
export const selectStudentSchema = createSelectSchema(students);

// Schema for inserting new student records
export const insertStudentSchema = createInsertSchema(students).required({
  email: true,
  password: true,
}).omit({
  studentId: true,
  userId: true,
  department: true,
  staffId: true,
  skillSet: true,
  languagesKnown: true,
  phoneNumber: true,
  appliedOrNot: true,
  noOfArrears: true,
  githubUrl: true,
  linkedinUrl: true,
  twelfthMark: true,
  tenthMark: true,
  cgpa: true,
  name: true,
  regNo: true,
  rollNo: true, //how to extract rollNo from email
  year: true
});






export const insertResumeSchema = createInsertSchema(students).required({
  skillSet: true,
  languagesKnown: true,
  phoneNumber: true,
  noOfArrears: true,
  githubUrl: true,
  linkedinUrl: true,
  twelfthMark: true,
  tenthMark: true,
  cgpa: true,
}).omit({
  regNo: true,
  rollNo: true, year: true,
  email: true, password: true, staffId: true, studentId: true, userId: true, appliedOrNot: true, department: true
})





export const loginStudentSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})



// Schema for deleting a student record
export const deleteStudentSchema = z.object({
  studentId: z.string().uuid(),
});
