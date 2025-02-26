import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pgTable, uuid, text } from "drizzle-orm/pg-core";
import { z } from "zod";
import { users } from "./users";


export const superAdmin = pgTable('super_admin', {
  id: uuid('id').defaultRandom().primaryKey(), 
  email: text('email').notNull().unique(),
  userId: uuid('userId')
    .notNull()
    .references(() => users.id, { 
      onDelete: 'cascade' 
    }),
  password: text('password').notNull(),
});
// Schema for selecting super_admin records
export const selectSuperAdminSchema = createSelectSchema(superAdmin);

// Schema for inserting new super_admin records
export const insertSuperAdminSchema = createInsertSchema(superAdmin, {
  email: (schema) => schema.email,

}).required({
  email: true,
  password: true,
})

export const loginSuperAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4)
})

// Schema for deleting a super_admin record
export const deleteSuperAdminSchema = z.object({
  id: z.string().uuid(),
});
