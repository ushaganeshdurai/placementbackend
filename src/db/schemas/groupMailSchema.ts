import { pgTable, text, serial, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const groupMails = pgTable("group_mails", {
  id: serial().primaryKey().notNull(),
  email: text().notNull(),
}, (table) => [
  unique("group_mails_email_key").on(table.email),
]);
export const insertGroupMailSchema = createInsertSchema(groupMails).required({
  email: true,
}).omit({
  id: true
});