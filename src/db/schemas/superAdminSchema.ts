import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pgTable, uuid, text, timestamp, unique } from "drizzle-orm/pg-core";
import { z } from "zod";
import { selectStaffSchema, staff } from "./staffSchema";
import { selectStudentSchema, students } from "./studentSchema";
import { users } from "./users";


export const superAdmin = pgTable('super_admin', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  userId: uuid("userId").references(() => users.id).unique(),
  password: text('password').notNull(),
  studentId: uuid('student_id').references(()=>students.studentId),
  staffId: uuid('staff_id').references(()=>staff.staffId)
}, (superAdmin) => ({
  uniqueEmail: unique().on(superAdmin.email),
}));

// Schema for selecting super_admin records
export const selectSuperAdminSchema = createSelectSchema(superAdmin);

// Schema for inserting new super_admin records
export const insertSuperAdminSchema = createInsertSchema(superAdmin, {
  email: (schema) => schema.email,

}).required({
  email: true,
  password: true,
}).omit({
  id: true
});

export const loginSuperAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4)

})

// Schema for deleting a super_admin record
export const deleteSuperAdminSchema = z.object({
  id: z.string().uuid(),
});
