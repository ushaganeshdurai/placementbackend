import { pgTable, uuid, text, unique, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod"; 
import { users } from "./users";

export const staff = pgTable('staff', {
  staffId: uuid('staff_id').primaryKey().defaultRandom().references(() => users.id),
  empId: integer('empid').unique(),
  name: text('name').notNull(),
  emailId: text('email_id').notNull(),
  password: text('password'),
  department: text('department'),
}, (staff) => ({
  uniqueEmail: unique("staff_email_unique").on(staff.emailId),
}));

// Schema for selecting staff records
export const selectStaffSchema = createSelectSchema(staff);

// Schema for inserting new staff records
export const insertStaffSchema = createInsertSchema(staff, {
  emailId: (schema) => schema.emailId.regex(/^[a-zA-Z0-9]+@saec\.ac\.in$/),
}).required({

  emailId: true,
  password: true,
}).omit({
  staffId: true, name: true,
});

// Schema for deleting a staff record
export const deleteStaffSchema = z.object({
  staffId: z.string().uuid(),
});
