import { pgTable, uuid, text, unique, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";


export const staff = pgTable('staff', {
  staffId: uuid('staff_id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  userId: text('user_id').references(() => users.id),
  studentId: uuid('student_id').defaultRandom(),
  studentEmailId: text('student_email_id'),
  email: text('email_id').notNull(),
  jobDescription: text('job_description'),
  driveDate: date('drive_date'),
  appliedStudentsEmailIds: text('applied_students_emailIds'),
  password: text('password').notNull(),
  department: text('department'),
}, (staff) => ({
  uniqueEmail: unique("staff_email_unique").on(staff.email),
}));

// Schema for selecting staff records
export const selectStaffSchema = createSelectSchema(staff);

// Schema for inserting new staff records
export const insertStaffSchema = createInsertSchema(staff).required({
  email: true,
  password: true,
}).omit({
  staffId: true,
  userId:true,
  driveDate: true,
  studentId: true,
  department: true,
  jobDescription: true,
  studentEmailId: true, appliedStudentsEmailIds: true,
  name: true
});



export const loginStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})

// Schema for deleting a staff record
export const deleteStaffSchema = z.object({
  staffId: z.string().uuid(),
});
