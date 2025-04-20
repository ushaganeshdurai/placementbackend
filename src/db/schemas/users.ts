import { pgSchema, uuid, foreignKey, pgTable, pgEnum, text } from "drizzle-orm/pg-core";
export const userRole = pgEnum("user_role", ['staff', 'student', 'super_admin'])


const auth = pgSchema("auth");

export const users = auth.table("users", {
    id: uuid('id').primaryKey(),
    email: text('email').notNull().unique()
});


export const profiles = pgTable("profiles", {
    id: uuid("id").primaryKey().notNull(),
    userRole: userRole("user_role").notNull(),
    email: text('email')
}, (table) => [
    foreignKey({
        columns: [table.id],
        foreignColumns: [users.id],
        name: "profiles_id_fkey"
    }).onDelete("cascade"),
    foreignKey({
        columns: [table.email],
        foreignColumns: [users.email],
        name: "profiles_email_fkey"
    }).onDelete("cascade"),
]);
