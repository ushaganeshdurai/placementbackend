import { pgTable, uuid, text, timestamp, unique, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod"; // Import Zod for validation

export const staff = pgTable('staff', {
  staffId: uuid('staff_id').primaryKey().defaultRandom(),
  empId: integer('empid').unique(),
  name: text('name').notNull(),
  username: text('username').notNull(),
  emailId: text('email_id').notNull(),
  password: text('password').notNull(),
  department: text('department').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (staff) => ({
  uniqueEmail: unique("staff_email_unique").on(staff.emailId),
  uniqueUsername: unique("staff_username_unique").on(staff.username),
}));

// Schema for selecting staff records
export const selectStaffSchema = createSelectSchema(staff);

// Schema for inserting new staff records
export const insertStaffSchema = createInsertSchema(staff, {
  emailId: (schema) => schema.emailId.regex(/^[a-zA-Z0-9]+@saec\.ac\.in$/),
}).required({
  name: true,
  username: true,
  emailId: true,
  password: true,
  department: true,
}).omit({
  staffId: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for deleting a staff record
export const deleteStaffSchema = z.object({
  staffId: z.string().uuid(),
});
