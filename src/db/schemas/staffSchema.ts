import { pgTable, uuid, text, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";


export const staff = pgTable('staff', {
  staffId: uuid('staff_id').primaryKey().defaultRandom(),
  name: text('name'),
  userId: uuid('user_id').references(() => users.id),
  email: text('email').notNull(),
  password: text('password'),
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
  department: true,

}).omit({
  staffId: true,
  userId:true,
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
