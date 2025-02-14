import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pgTable, uuid, text, timestamp, unique } from "drizzle-orm/pg-core";
import { z } from "zod";

export const superAdmin = pgTable('super_admin', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  password: text('password').notNull(),
  studentId: uuid('student_id'),
  staffId: uuid('staff_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (superAdmin) => ({
  uniqueEmail: unique().on(superAdmin.email),
}));

// Schema for selecting super_admin records
export const selectSuperAdminSchema = createSelectSchema(superAdmin);

// Schema for inserting new super_admin records
export const insertSuperAdminSchema = createInsertSchema(superAdmin, {
  email: (schema) => schema.email.regex(/^[a-zA-Z0-9]+@saec\.ac\.in$/),

}).required({
  email: true,
  password: true,
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const loginSuperAdminSchema = z.object({
  email: z.string().email().regex(/^[a-zA-Z0-9]+@saec\.ac\.in$/),
  password: z.string().min(4)

})

// Schema for deleting a super_admin record
export const deleteSuperAdminSchema = z.object({
  id: z.string().uuid(),
});
